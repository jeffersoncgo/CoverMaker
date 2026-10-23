// Full render pipeline check (layout + image effects + text layers) through drawComposite.
// Usage: node pipeline.js <out.json> <baseUrl>
// Prints a pixel signature per scenario so the original and the fixed app can be compared.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const fs = require('fs');
const out = process.argv[2] || 'pipeline.json';
const BASE = process.argv[3] || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED|Fetch error|offline/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await sleep(8000);

  await page.evaluate(async () => {
    window.__imgs = [];
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas'); c.width = 600 + i * 50; c.height = 900 - i * 40;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, c.width, c.height); g.addColorStop(0, `hsl(${i * 60},70%,40%)`); g.addColorStop(1, `hsl(${i * 60 + 90},70%,70%)`);
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff'; x.font = 'bold 200px Arial'; x.fillText(String(i), 100, 400);
      const img = new Image(); img.src = c.toDataURL(); await img.decode(); window.__imgs.push(img);
    }
    window.__sig = () => {
      const c = document.getElementById('myCanvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261; for (let i = 0; i < d.length; i += 4 * 7) { h ^= d[i] | (d[i + 1] << 8) | (d[i + 2] << 16); h = Math.imul(h, 16777619) >>> 0; }
      return `${h.toString(16)}:${c.width}x${c.height}`;
    };
    window.__sigOf = (c) => {
      if (!c) return null;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261; for (let i = 0; i < d.length; i += 4 * 7) { h ^= d[i] | (d[i + 1] << 8) | (d[i + 2] << 16); h = Math.imul(h, 16777619) >>> 0; }
      return `${h.toString(16)}:${c.width}x${c.height}`;
    };
    window.__layer = (text, effects) => ({
      font: { family: 'Arial', weight: 'bold', style: 'normal', size: 220, color: '#ffffff', opacity: 1 },
      position: { textAlign: 'center', textBaseline: 'middle', x: 0, y: 0, rotation: 0 },
      id: 'layer_t_' + text, overlayText: text, enabled: true,
      fontStyle: 'normal bold 220px "Arial"', fillStyle: 'rgba(255, 255, 255, 1)', effects,
    });
    window.__apply = async (cfg) => {
      slotsImages.length = 0; window.__imgs.slice(0, cfg.images ?? 4).forEach(i => slotsImages.push(i));
      projectConfig.canvas.composite = { type: cfg.type || 'grid', params: cfg.params || {}, enabled: cfg.enabled !== false };
      projectConfig.canvas.effects = cfg.effects || [];
      projectConfig.textLayers = cfg.text || [];
      projectConfig.canvas.backgroundColor = cfg.bg || '#000000';
      drawComposite();
      await new Promise(r => setTimeout(r, 2500));
      return window.__sig();
    };
  });

  const scenarios = {
    'grid, no effects, no text': { type: 'grid' },
    'line defaults + vignette': { type: 'line', effects: [{ type: 'vignette', enabled: true, params: { intensity: 0.78 } }] },
    'grid + 2 effects + text with 2 effects': {
      type: 'grid',
      effects: [{ type: 'vignette', enabled: true, params: { intensity: 0.5 } }, { type: 'grayscale', enabled: true, params: {} }],
      text: ['__L1'],
    },
    'mosaic + 2 text layers': { type: 'mosaic', text: ['__L1', '__L2'] },
    'background color red, grid 1 image': { type: 'grid', images: 1, bg: '#ff0000' },
  };
  const R = { scenarios: {}, checks: {} };
  const resolve = async (cfg) => page.evaluate(async (cfg) => {
    const L1 = window.__layer('MOVIES', [{ type: 'outline', enabled: true, params: { color: '#000000', thickness: 10 } }, { type: 'longShadow', enabled: true, params: { color: '#000000', blur: 2, length: 48, angle: 43, opacity: 1 } }]);
    const L2 = { ...window.__layer('SHOWS', [{ type: 'outline', enabled: true, params: { color: '#ff0000', thickness: 6 } }]), position: { textAlign: 'left', textBaseline: 'top', x: -500, y: -300, rotation: 0 } };
    cfg.text = (cfg.text || []).map(t => t === '__L1' ? L1 : L2);
    return window.__apply(cfg);
  }, cfg);
  for (const [name, cfg] of Object.entries(scenarios)) {
    R.scenarios[name] = await resolve(JSON.parse(JSON.stringify(cfg)));
    console.log('SCN', name, R.scenarios[name]);
  }

  // Cache must not be mutated: A -> B (changed effect param) -> A gives the same pixels as the first A
  const A = scenarios['grid + 2 effects + text with 2 effects'];
  const B = JSON.parse(JSON.stringify(A)); B.effects[0].params.intensity = 0.95;
  const a1 = await resolve(JSON.parse(JSON.stringify(A)));
  const b1 = await resolve(B);
  const a2 = await resolve(JSON.parse(JSON.stringify(A)));
  R.checks['A->B->A same pixels, B differs'] = { ok: a1 === a2 && a1 !== b1, a1, b1, a2 };

  // Same check on the layout params
  const C = { type: 'grid', params: {} }; const D = { type: 'grid', params: { spacing: 40 } };
  const c1 = await resolve(C), d1 = await resolve(D), c2 = await resolve(C);
  R.checks['layout param change and back'] = { ok: c1 === c2 && c1 !== d1, c1, d1, c2 };

  // Text effect param change and back
  const E = { type: 'grid', text: ['__L1'] };
  const e1 = await resolve(JSON.parse(JSON.stringify(E)));
  const f1 = await page.evaluate(async () => { projectConfig.textLayers[0].effects[0].params.thickness = 30; drawComposite(); await new Promise(r => setTimeout(r, 2500)); return window.__sig(); });
  const e2 = await resolve(JSON.parse(JSON.stringify(E)));
  R.checks['text effect param change and back'] = { ok: e1 === e2 && e1 !== f1, e1, f1, e2 };

  // Composite disabled: background + text still render (CM-03)
  const off = await resolve({ type: 'grid', enabled: false, text: ['__L1'] });
  const offNoText = await resolve({ type: 'grid', enabled: false, bg: '#123456' });
  R.checks['composite disabled still renders text'] = { ok: off !== offNoText, off, offNoText };

  // Rapid changes: the final picture equals a calm render of the last config (CM-14)
  const rapid = await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) {
      projectConfig.canvas.effects = [{ type: 'vignette', enabled: true, params: { intensity: 0.1 + i * 0.07 } }];
      drawComposite();
      await new Promise(r => setTimeout(r, 30 + (i % 3) * 60));
    }
    await new Promise(r => setTimeout(r, 3000));
    const fast = window.__sig();
    clearStepsCache();
    drawComposite();
    await new Promise(r => setTimeout(r, 3000));
    return { fast, calm: window.__sig() };
  });
  R.checks['rapid edits end on last config'] = { ok: rapid.fast === rapid.calm, ...rapid };

  // Merged holds the final picture with and without text (export uses it)
  const merged = await page.evaluate(async () => {
    const out = {};
    for (const withText of [false, true]) {
      projectConfig.textLayers = withText ? [window.__layer('MERGED', [])] : [];
      drawComposite(); await new Promise(r => setTimeout(r, 2500));
      out[withText ? 'text' : 'noText'] = { main: window.__sig(), merged: window.__sigOf(window.Composites?.Merged) };
    }
    return out;
  });
  R.checks['Composites.Merged equals canvas'] = { ok: merged.text.main === merged.text.merged && merged.noText.main === merged.noText.merged, ...merged };

  R.cacheSize = await page.evaluate(() => stepsCache.filter(Boolean).length);
  R.errors = errors;
  for (const [k, v] of Object.entries(R.checks)) console.log(v.ok ? 'PASS' : 'FAIL', k, JSON.stringify(v));
  console.log('cache entries', R.cacheSize, 'errors', JSON.stringify(errors));
  fs.writeFileSync(out, JSON.stringify(R, null, 1));
  await browser.close();
})();
