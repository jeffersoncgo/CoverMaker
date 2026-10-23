// Phase 3 login checks for CoverMaker against the mock Jellyfin.
// Usage: node auth_flow.js <newAppDir> <origAppDir>
// The new app is served on http://127.0.0.1:8765 (http.server). For the migration step, the same origin first
// serves the ORIGINAL app (routed from <origAppDir>), so the legacy password lands where real users have it.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const fs = require('fs'), path = require('path');
const [,, NEW_DIR, ORIG_DIR] = process.argv;
const BASE = 'http://127.0.0.1:8765/';
const MOCK = 'http://127.0.0.1:8769';
const MOCK_MEILI = 'http://127.0.0.1:8772';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mime = f => ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }[path.extname(f)] || 'application/octet-stream');

(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs] });
  const ctx = await browser.newContext();
  const R = {};
  const check = (name, v) => { R[name] = v; console.log(v.ok ? 'PASS' : 'FAIL', name, JSON.stringify(v).slice(0, 500)); };
  const stats = async (base = MOCK) => (await (await fetch(base + '/__mock/stats')).json());
  const resetStats = async (base = MOCK) => fetch(base + '/__mock/reset_stats');
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  };
  // Everything this origin stores, as one string, to search for the password
  const storageDump = (page) => page.evaluate(async () => {
    const ls = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    const dbs = await indexedDB.databases();
    let idb = '';
    for (const { name } of dbs) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const store of db.objectStoreNames) {
        const all = await new Promise(res => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
        idb += name + '/' + store + ':' + JSON.stringify(all).replace(/data:image\/[^"]+/g, 'IMG').slice(0, 2_000_000);
      }
      db.close();
    }
    return { ls, idb, keys: Object.keys(localStorage) };
  });
  const state = (page) => page.evaluate(() => ({
    loggedIn: document.getElementById('loginBtn').getAttribute('logged-in'),
    loginBoxVisible: getComputedStyle(document.getElementById('loginBox')).display !== 'none',
    message: document.getElementById('loginErrorMessage').innerText,
    libraries: window.jellyfin?.areLibrariesLoaded === true,
    cards: [...document.querySelectorAll('#jellyfinimages .library span')].map(s => s.textContent),
    logoutVisible: getComputedStyle(document.getElementById('logoutAction') || document.body).display !== 'none' && !!document.getElementById('logoutAction'),
    savedAuth: localStorage.getItem('jellyfinAuth'),
    passwordField: document.getElementById('Password').value,
  }));
  const waitLibraries = async (page, secs = 25) => { for (let i = 0; i < secs; i++) { await sleep(1000); if (await page.evaluate(() => window.jellyfin?.areLibrariesLoaded)) return true; } return false; };

  // ---- 1. Legacy state written by the ORIGINAL app on this same origin ----
  await ctx.route(BASE + '**', async (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '') || 'index.html';
    const file = path.join(ORIG_DIR, rel);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': mime(file) } });
  });
  let page = await ctx.newPage(); watch(page);
  await page.goto(BASE + 'index.html', { waitUntil: 'load' }); await sleep(6000);
  await page.evaluate((mock) => { showWindow('loginBox'); }, MOCK);
  await page.fill('#Server', MOCK); await page.fill('#Username', 'admin'); await page.fill('#Password', 'secret');
  await page.dispatchEvent('#Password', 'change'); await page.dispatchEvent('#Server', 'change'); await page.dispatchEvent('#Username', 'change');
  await page.click('#loginAction'); await waitLibraries(page); await sleep(4000);
  const legacy = await storageDump(page);
  check('setup: original app stored the password (localStorage + pageMemory)', { ok: legacy.ls.includes('secret') && legacy.idb.includes('secret'), inLocalStorage: legacy.ls.includes('secret'), inPageMemory: legacy.idb.includes('secret') });
  await page.close();
  await ctx.unroute(BASE + '**');
  errors.length = 0;

  // ---- 2. New app, first load: uses the saved password once, keeps only a token ----
  await resetStats();
  page = await ctx.newPage(); watch(page);
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  const loaded = await waitLibraries(page); await sleep(4000);
  let st = await state(page); let dump = await storageDump(page); let s = await stats();
  check('migration: logs in with the old saved password, then keeps only a token', {
    ok: loaded && st.loggedIn === 'true' && !!st.savedAuth && !dump.ls.includes('secret') && !dump.idb.includes('secret') && (s.auth_by_name || []).length === 1,
    loaded, loggedIn: st.loggedIn, cards: st.cards, tokenSaved: !!st.savedAuth, passwordInLocalStorage: dump.ls.includes('secret'), passwordInIndexedDB: dump.idb.includes('secret'), passwordLogins: s.auth_by_name, keys: dump.keys,
  });

  // ---- 3. Reload: token only, no password sent ----
  await resetStats();
  await page.reload({ waitUntil: 'load' });
  const loaded2 = await waitLibraries(page); await sleep(2500);
  st = await state(page); s = await stats(); dump = await storageDump(page);
  check('reload: logged in with the token, no password sent or stored', {
    ok: loaded2 && st.loggedIn === 'true' && !(s.auth_by_name || []).length && (s.by_path['/Users/{id}'] || 0) >= 1 && !dump.ls.includes('secret') && !dump.idb.includes('secret') && st.logoutVisible,
    loaded2, cards: st.cards, passwordLogins: s.auth_by_name || [], tokenChecks: s.by_path['/Users/{id}'], logoutVisible: st.logoutVisible,
  });

  // ---- 4. Token revoked on the server: login window, then wrong and right password ----
  await fetch(MOCK + '/__mock/revoke_tokens');
  await page.reload({ waitUntil: 'load' }); await sleep(6000);
  st = await state(page);
  check('revoked token: login window shown, stale token forgotten', { ok: st.loggedIn === 'false' && st.loginBoxVisible && !st.savedAuth, ...st });
  await page.fill('#Username', 'admin'); await page.fill('#Password', 'wrong'); await page.click('#loginAction'); await sleep(3000);
  st = await state(page);
  check('wrong password: error shown, nothing saved, Connect usable again', { ok: st.loggedIn === 'false' && /Authentication failed/.test(st.message) && !st.savedAuth && st.passwordField === '' && await page.evaluate(() => !document.getElementById('loginAction').hasAttribute('inactive')), ...st });
  await page.fill('#Username', 'admin'); await page.fill('#Password', 'secret'); await page.click('#loginAction');
  const loaded3 = await waitLibraries(page); await sleep(2000);
  st = await state(page); dump = await storageDump(page);
  check('right password: logged in, token saved, password cleared', { ok: loaded3 && st.loggedIn === 'true' && !!st.savedAuth && st.passwordField === '' && !dump.ls.includes('secret') && !dump.idb.includes('secret'), loaded3, cards: st.cards, passwordField: st.passwordField });

  // ---- 5. Switching account with the login window (password wins over the saved token) ----
  await page.evaluate(() => showWindow('loginBox'));
  await page.fill('#Username', 'guest'); await page.fill('#Password', 'guest'); await page.click('#loginAction');
  await waitLibraries(page); await sleep(2000);
  const who = await page.evaluate(() => ({ user: window.jellyfin.User.Id, saved: JSON.parse(localStorage.getItem('jellyfinAuth') || '{}').userId }));
  check('switch account: typed credentials replace the saved session', { ok: who.user === 'u-guest' && who.saved === 'u-guest', ...who });

  // ---- 6. Sign out: token revoked on the server and forgotten here ----
  const oldToken = await page.evaluate(() => JSON.parse(localStorage.getItem('jellyfinAuth')).token);
  await page.evaluate(() => showWindow('loginBox'));
  await page.click('#logoutAction'); await sleep(1500);
  st = await state(page);
  const tokenStillWorks = (await fetch(MOCK + '/Users/u-guest', { headers: { authorization: `MediaBrowser Token="${oldToken}"` } })).status;
  await page.reload({ waitUntil: 'load' }); await sleep(6000);
  const afterReload = await state(page);
  check('sign out: server session ended, nothing saved, stays logged out after reload', { ok: st.loggedIn === 'false' && !st.savedAuth && tokenStillWorks === 401 && afterReload.loggedIn === 'false' && afterReload.loginBoxVisible, tokenStatusAfterLogout: tokenStillWorks, message: st.message, afterReload });

  // ---- 7. Non-admin user on a server with the Meilisearch plugin: libraries still load ----
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) errors.push(m.type() + ' ' + m.text().slice(0, 140)); });
  await page.fill('#Server', MOCK_MEILI); await page.dispatchEvent('#Server', 'change');
  await page.fill('#Username', 'guest'); await page.fill('#Password', 'guest'); await page.click('#loginAction');
  const loadedMeili = await waitLibraries(page, 30); await sleep(2000);
  st = await state(page);
  check('non-admin + Meilisearch plugin: libraries load through Jellyfin', { ok: loadedMeili && st.cards.length === 2, loadedMeili, cards: st.cards, meili: await page.evaluate(() => window.jellyfin.Meilisearch.isAvailable), libs: await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.jellyfin.Libraries || {}).map(([k, v]) => [k, v.Status + ':' + v.Items?.length])))), auth: await page.evaluate(() => [window.jellyfin.isAuthenticated, window.jellyfin.Server.Address, window.jellyfin.User.Id]), consoleTail: [...errors].slice(-6) });

  // ---- 8. Server offline: message, no unhandled error ----
  errors.length = 0;
  await page.evaluate(() => showWindow('loginBox'));
  await page.fill('#Server', 'http://127.0.0.1:1'); await page.dispatchEvent('#Server', 'change');
  await page.reload({ waitUntil: 'load' }); await sleep(7000);
  st = await state(page);
  check('server offline: message shown, no unhandled rejection', { ok: /offline/i.test(st.message) && st.loginBoxVisible && !errors.some(e => /PAGEERROR|Uncaught/.test(e)), message: st.message, errors: [...errors] });

  console.log(Object.values(R).filter(v => v.ok).length + '/' + Object.keys(R).length + ' passed');
  await browser.close();
})();
