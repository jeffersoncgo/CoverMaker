// End-to-end flow check for CoverMaker. Records which user flows work, so every fix can be compared to it.
// Usage: node e2e.js <out.json> [baseUrl]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const fs = require('fs');
const out = process.argv[2] || 'e2e.json';
const BASE = process.argv[3] || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs] });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.replace(/\/$/, '') });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  let errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  const known = s => /ERR_CONNECTION_REFUSED|Fetch error: undefined|Fetch error: Failed to fetch|Server is offline/.test(s); // no Jellyfin at localhost:8096 during the test

  const hash = () => page.evaluate(() => {
    const c = document.getElementById('myCanvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261; for (let i = 0; i < d.length; i += 4 * 13) { h ^= d[i] | (d[i + 1] << 8) | (d[i + 2] << 16); h = Math.imul(h, 16777619) >>> 0; }
    return `${h.toString(16)}:${c.width}x${c.height}`;
  });
  const results = {};
  const step = async (name, fn) => {
    errors = [];
    let ok = false, detail;
    try { detail = await fn(); ok = detail?.ok !== false; } catch (e) { detail = { exception: e.message.split('\n')[0].slice(0, 200) }; }
    const newErrors = errors.filter(e => !known(e));
    results[name] = { ...(typeof detail === 'object' ? detail : { detail }), ok: ok && newErrors.length === 0, errors: newErrors };
    console.log((results[name].ok ? 'PASS ' : 'FAIL ') + name, JSON.stringify(results[name]).slice(0, 220));
  };
  const changes = async (action, wait = 1500) => { const a = await hash(); await action(); await sleep(wait); const b = await hash(); return { ok: a !== b, before: a, after: b }; };

  const download = async (selector) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(selector)]);
    const p = await d.path(); return { name: d.suggestedFilename(), size: fs.statSync(p).size, path: p };
  };
  // Compares an exported PNG with what the visible canvas shows right now.
  const matchesCanvas = (file) => page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.getElementById('myCanvas');
    if (img.naturalWidth !== c.width || img.naturalHeight !== c.height) return { same: false, why: 'size' };
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(img, 0, 0);
    const a = t.getContext('2d').getImageData(0, 0, c.width, c.height).data, b = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let diff = 0; for (let i = 0; i < a.length; i += 4 * 11) if (Math.abs(a[i] - b[i]) > 2) diff++;
    return { same: diff === 0, diffSamples: diff };
  }, fs.readFileSync(file).toString('base64'));

  // First-session persistence uses its own clean browser profile.
  await step('persistence: first session survives reload', async () => {
    const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage();
    await p2.goto(BASE + 'index.html', { waitUntil: 'load' }); await sleep(8000);
    await p2.evaluate(async () => { addTextLayer(); await new Promise(r => setTimeout(r, 1500)); const i = document.querySelector('.overlayText-input'); i.value = 'FIRST SESSION'; i.dispatchEvent(new Event('input', { bubbles: true })); typeSelectElement.value = 'grid'; changeCompositeType({ target: typeSelectElement }); });
    await sleep(5000); await p2.reload({ waitUntil: 'load' }); await sleep(8000);
    const r = await p2.evaluate(() => ({ texts: projectConfig.textLayers.map(l => l.overlayText), type: projectConfig.canvas.composite.type }));
    await ctx2.close();
    return { ...r, ok: r.texts.includes('FIRST SESSION') && r.type === 'grid' };
  });

  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await sleep(9000);
  await step('export: image download at startup matches canvas', async () => { const d = await download('#exportBtn'); const m = await matchesCanvas(d.path); return { ...m, ok: m.same }; });

  await step('startup: 4 demo slots loaded', () => page.evaluate(() => ({ ok: slotsImages.filter(Boolean).length === 4, slots: slotsImages.length })));
  await step('startup: default text layer present', () => page.evaluate(() => ({ ok: projectConfig.textLayers.length > 0, layers: projectConfig.textLayers.length })));

  await step('slots: add slot', () => page.evaluate(() => { const n = slotsImages.length; addImageSlot(); return { ok: slotsImages.length === n + 1 && imageSlots.children.length === n + 1 }; }));
  await step('slots: delete slot', () => page.evaluate(() => { const n = slotsImages.length; deleteImageSlot(n - 1); return { ok: slotsImages.length === n - 1 }; }));
  await step('slots: reverse order changes canvas', () => changes(() => page.evaluate(() => moveSlotsReverse())));
  await step('slots: move slot down changes canvas', () => changes(() => page.evaluate(() => moveImageSlot(0, 1))));
  await step('slots: pin + shuffle keeps pinned slot', () => page.evaluate(() => {
    const pinBtn = getSlotByIndex(0).querySelector('.pin-button'); pinSlot(pinBtn);
    const first = slotsImages[0]; for (let i = 0; i < 5; i++) moveSlotsRandomly();
    const kept = slotsImages[0] === first; unpinSlot(pinBtn); return { ok: kept };
  }));
  await step('slots: unique slot ids after delete+add', () => page.evaluate(() => {
    addImageSlot(); deleteImageSlot(1); addImageSlot();
    const ids = [...imageSlots.children].map(s => s.id); const ok = new Set(ids).size === ids.length;
    while (slotsImages.length > 4) deleteImageSlot(slotsImages.length - 1);
    return { ok, ids };
  }));

  await step('text: add text layer', () => page.evaluate(async () => { const n = projectConfig.textLayers.length; addTextLayer(); await new Promise(r => setTimeout(r, 1500)); return { ok: projectConfig.textLayers.length === n + 1, layers: projectConfig.textLayers.length }; }));
  await step('text: editing text changes canvas', () => changes(() => page.evaluate(() => { const i = document.querySelector('.overlayText-input'); i.value = 'E2E TEXT'; i.dispatchEvent(new Event('input', { bubbles: true })); }), 4000));
  await step('text: add text effect (outline) changes canvas', () => changes(() => page.evaluate(() => addTextEffectToLayer(0, { type: 'outline' })), 4000));
  await step('text: text effect param changes canvas', () => changes(() => page.evaluate(() => {
    const s = document.querySelector('.text-effect-layer-item .effect-param-slider[data-param-key="thickness"]');
    s.value = String(Number(s.max)); s.dispatchEvent(new Event('input', { bubbles: true }));
  }), 4000));
  await step('text: duplicate layer', () => page.evaluate(async () => {
    const n = projectConfig.textLayers.length;
    document.querySelector('.duplicate-layer-btn').click(); await new Promise(r => setTimeout(r, 2500));
    return { ok: projectConfig.textLayers.length === n + 1, layers: projectConfig.textLayers.length };
  }));
  await step('text: delete layer', () => page.evaluate(async () => {
    const n = projectConfig.textLayers.length;
    [...document.querySelectorAll('.delete-layer-btn')].at(-1).click(); await new Promise(r => setTimeout(r, 2500));
    return { ok: projectConfig.textLayers.length === n - 1, layers: projectConfig.textLayers.length };
  }));
  await step('text: copy/paste effects between layers', () => page.evaluate(async () => {
    addTextLayer(); await new Promise(r => setTimeout(r, 1500));
    const items = document.querySelectorAll('.text-layer-item');
    items[0].querySelector('.copy-text-effect-btn').click(); await new Promise(r => setTimeout(r, 800));
    const before = projectConfig.textLayers.at(-1).effects.length;
    items[items.length - 1].querySelector('.paste-text-effect-btn').click(); await new Promise(r => setTimeout(r, 2500));
    const after = projectConfig.textLayers.at(-1).effects.length;
    [...document.querySelectorAll('.delete-layer-btn')].at(-1).click(); await new Promise(r => setTimeout(r, 1500));
    return { ok: after > before, before, after };
  }));

  await step('composite: change type changes canvas', () => changes(() => page.evaluate(() => { typeSelectElement.value = 'grid'; changeCompositeType({ target: typeSelectElement }); }), 2500));
  await step('composite: param changes canvas', () => changes(() => page.evaluate(() => {
    const s = document.querySelector('#typeSettingsContainer .effect-param-slider[data-param-key="spacing"]');
    s.value = String(Number(s.max)); s.dispatchEvent(new Event('input', { bubbles: true }));
  }), 2500));
  await step('image effect: add effect changes canvas', () => changes(() => page.evaluate(() => addImageEffectLayer()), 2500));
  await step('image effect: param changes canvas', () => changes(() => page.evaluate(() => {
    const idx = projectConfig.canvas.effects.length - 1;
    const s = document.querySelector(`#effect_${idx} .effect-param-slider[data-param-key]`);
    s.value = String(Number(s.max)); s.dispatchEvent(new Event('input', { bubbles: true }));
  }), 2500));
  await step('image effect: toggle off changes canvas', () => changes(() => page.evaluate(() => {
    const idx = projectConfig.canvas.effects.length - 1;
    const c = document.querySelector(`#effect_${idx} .effect-enabled-checkbox`); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true }));
  }), 2500));

  for (const [fmt, w, h] of [['poster', 1080, 1920], ['square', 1920, 1920], ['cover', 1920, 1080]]) {
    await step(`format: ${fmt} -> ${w}x${h}`, () => page.evaluate(async ([fmt, w, h]) => {
      RatioSelectElement.value = fmt; RatioSelectElement.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 1500));
      const c = document.getElementById('myCanvas'); return { ok: c.width === w && c.height === h, size: `${c.width}x${c.height}` };
    }, [fmt, w, h]));
  }
  await step('jellyfin thumbnail sizes unchanged', () => page.evaluate(() => ({ ok: Setup.Sizes.cover.width === 480 && Setup.Sizes.poster.height === 480, cover: Setup.Sizes.cover, poster: Setup.Sizes.poster })));

  await step('export: image download (with text)', async () => { const d = await download('#exportBtn'); const m = await matchesCanvas(d.path); return { name: d.name, ...m, ok: m.same }; });
  let zipPath;
  await step('export: project zip download', async () => { const d = await download('#exportProjectBtn'); zipPath = d.path; return { ok: d.size > 10000 && d.name.endsWith('.covermaker.zip'), name: d.name, size: d.size }; });
  let setupPath;
  await step('export: setup json download', async () => { const d = await download('#exportSetupBtn'); setupPath = d.path; return { ok: d.size > 100, name: d.name }; });
  let configPath;
  await step('export: config json download', async () => {
    await page.evaluate(() => { changeTab(window.Tabs.settings.tab); const c = document.getElementById('expandOptionsSettings'); if (!c.checked) c.click(); });
    await sleep(500);
    const d = await download('#exportConfigBtn'); configPath = d.path; return { ok: d.size > 100, name: d.name };
  });

  await step('import: project zip restores layers and images', async () => {
    const expected = await page.evaluate(() => ({ layers: projectConfig.textLayers.length, images: slotsImages.filter(Boolean).length, type: projectConfig.canvas.composite.type }));
    await page.evaluate(() => { deleteAllSlots(); });
    await page.setInputFiles('#importProjectInput', { name: 'e2e.covermaker.zip', mimeType: 'application/zip', buffer: fs.readFileSync(zipPath) });
    await sleep(6000);
    const got = await page.evaluate(() => ({ layers: projectConfig.textLayers.length, images: slotsImages.filter(Boolean).length, type: projectConfig.canvas.composite.type }));
    return { ok: JSON.stringify(got) === JSON.stringify(expected), expected, got };
  });
  await step('image effect: param changes canvas (after import)', () => changes(() => page.evaluate(() => {
    const idx = projectConfig.canvas.effects.findIndex(e => e.enabled !== false && EFFECTS_REGISTRY[e.type]?.params?.length);
    const s = document.querySelector(`#effect_${idx} .effect-param-slider[data-param-key]`);
    s.value = String((Number(s.max) + Number(s.min)) / 2); s.dispatchEvent(new Event('input', { bubbles: true }));
  }), 2500));
  await step('import: setup json applies layout', async () => {
    await page.setInputFiles('#importProjectInput', { name: 'e2e.covermaker.setup.json', mimeType: 'application/json', buffer: fs.readFileSync(setupPath) });
    await sleep(3000);
    return page.evaluate(() => ({ ok: projectConfig.textLayers.length > 0, layers: projectConfig.textLayers.length }));
  });
  await step('import: config json accepted', async () => {
    const before = await page.evaluate(() => document.querySelectorAll('.toast').length);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#importConfigBtn')]);
    await chooser.setFiles({ name: 'covermaker-config.json', mimeType: 'application/json', buffer: fs.readFileSync(configPath) });
    await sleep(1500);
    const texts = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent.trim()));
    return { ok: texts.some(t => /Config imported successfully/.test(t)) && !texts.some(t => /Invalid config/.test(t)), toasts: texts.slice(-2), before };
  });

  await step('export: image download (no text layers)', async () => {
    await page.evaluate(async () => { clearTextLayersMemory(); await new Promise(r => setTimeout(r, 1500)); });
    await sleep(2000); const d = await download('#exportBtn'); const m = await matchesCanvas(d.path); return { ...m, ok: m.same };
  });

  await step('gallery: renders all cards', async () => {
    await page.click('#openGalleryBtn'); await sleep(1500);
    return page.evaluate(() => ({ ok: document.querySelectorAll('.gallery-card').length === 11, cards: document.querySelectorAll('.gallery-card').length }));
  });
  await step('gallery: search filters', () => page.evaluate(async () => {
    const i = document.getElementById('gallerySearch'); i.value = 'lego'; i.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 600)); const n = document.querySelectorAll('.gallery-card').length;
    i.value = ''; i.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 600));
    return { ok: n === 2, lego: n };
  }));
  for (const id of ['war-metal', 'series-rough']) {
    await step(`gallery: full project ${id}`, async () => {
      const item = await page.evaluate(async (id) => (await (await fetch('gallery/gallery.json')).json()).find(i => i.id === id), id);
      await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
      await page.evaluate(async (url) => { await useFullProject(url); }, item.project);
      // Toasts disappear after a few seconds: watch them while waiting instead of looking once at the end
      let imported = false;
      for (let t = 0; t < 10; t++) { await sleep(500); imported ||= await page.evaluate(() => [...document.querySelectorAll('.toast')].some(t => /Project imported successfully/.test(t.textContent))); }
      return page.evaluate((imported) => ({ ok: imported && projectConfig.textLayers.length > 0, images: slotsImages.filter(Boolean).length, layers: projectConfig.textLayers.length, toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent.trim()).slice(-1) }), imported);
    });
  }
  await step('gallery: setup json (animes-manga)', async () => {
    await page.evaluate(async () => { await useSetup('gallery/projects/animes-manga/project.json'); }); await sleep(3000);
    return page.evaluate(() => ({ ok: projectConfig.canvas.composite.type === 'collage', type: projectConfig.canvas.composite.type }));
  });

  await step('persistence: reload keeps text layers', async () => {
    await page.evaluate(async () => { addTextLayer(); await new Promise(r => setTimeout(r, 1500)); const i = [...document.querySelectorAll('.overlayText-input')].at(-1); i.value = 'PERSIST'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(5000);
    await page.reload({ waitUntil: 'load' }); await sleep(9000);
    return page.evaluate(() => ({ ok: projectConfig.textLayers.some(l => l.overlayText === 'PERSIST'), texts: projectConfig.textLayers.map(l => l.overlayText) }));
  });

  await step('ui: open composite in new tab', async () => {
    const [popup] = await Promise.all([context.waitForEvent('page', { timeout: 8000 }), page.click('#openTabBtn')]);
    const url = popup.url(); await popup.close(); return { ok: url.startsWith('blob:'), url: url.slice(0, 30) };
  });

  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  const pass = Object.values(results).filter(r => r.ok).length;
  console.log(`\n${pass}/${Object.keys(results).length} passed`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
