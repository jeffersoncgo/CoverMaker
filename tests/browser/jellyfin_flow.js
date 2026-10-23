// CoverMaker + mock Jellyfin: login, libraries, posters, search (last keystroke), poster -> slot.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const [,, URL_, label] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs, '--js-flags=--expose-gc'] });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { localStorage.setItem('server', 'http://127.0.0.1:8769'); localStorage.setItem('username', 'admin'); localStorage.setItem('password', 'secret'); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  await page.goto(URL_, { waitUntil: 'load' });
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) { await sleep(1000); if (process.env.NO_GC !== '1') await page.evaluate(() => gc()); if (await page.evaluate(() => window.jellyfin?.areLibrariesLoaded)) break; }
  const loadSeconds = Math.round((Date.now() - t0) / 1000);
  await sleep(2500);
  const r = { loadSeconds };
  r.loggedIn = await page.evaluate(() => document.getElementById('loginBtn').getAttribute('logged-in'));
  r.libraryCards = await page.evaluate(() => [...document.querySelectorAll('#jellyfinimages .library span')].map(s => s.textContent));
  await page.evaluate(() => document.querySelector('#jellyfinimages .library img').click()); await sleep(1500);
  r.postersInLibrary = await page.evaluate(() => document.querySelectorAll('#jellyfinimages .poster').length);
  r.thumbUrl = await page.evaluate(() => (document.querySelector('#jellyfinimages .poster img')?.src || '').replace(/^.*\?/, '?'));
  // type quickly: last keystroke must win
  await page.evaluate(() => { const i = document.getElementById('searchInput'); i.value = ''; i.dispatchEvent(new Event('input')); });
  await sleep(1500);
  await page.type('#searchInput', 'Horror', { delay: 120 });
  await sleep(3000);
  r.searchShows = await page.evaluate(() => [...document.querySelectorAll('#jellyfinimages .poster span')].map(s => s.textContent).slice(0, 3));
  r.searchAllMatch = await page.evaluate(() => { const n = [...document.querySelectorAll('#jellyfinimages .poster span')].map(s => s.textContent); return n.length > 0 && n.every(x => /horror/i.test(x)); });
  // poster -> slot
  const before = await page.evaluate(() => slotsImages.filter(Boolean).length);
  await page.evaluate(() => { addImageSlot(); }); await sleep(300);
  await page.evaluate(() => document.querySelector('#jellyfinimages .poster img').click()); await sleep(3000);
  r.slotFilledFromJellyfin = await page.evaluate((b) => slotsImages.filter(Boolean).length === b + 1, before);
  // next page
  await page.evaluate(() => { const i = document.getElementById('searchInput'); i.value = ''; i.dispatchEvent(new Event('input')); }); await sleep(2500);
  const p1 = await page.evaluate(() => [...document.querySelectorAll('#jellyfinimages .poster span')].map(s => s.textContent)[0]);
  await page.evaluate(() => nextPage()); await sleep(1500);
  const p2 = await page.evaluate(() => [...document.querySelectorAll('#jellyfinimages .poster span')].map(s => s.textContent)[0]);
  r.nextPageChanges = !!p1 && !!p2 && p1 !== p2;
  r.stats = await (await fetch('http://127.0.0.1:8769/__mock/stats')).json().then(s => s.requests).catch(() => null);
  console.log(label, JSON.stringify({ ...r, errs: [...new Set(errs)].filter(e => !/ERR_CONNECTION_REFUSED/.test(e)) }));
  await browser.close();
})();
