// Phase 4 checks: edited items refresh from cache (CM-16), watched status refresh (CR-01), scroll lock (CR-08),
// tokenizer (CR-11), type filter (CR-09). Usage: node p4_checks.js
// CoverMaker on :8765, content-recommender on :8768, mock Jellyfin on :8769 (fresh: restart it before running).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const MOCK = 'http://127.0.0.1:8769';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs] });
  const R = {};
  const check = (name, v) => { R[name] = v; console.log(v.ok ? 'PASS' : 'FAIL', name, JSON.stringify(v).slice(0, 450)); };
  const legacyLogin = (ctx) => ctx.addInitScript(() => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('server', 'http://127.0.0.1:8769'); localStorage.setItem('username', 'admin'); localStorage.setItem('password', 'secret'); } });
  const errs = [];

  // ---- CoverMaker: an item edited on the server shows up although the library comes from the cache ----
  {
    const ctx = await browser.newContext(); await legacyLogin(ctx);
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push('CM ' + e.message.slice(0, 150)));
    const loaded = async () => { for (let i = 0; i < 30; i++) { await sleep(1000); if (await page.evaluate(() => window.jellyfin?.areLibrariesLoaded)) return true; } return false; };
    await page.goto('http://127.0.0.1:8765/index.html'); await loaded(); await sleep(2000);
    const first = await page.evaluate(() => ({ name: window.jellyfin.Libraries.Movies.Items.find(i => i.Id === 'lib-movies-005')?.Name, lastSync: window.jellyfin.Libraries.Movies.LastSync }));
    await fetch(MOCK + '/__mock/edit?id=lib-movies-005&name=' + encodeURIComponent('Edited On Server'));
    await fetch(MOCK + '/__mock/reset_stats');
    await page.reload(); await loaded(); await sleep(2000);
    const second = await page.evaluate(() => ({ name: window.jellyfin.Libraries.Movies.Items.find(i => i.Id === 'lib-movies-005')?.Name, count: window.jellyfin.Libraries.Movies.Items.length, lastSync: window.jellyfin.Libraries.Movies.LastSync }));
    const s = await (await fetch(MOCK + '/__mock/stats')).json();
    // a full reload would fetch the 40 movies again in pages; from the cache only the size + the edited-items query run
    check('CM-16 cached library picks up an item edited on the server', { ok: second.name === 'Edited On Server' && second.count === 40 && !!first.lastSync && second.lastSync > first.lastSync, first, second, itemRequests: s.by_path['/Users/{id}/Items'] });
    // the refreshed name is also in the cache for the next visit (no server change in between)
    await page.reload(); await loaded(); await sleep(1500);
    const third = await page.evaluate(() => window.jellyfin.Libraries.Movies.Items.find(i => i.Id === 'lib-movies-005')?.Name);
    check('CM-16 refreshed item is saved in the cache', { ok: third === 'Edited On Server', third });
    const shuffled = await page.evaluate(() => { const counts = Array(5).fill(0); for (let t = 0; t < 20000; t++) counts[Jellyfin.shuffle([0, 1, 2, 3, 4])[0]]++; return counts; });
    check('Fisher-Yates shuffle is uniform (first position, 20k runs)', { ok: shuffled.every(c => Math.abs(c - 4000) < 300), shuffled });
    await ctx.close();
  }

  // ---- content-recommender ----
  {
    const ctx = await browser.newContext(); await legacyLogin(ctx);
    const page = await ctx.newPage(); page.on('pageerror', e => errs.push('CR ' + e.message.slice(0, 150)));
    const waitPlayed = async () => { for (let i = 0; i < 40; i++) { await sleep(1000); if (await page.evaluate(() => (window.Played || []).length > 0)) return true; } return false; };
    await page.goto('http://127.0.0.1:8768/index.html'); await waitPlayed(); await sleep(3000);
    const before = await page.evaluate(() => ({ played: window.Played.length, has001: window.Played.some(i => i.Id === 'lib-movies-001') }));
    await fetch(MOCK + '/__mock/set_played?id=lib-movies-001&played=1');
    await page.reload(); await waitPlayed(); await sleep(3000);
    const after = await page.evaluate(() => ({ played: window.Played.length, has001: window.Played.some(i => i.Id === 'lib-movies-001'), cached: Object.values(window.jellyfin.Libraries).every(l => l.Status === 'Loaded') }));
    check('CR-01 item watched after the first visit counts as watched (library from cache)', { ok: !before.has001 && after.has001 && after.played === before.played + 1, before, after });
    await fetch(MOCK + '/__mock/set_played?id=lib-movies-001&played=0');

    // CR-08: ten scroll events at the bottom start one batch, not ten
    const scroll = await page.evaluate(async () => {
      const groups = () => document.querySelectorAll('#recommendations-container > .because-you-watched-container:not(#taste-recommendations-container)').length;
      const g0 = groups();
      let calls = 0; const original = window.getSugestions;
      window.scrollTo(0, document.body.scrollHeight);
      for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('scroll'));
      await new Promise(r => setTimeout(r, 2500));
      return { before: g0, after: groups() };
    });
    check('CR-08 rapid scroll events load one batch at a time', { ok: scroll.after - scroll.before === 3, ...scroll });

    // CR-11: tokenizer keeps non-ASCII letters and gives the same tokens as before for ASCII titles
    const tok = await page.evaluate(() => {
      const old = name => (name || "").toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !['the', 'part', 'season', 'episode'].includes(w));
      const ascii = ['The Matrix Reloaded', 'Spider-Man: No Way Home', "Ocean's Eleven (2001)", 'Movie 019 Horror', 'Part 2 of THE saga', 'Star Wars: Episode IV'];
      return { sameAscii: ascii.every(n => JSON.stringify(old(n)) === JSON.stringify(tokenizeName(n))), acao: tokenizeName('Ação Total'), jp: tokenizeName('千と千尋 の神隠し'), oldAcao: old('Ação Total') };
    });
    check('CR-11 tokenizer: ASCII unchanged, accents and other scripts kept', { ok: tok.sameAscii && JSON.stringify(tok.acao) === '["acao","total"]' && tok.jp.length === 2, ...tok });

    const types = await page.evaluate(async () => {
      const lib = Object.values(window.jellyfin.Libraries)[0];
      lib.Items.push({ Id: 'fake-boxset', Name: 'A Collection', Type: 'BoxSet', UserData: { Played: false } }, { Id: 'fake-playlist', Name: 'A Playlist', Type: 'Playlist', UserData: { Played: false } });
      const list = await getList(null, 'Unplayed');
      lib.Items.splice(-2, 2);
      return { hasBoxSet: list.some(i => i.Id === 'fake-boxset'), hasPlaylist: list.some(i => i.Id === 'fake-playlist'), size: list.length };
    });
    check('CR-09 collections and playlists are not recommended', { ok: !types.hasBoxSet && !types.hasPlaylist && types.size > 0, ...types });
    await ctx.close();
  }
  check('no page errors', { ok: errs.length === 0, errs });
  console.log(Object.values(R).filter(x => x.ok).length + '/' + Object.keys(R).length + ' passed');
  await browser.close();
})();
