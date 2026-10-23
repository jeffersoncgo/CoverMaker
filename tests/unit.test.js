// Checks that need no browser. Run from the repository root: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const jsFiles = dir => fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js')).map(f => path.join(dir, f));

// Browser-ish sandbox: enough for the files to define their globals
const sandbox = (extra = {}) => {
  const storage = new Map();
  const ctx = {
    console, setTimeout, clearTimeout, Promise, Math, JSON, Map, Set, Date,
    window: { addEventListener() {} },
    document: { createElement: () => ({ getContext: () => ({}) }), getElementById: () => ({ addEventListener() {}, appendChild() {}, options: [] }), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    navigator: {},
    ...extra,
  };
  return vm.createContext(ctx);
};
const load = (ctx, rel) => vm.runInContext(read(rel), ctx, { filename: rel });

test('every script parses', () => {
  for (const rel of [...jsFiles('js'), ...jsFiles('js/vendor')]) {
    assert.doesNotThrow(() => new vm.Script(read(rel), { filename: rel }), rel);
  }
});

test('gallery.json: every image, setup and project file exists', () => {
  const items = JSON.parse(read('gallery/gallery.json'));
  const missing = items.flatMap(item => ['image', 'setup', 'project'].filter(k => item[k] && !fs.existsSync(path.join(ROOT, item[k]))).map(k => `${item.id}.${k}: ${item[k]}`));
  assert.deepEqual(missing, []);
});

test('effect registries: no key is declared twice (a second declaration silently hides the first, CM-07)', () => {
  for (const rel of ['js/compositeRegistry.js', 'js/effectsRegistry.js', 'js/textEffects.js']) {
    const keys = [...read(rel).matchAll(/^(?:  |\}, )([A-Za-z0-9_]+): \{\s*$/gm)].map(m => m[1]);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    assert.deepEqual(dupes, [], rel);
  }
});

test('effect registries: every entry has a name, an apply function and valid params', () => {
  const ctx = sandbox();
  for (const rel of ['js/compositeRegistry.js', 'js/effectsRegistry.js', 'js/textEffects.js']) load(ctx, rel);
  const regs = vm.runInContext('({ COMPOSITE_REGISTRY, EFFECTS_REGISTRY, TEXT_EFFECTS })', ctx);
  const problems = [];
  for (const [regName, reg] of Object.entries(regs)) {
    for (const [id, def] of Object.entries(reg)) {
      if (typeof def.name !== 'string' || !def.name) problems.push(`${regName}.${id}: no name`);
      if (typeof def.apply !== 'function') problems.push(`${regName}.${id}: no apply`);
      const keys = new Set();
      for (const p of def.params || []) {
        // entries without a key are section titles: they need a label (CM-30)
        if (!p.key) { if (!p.label) problems.push(`${regName}.${id}: param without key and label`); continue; }
        if (keys.has(p.key)) problems.push(`${regName}.${id}: param ${p.key} twice`);
        keys.add(p.key);
        if (p.type === 'select' && !(Array.isArray(p.options) ? p.options.length : Object.keys(p.options || {}).length)) problems.push(`${regName}.${id}.${p.key}: select without options`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('Google Fonts variants map matches the font list', () => {
  const list = JSON.parse(read('fonts/google-fonts.json'));
  const variants = JSON.parse(read('fonts/google-fonts-variants.json'));
  const unknown = Object.keys(variants).filter(f => !list.includes(f));
  assert.deepEqual(unknown, [], 'families in the map but not in the list');
  const covered = list.filter(f => variants[f]).length / list.length;
  assert.ok(covered > 0.99, `only ${(covered * 100).toFixed(1)} % of the fonts have variants (regenerate the map)`);
  for (const [family, v] of Object.entries(variants)) assert.match(v, /^\d{1,4}i?(,\d{1,4}i?)*$/, family); // variable fonts go from 1 to 1000
});

test('chooseFontVariant picks the face the browser would use, and nothing for regular 400', () => {
  const ctx = sandbox();
  load(ctx, 'js/fonts.js');
  const choose = vm.runInContext('chooseFontVariant', ctx);
  const plain = v => (v ? `${v.wght}${v.ital ? 'i' : ''}` : null);
  assert.equal(plain(choose('400', 700, 0)), null);              // Bangers: only 400 → synthesized, no request
  assert.equal(plain(choose('400', 100, 0)), null);
  assert.equal(plain(choose('300,400,700,700i', 700, 1)), '700i');
  assert.equal(plain(choose('300,400,700', 700, 1)), '700');     // no italic face: real bold, browser slants it
  assert.equal(plain(choose('300,400,600,800', 700, 0)), '800'); // CSS matching for 700: first ≥ 700
  assert.equal(plain(choose('300,400,600', 700, 0)), '600');     // …else the heaviest above 400
  assert.equal(plain(choose('100,300,400', 100, 0)), '100');
  assert.equal(plain(choose('300,400', 100, 0)), '300');         // lightest available
  assert.equal(plain(choose('400,400i', 400, 1)), '400i');
});

test('Jellyfin helpers: server address, ids, saved session and isPlayed', () => {
  const ctx = sandbox({ FetchQueue: class {}, Controller: class { exec() {} } });
  load(ctx, 'js/jellyfin.js');
  const J = vm.runInContext('Jellyfin', ctx);
  assert.equal(J.normalizeServer(' http://host:8096/ '), 'http://host:8096');
  assert.equal(J.itemKey('ABC-def-1'), 'abcdef1');
  // (objects made inside the sandbox have another Object prototype: compare their JSON)
  const plainObj = o => JSON.parse(JSON.stringify(o));
  assert.deepEqual(plainObj(J.pickUserData({ Played: true, PlayCount: 2, IsFavorite: false, LastPlayedDate: 'x', PlayedPercentage: 80, Other: 1 })),
    { IsFavorite: false, Played: true, PlayCount: 2, LastPlayedDate: 'x', PlayedPercentage: 80 });
  // saved session: only { server, serverId, userId, token }, matched by address
  const ls = vm.runInContext('localStorage', ctx);
  assert.equal(J.getSavedAuth('http://host:8096'), null);
  ls.setItem(J.AUTH_STORAGE_KEY, JSON.stringify({ server: 'http://host:8096', serverId: 's1', userId: 'u1', token: 't1' }));
  assert.equal(J.getSavedAuth('http://host:8096/').token, 't1');
  assert.equal(J.getSavedAuth('http://other:8096'), null);
  J.clearSavedAuth();
  assert.equal(J.getSavedAuth(), null);
  // isPlayed: played, play count, 70 % rule; collections never count
  const isPlayed = J.prototype.isPlayed;
  assert.equal(Boolean(isPlayed({ UserData: { Played: true } })), true);
  assert.equal(Boolean(isPlayed({ UserData: { PlayedPercentage: 75 } })), true);
  assert.equal(Boolean(isPlayed({ UserData: { PlayedPercentage: 50 } })), false);
  assert.equal(Boolean(isPlayed({ Type: 'BoxSet', UserData: { Played: true } })), false);
  // shuffle keeps every element
  const arr = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual([...J.shuffle([...arr])].sort((a, b) => a - b), arr);
});

test('vendor copies are the ones content-recommender uses (when both repositories are checked out side by side)', (t) => {
  const cr = path.join(ROOT, '..', 'content-recommender', 'js', 'vendor');
  if (!fs.existsSync(cr)) return t.skip('content-recommender not checked out next to this repository');
  for (const f of ['jellyfin.js', 'windowsHandle.js']) {
    assert.equal(fs.readFileSync(path.join(cr, f), 'utf8'), read(path.join('js', f)), `content-recommender/js/vendor/${f} differs from js/${f}`);
  }
});
