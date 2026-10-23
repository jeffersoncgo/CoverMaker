// Phase 2 targeted checks (CM-11, CM-17, CM-19, CM-29, CM-30).
// Usage: node p2_checks.js <baseUrl>
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', e => { if (!/Server is offline/.test(e.message)) errors.push('PAGEERROR ' + e.message.slice(0, 200)); }); // known: CM-08 (phase 3)
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Fetch error|offline|Failed to load font|Failed to load CSS/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const R = {};
  const check = (name, v) => { R[name] = v; console.log(v.ok ? 'PASS' : 'FAIL', name, JSON.stringify(v).slice(0, 400)); };

  await page.goto(BASE + 'index.html', { waitUntil: 'load' });
  await sleep(9000);

  // CM-11: delete slot 1 of 4, add one, give every slot a distinct image, reload -> same images in the same order
  const before = await page.evaluate(async () => {
    deleteImageSlot(1); addImageSlot();
    const imgs = [];
    for (let i = 0; i < slotsImages.length; i++) {
      const c = document.createElement('canvas'); c.width = 60; c.height = 90;
      const x = c.getContext('2d'); x.fillStyle = `hsl(${i * 70},80%,50%)`; x.fillRect(0, 0, 60, 90);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const img = await loadImage(blob); slotsImages[i] = img; setSlotImage(i, img);
    }
    // a change event makes pageMemory save (same as the user editing something)
    const t = document.querySelector('.overlayText-input'); t.value = t.value + ' '; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 5000));
    return { ids: [...imageSlots.children].map(s => s.id), colors: slotsImages.map(i => { const c = document.createElement('canvas'); c.width = 1; c.height = 1; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3).join(','); }) };
  });
  await page.reload({ waitUntil: 'load' }); await sleep(10000);
  const after = await page.evaluate(() => ({ ids: [...imageSlots.children].map(s => s.id), colors: [...imageSlots.children].map(s => { const p = s.querySelector('.preview'); if (!p?.complete || !p.naturalWidth) return null; const c = document.createElement('canvas'); c.width = 1; c.height = 1; const x = c.getContext('2d'); x.drawImage(p, 0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3).join(','); }) }));
  check('CM-11 slot images restored in order after delete+add+reload', { ok: JSON.stringify(before.colors) === JSON.stringify(after.colors), before, after });

  // CM-17: rapid typing while a font loads slowly never duplicates layers
  const dup = await page.evaluate(async () => {
    const original = window.loadFont;
    window.loadFont = async (...a) => { await new Promise(r => setTimeout(r, 400)); return original(...a); };
    const n = document.querySelectorAll('.text-layer-item').length;
    const t = document.querySelector('.overlayText-input');
    for (let i = 0; i < 8; i++) { t.value = 'TYPE ' + i; updateTextSettings(); await new Promise(r => setTimeout(r, 120)); }
    await new Promise(r => setTimeout(r, 3000));
    window.loadFont = original;
    return { domLayers: n, configLayers: projectConfig.textLayers.length, text: projectConfig.textLayers[0]?.overlayText };
  });
  check('CM-17 rapid edits keep one config entry per layer', { ok: dup.domLayers === dup.configLayers && dup.text === 'TYPE 7', ...dup });

  // CM-29: Lightning and Waves with seed 0 render instead of throwing
  const seed0 = await page.evaluate(async () => {
    const out = {};
    for (const id of ['lightning', 'waves']) {
      const b = await createBaseTextLayer(800, 400, 'SEED', { textAlign: 'center', textBaseline: 'middle', x: 0, y: 0, rotation: 0 }, 'normal bold 120px "Arial"', 'rgba(255,255,255,1)');
      const defaults = Object.fromEntries((TEXT_EFFECTS[id].params || []).filter(p => p.key).map(p => [p.key, p.default]));
      try { await applyTextEffect(b.ctx, b.canvas, 'SEED', b.meta.x, b.meta.y, { ...defaults, seed: 0 }, new AbortController().signal, { type: id }); out[id] = 'ok'; } catch (e) { out[id] = 'ERR ' + e.message; }
    }
    return out;
  });
  check('CM-29 seed 0 does not throw', { ok: Object.values(seed0).every(v => v === 'ok'), ...seed0 });

  // CM-30: every section title of plasma/sauronFire is shown and no "undefined" key is stored
  const titles = await page.evaluate(async () => {
    const res = {};
    for (const id of ['plasma', 'sauronFire', 'chiseledMetal', 'engravedMetal']) {
      const schema = TEXT_EFFECTS[id].params || [];
      const expected = schema.filter(p => !p.key).map(p => p.label);
      const box = document.createElement('div'); document.body.appendChild(box);
      renderParamsOptions(box, schema, { undefined: '' }, {});
      const shownLabels = [...box.querySelectorAll('.effect-param-label')].map(l => l.textContent);
      const keys = [...box.querySelectorAll('[data-param-key]')].map(c => c.dataset.paramKey);
      res[id] = { expected, missing: expected.filter(t => !shownLabels.includes(t)), undefinedKey: keys.includes('undefined'), controls: keys.length, schemaKeys: schema.filter(p => p.key).length };
      box.remove();
    }
    return res;
  });
  check('CM-30 section titles shown, no "undefined" key', { ok: Object.values(titles).every(t => t.missing.length === 0 && !t.undefinedKey && t.controls === t.schemaKeys), titles });

  // CM-19: exporting a project whose last slots are empty and importing it back keeps every slot
  const zipRoundTrip = await page.evaluate(async () => {
    setSlots(6);
    for (let i = 0; i < 6; i++) { if (i < 3) continue; clearImageSlot(i); }
    const want = slotsImages.length;
    const zip = new JSZip();
    zip.file('project.json', makeSaveAllJson());
    const folder = zip.folder('images');
    for (let i = 0; i < slotsImages.length; i++) {
      if (!slotsImages[i]) continue;
      const c = document.createElement('canvas'); c.width = 20; c.height = 20; c.getContext('2d').drawImage(slotsImages[i], 0, 0, 20, 20);
      folder.file(`slot_${i}.png`, await new Promise(r => c.toBlob(r, 'image/png')));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'roundtrip.covermaker.zip');
    await importProjectFromZip(file);
    await new Promise(r => setTimeout(r, 2000));
    return { want, got: slotsImages.length, filled: slotsImages.filter(Boolean).length };
  });
  check('CM-19 zip import keeps trailing empty slots', { ok: zipRoundTrip.want === zipRoundTrip.got && zipRoundTrip.filled === 3, ...zipRoundTrip });

  check('no page errors', { ok: errors.length === 0, errors });
  await browser.close();
})();
