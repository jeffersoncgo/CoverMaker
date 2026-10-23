// Visual baseline: pixel signature of every layout / image effect / text effect with fixed inputs.
// Usage: node render_baseline.js <out.json> [baseUrl]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const proxyArgs = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const out = process.argv[2] || 'render.json';
const base = process.argv[3] || 'http://127.0.0.1:8765/index.html';
(async () => {
  const browser = await chromium.launch({ args: [...proxyArgs] });
  const page = await browser.newPage();
  page.setDefaultTimeout(900000);
  await page.goto(base, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  const res = await page.evaluate(async () => {
    const imgs = [];
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('canvas'); c.width = 600 + i * 50; c.height = 900 - i * 40;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, c.width, c.height); g.addColorStop(0, `hsl(${i * 60},70%,40%)`); g.addColorStop(1, `hsl(${i * 60 + 90},70%,70%)`);
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff'; x.font = 'bold 200px Arial'; x.fillText(String(i), 100, 400);
      const img = new Image(); img.src = c.toDataURL(); await img.decode(); imgs.push(img);
    }
    const sig = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4 * 7) { h ^= d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
    const defaults = def => Object.fromEntries((def.params || []).filter(p => p.key).map(p => [p.key, p.default]));
    const R = { composites: {}, imageEffects: {}, textEffects: {} };
    const runComposite = async (id, def, n) => {
      const cv = createCanvas(1920, 1080); const ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1920, 1080);
      try { await def.apply(ctx, cv, imgs.slice(0, n), defaults(def), new AbortController().signal, { srcOnly: [] }, {}); return sig(cv); } catch (e) { return 'ERR ' + e.message; }
    };
    for (const [id, def] of Object.entries(COMPOSITE_REGISTRY)) for (const n of [1, 2, 6]) {
      const a = await runComposite(id, def, n), b = await runComposite(id, def, n);
      R.composites[`${id}@${n}`] = { sig: a, deterministic: a === b };
    }
    const runImg = async (def) => {
      const cv = createCanvas(1920, 1080); const ctx = cv.getContext('2d'); ctx.drawImage(imgs[2], 0, 0, 1920, 1080);
      try { await def.apply(ctx, cv, defaults(def), new AbortController().signal, {}); return sig(cv); } catch (e) { return 'ERR ' + e.message; }
    };
    for (const [id, def] of Object.entries(EFFECTS_REGISTRY)) { const a = await runImg(def), b = await runImg(def); R.imageEffects[id] = { sig: a, deterministic: a === b }; }
    const runTxt = async (id, def) => {
      const b = await createBaseTextLayer(1920, 1080, 'MOVIES', { textAlign: 'center', textBaseline: 'middle', x: 0, y: 0, rotation: 0 }, 'normal bold 300px "Arial"', 'rgba(255,255,255,1)');
      try { const r = await applyTextEffect(b.ctx, b.canvas, 'MOVIES', b.meta.x, b.meta.y, defaults(def), new AbortController().signal, { type: id }); return sig(r?.canvas || b.canvas); } catch (e) { return 'ERR ' + e.message; }
    };
    for (const [id, def] of Object.entries(TEXT_EFFECTS)) { const a = await runTxt(id, def), b = await runTxt(id, def); R.textEffects[id] = { sig: a, deterministic: a === b }; }
    return R;
  });
  require('fs').writeFileSync(out, JSON.stringify(res, null, 1));
  const nd = Object.entries(res).flatMap(([k, v]) => Object.entries(v).filter(([, x]) => !x.deterministic).map(([id]) => `${k}.${id}`));
  const err = Object.entries(res).flatMap(([k, v]) => Object.entries(v).filter(([, x]) => String(x.sig).startsWith('ERR')).map(([id, x]) => `${k}.${id}: ${x.sig}`));
  console.log('items:', Object.fromEntries(Object.entries(res).map(([k, v]) => [k, Object.keys(v).length])));
  console.log('non-deterministic:', nd.join(', ') || 'none');
  console.log('errors:', err.join(' | ') || 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
