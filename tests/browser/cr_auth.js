// Phase 3 checks for content-recommender: legacy password -> token, token-only reload, sign out, card XSS.
// Usage: node cr_auth.js <cdnDir> <coverMakerDir>   (content-recommender served on :8768, mock Jellyfin on :8769)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const fs = require('fs'), path = require('path');
const [,, CDN, CM] = process.argv;
const MOCK = 'http://127.0.0.1:8769';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs] });
  const ctx = await browser.newContext();
  await ctx.route('https://jeffersoncgo.github.io/**', async route => {
    const u = new URL(route.request().url());
    const m = u.pathname.match(/^\/(cdn|CoverMaker)\/(.+)$/);
    if (!m) return route.abort();
    const file = path.join(m[1] === 'cdn' ? CDN : CM, m[2]);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: file.endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(file) });
  });
  // Legacy state (what older versions saved), written once
  await ctx.addInitScript(() => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('server', 'http://127.0.0.1:8769'); localStorage.setItem('username', 'admin'); localStorage.setItem('password', 'secret'); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 160)));
  const R = {};
  const check = (name, v) => { R[name] = v; console.log(v.ok ? 'PASS' : 'FAIL', name, JSON.stringify(v).slice(0, 400)); };
  const waitPlayed = async () => { for (let i = 0; i < 40; i++) { await sleep(1000); if (await page.evaluate(() => (window.Played || []).length > 0)) return true; } return false; };
  const dump = () => page.evaluate(async () => {
    const ls = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    let idb = '';
    for (const { name } of await indexedDB.databases()) {
      const db = await new Promise(res => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); });
      for (const store of db.objectStoreNames) idb += await new Promise(res => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(JSON.stringify(r.result).slice(0, 2_000_000)); r.onerror = () => res(''); });
      db.close();
    }
    return { pw: ls.includes('secret') || idb.includes('secret'), token: !!localStorage.getItem('jellyfinAuth'), keys: Object.keys(localStorage) };
  });
  const view = () => page.evaluate(() => ({ loggedIn: document.getElementById('loginBtn').getAttribute('logged-in'), played: (window.Played || []).length, taste: document.querySelectorAll('#taste-recommendations-container .Content-card').length, because: document.querySelectorAll('.because-you-watched-container .Content-card').length, loginBox: getComputedStyle(document.getElementById('loginBox')).display !== 'none', logout: !document.getElementById('logoutAction').hidden }));
  const stats = async () => (await (await fetch(MOCK + '/__mock/stats')).json());

  await fetch(MOCK + '/__mock/reset_stats');
  await page.goto('http://127.0.0.1:8768/index.html', { waitUntil: 'load' });
  let ok = await waitPlayed(); await sleep(4000);
  let v = await view(), d = await dump(), s = await stats();
  check('migration: old saved password used once, then only a token', { ok: ok && v.loggedIn === 'true' && v.taste > 0 && d.token && !d.pw && (s.auth_by_name || []).length === 1, ...v, ...d, passwordLogins: s.auth_by_name });

  await fetch(MOCK + '/__mock/reset_stats');
  await page.reload({ waitUntil: 'load' });
  ok = await waitPlayed(); await sleep(4000);
  v = await view(); d = await dump(); s = await stats();
  check('reload: recommendations with the token alone', { ok: ok && v.loggedIn === 'true' && v.taste > 0 && v.because > 0 && !(s.auth_by_name || []).length && !d.pw && v.logout, ...v, passwordLogins: s.auth_by_name || [] });

  const xss = await page.evaluate(() => {
    window.__xss = 0;
    const name = '"><img src=x onerror="window.__xss=1"><b>bold</b>';
    const card = createContentCard({ Id: 'x', Name: name, similarityScore: 50, CommunityRating: null, ProductionYear: 2001 });
    document.body.appendChild(card);
    return new Promise(r => setTimeout(() => r({ xss: window.__xss, title: card.querySelector('h3').textContent === name, alt: card.querySelector('img').alt === name + ' cover', rating: card.querySelectorAll('.rating')[1].textContent, injected: card.querySelectorAll('b, img').length }), 800));
  });
  check('cards: names are text (no HTML), null rating shows N/A', { ok: xss.xss === 0 && xss.title && xss.alt && xss.injected === 1 && xss.rating === 'Community Rating: N/A', ...xss });

  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('jellyfinAuth')).token);
  await page.evaluate(() => showWindow('loginBox'));
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#logoutAction')]);
  await sleep(5000);
  v = await view(); d = await dump();
  const status = (await fetch(MOCK + '/Users/u-admin', { headers: { authorization: `MediaBrowser Token="${token}"` } })).status;
  check('sign out: token revoked, login window after reload', { ok: v.loggedIn === 'false' && v.loginBox && !d.token && status === 401, ...v, tokenStatus: status });

  await page.fill('#Username', 'guest'); await page.fill('#Password', 'guest'); await page.click('#loginAction');
  ok = await waitPlayed(); await sleep(3000);
  v = await view(); d = await dump();
  check('login form: logs in, keeps only the token', { ok: v.loggedIn === 'true' && d.token && !d.pw && await page.evaluate(() => document.getElementById('Password').value === ''), ...v });
  check('no page errors', { ok: errs.length === 0, errs });
  console.log(Object.values(R).filter(x => x.ok).length + '/' + Object.keys(R).length + ' passed');
  await browser.close();
})();
