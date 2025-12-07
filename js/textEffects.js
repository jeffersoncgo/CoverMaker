/**
 * Text Effects System (Merged & Optimized)
 * Advanced visual effects for text rendering.
 * Operates on an already rendered text canvas (transparent bg).
 * Effect.apply signature: (textCtx, textCanvas, text, x, y, params)
 */

/* -------------------------
   1. Utilities & Helpers
   ------------------------- */

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Safer image data retrieval (prevents browser bounds errors)
function getImageDataSafe(ctx, x, y, w, h) {
  try {
    return ctx.getImageData(x, y, w, h);
  } catch (e) {
    const iw = ctx.canvas.width, ih = ctx.canvas.height;
    const nx = clamp(Math.floor(x), 0, iw), ny = clamp(Math.floor(y), 0, ih);
    const nw = clamp(Math.floor(w), 0, iw - nx), nh = clamp(Math.floor(h), 0, ih - ny);
    return ctx.getImageData(nx, ny, nw, nh);
  }
}

function createSeededRandom(seed) {
  if (seed == null || seed === '' || Number(seed) === 0) return null;
  let s = 0;
  const asNum = Number(seed);
  if (!Number.isNaN(asNum)) s = Math.floor(asNum) >>> 0;
  else {
    for (let i = 0; i < String(seed).length; i++) {
      s = ((s << 5) - s) + seed.charCodeAt(i);
      s |= 0;
    }
    s = s >>> 0;
  }
  return (function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(s || 1);
}

/* -------------------------
   2. Effect Registry
   ------------------------- */
const TEXT_EFFECTS = {
  opacity: {
    name: 'Opacity',
    params: [
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 1, step: 0.01, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const amount = clamp(params.amount ?? 1, 0, 1);
      const w = canvas.width, h = canvas.height;
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      tCtx.globalAlpha = amount;
      tCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  fade: {
    name: 'Fade',
    params: [
      { key: 'direction', label: 'Fade Side', type: 'select', options: ['top', 'bottom', 'left', 'right'], default: 'bottom' },
      { key: 'strength', label: 'Reach', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: 'endsAt', label: 'End Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      // Strength now controls "How far into the text the fade reaches"
      // 1.0 = Fades across the entire text (very smooth, invisible edge).
      // 0.2 = Only fades the very tip.
      const strength = clamp(params.strength ?? 0.6, 0, 1);
      const endsAt = clamp(params.endsAt ?? 0, 0, 1);
      const direction = params.direction ?? 'bottom';
      const w = canvas.width, h = canvas.height;

      const fadeCanvas = createCanvas(w, h);
      const fCtx = fadeCanvas.getContext('2d');

      // 1. Draw text first
      fCtx.drawImage(canvas, 0, 0);

      // 2. Composite mode to "Erase" using the gradient
      fCtx.globalCompositeOperation = 'destination-in';

      // 3. Define Gradient Direction
      let x0, y0, x1, y1;
      if (direction === 'bottom') { x0 = 0; y0 = 0; x1 = 0; y1 = h; }
      else if (direction === 'top') { x0 = 0; y0 = h; x1 = 0; y1 = 0; }
      else if (direction === 'right') { x0 = 0; y0 = 0; x1 = w; y1 = 0; }
      else { x0 = w; y0 = 0; x1 = 0; y1 = 0; }

      const grad = fCtx.createLinearGradient(x0, y0, x1, y1);

      // 4. Dynamic Stops for smoothness
      // We calculate the "Safe Zone" (where text remains 100% solid).
      // If strength is high, the safe zone is small (fade starts early).
      const solidRegion = 1 - strength;

      grad.addColorStop(0, 'rgba(0,0,0,1)'); // Start fully visible
      grad.addColorStop(Math.max(0, solidRegion), 'rgba(0,0,0,1)'); // Stay visible until fade starts
      grad.addColorStop(endsAt, 'rgba(0,0,0,0)'); // Always end completely transparent

      fCtx.fillStyle = grad;
      fCtx.fillRect(0, 0, w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(fadeCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  // ===========================================
  // LIGHTING & COLOR
  // ===========================================

  gradient: {
    name: 'Gradient',
    params: [
      { key: 'color1', label: 'Top Color', type: 'color', default: '#ff0000', group: 'Colors' },
      { key: 'color2', label: 'Bottom Color', type: 'color', default: '#0000ff', group: 'Colors' },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      // 1. Criar o canvas temporário para o gradiente
      const gradCanvas = createCanvas(canvas.width, canvas.height);
      const gCtx = gradCanvas.getContext('2d');
      const angle = (params.angle ?? 0) * (Math.PI / 180);

      // 2. Calcular geometria do gradiente
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const r = Math.max(canvas.width, canvas.height) / 2;
      const x1 = cx + Math.cos(angle + Math.PI) * r;
      const y1 = cy + Math.sin(angle + Math.PI) * r;
      const x2 = cx + Math.cos(angle) * r;
      const y2 = cy + Math.sin(angle) * r;

      // 3. Desenhar o Gradiente
      const grad = gCtx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, params.color1 ?? '#ff0000');
      grad.addColorStop(1, params.color2 ?? '#0000ff');

      gCtx.fillStyle = grad;
      gCtx.fillRect(0, 0, canvas.width, canvas.height);

      // 4. Recortar o gradiente usando o texto original como máscara
      // "destination-in" mantém o gradiente apenas onde o texto original existe
      gCtx.globalCompositeOperation = 'destination-in';
      gCtx.drawImage(canvas, 0, 0);

      // 5. Aplicar o Gradiente sobre o Original
      ctx.save();
      // Aqui aplicamos a opacidade apenas ao gradiente que será desenhado por cima
      ctx.globalAlpha = params.opacity ?? 1;
      // Desenha o gradiente POR CIMA do texto original existente
      // (Não usamos clearRect aqui, pois queremos misturar com a base se opacity < 1)
      ctx.drawImage(gradCanvas, 0, 0);
      ctx.restore();
      return { canvas, ctx, abortSignal};
    }
  },

  neon: {
    name: 'Neon',
    params: [
      { key: 'color', label: 'Glow Color', type: 'color', default: '#00ff00' },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 50, step: 0.1, default: 2 },
      { key: 'size', label: 'Spread', type: 'range', min: 0, max: 50, step: 1, default: 15 }
    ],

    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const glowColor = params.color ?? '#00ff00';
      const intensity = params.intensity ?? 2;
      const blurSize = params.size ?? 15;

      const w = canvas.width;
      const h = canvas.height;

      // --- 1. Create silhouette (solid white mask of the text) ---
      const mask = document.createElement('canvas');
      mask.width = w;
      mask.height = h;
      const mCtx = mask.getContext('2d');

      // Copy text
      mCtx.drawImage(canvas, 0, 0);

      // Fill text area with glow color
      mCtx.globalCompositeOperation = 'source-in';
      mCtx.fillStyle = glowColor;
      mCtx.fillRect(0, 0, w, h);

      // --- 2. Build glow spread using blur filter passes ---
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = w;
      glowCanvas.height = h;
      const gCtx = glowCanvas.getContext('2d');

      const passes = Math.max(1, Math.ceil(intensity * 2));

      for (let i = 0; i < passes; i++) {
        gCtx.filter = `blur(${blurSize}px)`;
        gCtx.globalAlpha = 1 / passes;       // even-powered accumulation
        gCtx.drawImage(mask, 0, 0);
      }

      gCtx.filter = 'none';
      gCtx.globalAlpha = 1;

      // --- 3. Draw original text on top (white core preserved) ---
      gCtx.globalCompositeOperation = 'source-over';
      gCtx.drawImage(canvas, 0, 0);

      // --- 4. Replace final output ---
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(glowCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  glowEdge: {
    name: 'Projection',
    params: [
      { key: 'radius', label: 'Radius', type: 'range', min: 1, max: 40, step: 1, default: 8 },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: 'color', label: 'Color', type: 'color', default: '#ffffff' }
    ],
    apply: (textCtx, textCanvas, text, x, y, params = {}, abortSignal) => {
      const rad = Math.max(1, Math.round(params.radius ?? 8));
      const intensity = clamp(params.intensity ?? 0.8, 0, 1);
      const color = params.color ?? '#fff';
      const w = textCanvas.width, h = textCanvas.height;

      const alphaCanvas = createCanvas(w, h);
      const actx = alphaCanvas.getContext('2d');
      actx.drawImage(textCanvas, 0, 0);
      const id = getImageDataSafe(actx, 0, 0, w, h);
      const out = new Uint8ClampedArray(id.data.length);

      // Extract alpha
      for (let i = 0; i < id.data.length; i += 4) {
        out[i] = out[i + 1] = out[i + 2] = 0;
        out[i + 3] = id.data[i + 3];
      }
      actx.putImageData(new ImageData(out, w, h), 0, 0);

      // Fast blur approximation
      const blurPasses = Math.max(1, Math.round(rad / 6));
      let blurCanvas = alphaCanvas;
      for (let p = 0; p < blurPasses; p++) {
        const b = createCanvas(w, h);
        const bctx = b.getContext('2d');
        const s = 1 - (rad / (rad + 20));
        const sw = Math.max(1, Math.round(w * s));
        const sh = Math.max(1, Math.round(h * s));
        bctx.imageSmoothingEnabled = true;
        bctx.drawImage(blurCanvas, 0, 0, w, h, 0, 0, sw, sh);
        bctx.drawImage(b, 0, 0, sw, sh, 0, 0, w, h);
        blurCanvas = b;
      }

      const glow = createCanvas(w, h);
      const gctx = glow.getContext('2d');
      gctx.globalAlpha = intensity;
      gctx.drawImage(blurCanvas, 0, 0);
      gctx.globalCompositeOperation = 'source-in';
      gctx.fillStyle = color;
      gctx.fillRect(0, 0, w, h);

      textCtx.save();
      textCtx.globalCompositeOperation = 'destination-over'; // Draw BEHIND text
      textCtx.drawImage(glow, 0, 0);
      textCtx.restore();
      return { canvas: textCanvas, ctx: textCtx, abortSignal };
    }
  },

  longShadow: {
    name: 'Shadow',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#000000', group: 'Appearance' },
      { key: 'length', label: 'Length', type: 'range', min: 0, max: 100, step: 1, default: 20, group: 'Geometry' },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 45, group: 'Geometry' },
      { key: 'blur', label: 'Blur', type: 'range', min: 0, max: 20, step: 1, default: 5, group: 'Appearance' },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 }
    ],

    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const length = params.length ?? 20;
      const maxBlur = params.blur ?? 5;
      const userOpacity = params.opacity ?? 0.5;
      const angleRad = (params.angle ?? 45) * (Math.PI / 180);
      const color = params.color ?? '#000000';

      // Final target
      const shadowCanvas = createCanvas(canvas.width, canvas.height);
      const sCtx = shadowCanvas.getContext('2d');

      // Silhouette (base)
      const silhouette = createCanvas(canvas.width, canvas.height);
      const siCtx = silhouette.getContext('2d');

      siCtx.drawImage(canvas, 0, 0);
      siCtx.globalCompositeOperation = 'source-in';
      siCtx.fillStyle = color;
      siCtx.fillRect(0, 0, canvas.width, canvas.height);

      // STEP RENDERING – isolated per-frame blur
      for (let i = 0; i <= length; i++) {

        // Each shadow step gets separate isolated canvas
        const pass = createCanvas(canvas.width, canvas.height);
        const pCtx = pass.getContext('2d');

        const t = i / length;
        const blur = t * maxBlur;

        // Blur silhouette copy
        pCtx.filter = `blur(${blur}px)`;
        pCtx.drawImage(silhouette, 0, 0);

        // Offset after blur
        const dx = Math.cos(angleRad) * i;
        const dy = Math.sin(angleRad) * i;

        // Opacity ramp: strong near the origin → fades out
        const alpha = userOpacity * (1 - t);

        sCtx.globalAlpha = alpha;
        sCtx.drawImage(pass, dx, dy);
      }

      // Restore alpha
      sCtx.globalAlpha = 1;

      // Draw original text on top
      sCtx.drawImage(canvas, 0, 0);

      // Output final composite
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(shadowCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },



  outline: {
    name: 'Outline',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#000000' },
      { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 100, step: 0.5, default: 3 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const thickness = params.thickness ?? 3;
      const color = params.color ?? '#000000';
      const tempCanvas = createCanvas(canvas.width, canvas.height);
      const tCtx = tempCanvas.getContext('2d');

      const silhouette = createCanvas(canvas.width, canvas.height);
      const siCtx = silhouette.getContext('2d');
      siCtx.drawImage(canvas, 0, 0);
      siCtx.globalCompositeOperation = 'source-in';
      siCtx.fillStyle = color;
      siCtx.fillRect(0, 0, canvas.width, canvas.height);

      const passes = Math.ceil(thickness * 2);
      for (let i = 0; i < 360; i += (360 / passes)) {
        const rad = i * (Math.PI / 180);
        tCtx.drawImage(silhouette, Math.cos(rad) * thickness, Math.sin(rad) * thickness);
      }
      tCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  // ===========================================
  // DISTORTION & TRANSFORMS
  // ===========================================

  glitch: {
    name: 'Glitch',
    params: [
      { key: 'offset', label: 'RGB Shift', type: 'range', min: 0, max: 20, step: 1, default: 5, group: 'Chromatic' },
      { key: 'sliceHeight', label: 'Slice Height', type: 'range', min: 2, max: 50, step: 1, default: 10, group: 'Slicing' },
      { key: 'sliceOffset', label: 'Slice Shift', type: 'range', min: 0, max: 50, step: 1, default: 10, group: 'Slicing' },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, step: 1, default: 0, group: 'Random' }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const offset = params.offset ?? 5;
      const sliceHeight = params.sliceHeight ?? 10;
      const sliceOffset = params.sliceOffset ?? 10;
      const seeded = createSeededRandom(params.seed);
      const rnd = seeded ? seeded : Math.random;
      const w = canvas.width, h = canvas.height;

      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      tCtx.globalCompositeOperation = 'screen';

      const drawChannel = (dx, color) => {
        const c = createCanvas(w, h);
        const cx = c.getContext('2d');
        cx.drawImage(canvas, dx, 0);
        cx.globalCompositeOperation = 'source-in';
        cx.fillStyle = color;
        cx.fillRect(0, 0, w, h);
        return c;
      }

      const red = drawChannel(-offset, '#ff0000');
      const blue = drawChannel(offset, '#0000ff');
      const green = drawChannel(0, '#00ff00');

      tCtx.clearRect(0, 0, w, h);
      tCtx.drawImage(red, 0, 0);
      tCtx.drawImage(green, 0, 0);
      tCtx.drawImage(blue, 0, 0);

      // Slicing
      const slicedCanvas = createCanvas(w, h);
      const sCtx = slicedCanvas.getContext('2d');
      for (let py = 0; py < h; py += sliceHeight) {
        const shift = (rnd() > 0.5 ? 1 : -1) * (rnd() * sliceOffset);
        const finalShift = rnd() > 0.3 ? shift : 0;
        sCtx.drawImage(tempCanvas, 0, py, w, sliceHeight, finalShift, py, w, sliceHeight);
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(slicedCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  chromatic: {
    name: 'Chromatic Aberration',
    params: [
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 20, step: 1, default: 4 },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 45 }
    ],
    apply: (textCtx, textCanvas, text, x, y, params = {}, abortSignal) => {
      const amt = params.amount ?? 4;
      const ang = ((params.angle ?? 45) * Math.PI) / 180;
      const dx = Math.round(Math.cos(ang) * amt);
      const dy = Math.round(Math.sin(ang) * amt);
      const w = textCanvas.width, h = textCanvas.height;
      const tmpR = createCanvas(w, h), tmpG = createCanvas(w, h), tmpB = createCanvas(w, h);
      const rctx = tmpR.getContext('2d'), gctx = tmpG.getContext('2d'), bctx = tmpB.getContext('2d');

      rctx.drawImage(textCanvas, 0, 0);
      gctx.drawImage(textCanvas, 0, 0);
      bctx.drawImage(textCanvas, 0, 0);

      const filterChannel = (ctx, r, g, b) => {
        const d = getImageDataSafe(ctx, 0, 0, w, h);
        for (let i = 0; i < d.data.length; i += 4) {
          if (!r) d.data[i] = 0;
          if (!g) d.data[i + 1] = 0;
          if (!b) d.data[i + 2] = 0;
        }
        ctx.putImageData(d, 0, 0);
      }

      filterChannel(rctx, 1, 0, 0);
      filterChannel(gctx, 0, 1, 0);
      filterChannel(bctx, 0, 0, 1);

      textCtx.clearRect(0, 0, w, h);
      textCtx.globalCompositeOperation = 'screen';
      textCtx.drawImage(tmpR, dx, dy);
      textCtx.drawImage(tmpG, 0, 0);
      textCtx.drawImage(tmpB, -dx, -dy);
      textCtx.globalCompositeOperation = 'source-over';
      return { canvas: textCanvas, ctx: textCtx, abortSignal };
    }
  },

  ripple: {
    name: 'Ripple',
    params: [
      { key: 'amplitude', label: 'Amplitude', type: 'range', min: 0, max: 60, step: 1, default: 8 },
      { key: 'frequency', label: 'Frequency', type: 'range', min: 0.1, max: 10, step: 0.1, default: 2.5 },
      { key: 'axis', label: 'Axis', type: 'select', options: ['x', 'y'], default: 'y' },
      { key: 'seed', label: 'Seed', type: 'range', min: -2147483648, max: 2147483647, step: 1, default: 0 }
    ],
    apply: (textCtx, textCanvas, text, x, y, params = {}, abortSignal) => {
      const amplitude = params.amplitude ?? 8;
      const freq = params.frequency ?? 2.5;
      const axis = params.axis ?? 'y';
      const seeded = createSeededRandom(params.seed);
      const rnd = seeded ?? Math.random;
      const w = textCanvas.width, h = textCanvas.height;
      const tmp = createCanvas(w, h), tctx = tmp.getContext('2d');
      tctx.drawImage(textCanvas, 0, 0);
      const src = getImageDataSafe(tctx, 0, 0, w, h).data;
      const out = new Uint8ClampedArray(src.length);

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const i = (py * w + px) * 4;
          if (axis === 'y') {
            const shift = Math.round(Math.sin((px / w) * Math.PI * freq + rnd() * 2 * Math.PI) * amplitude);
            const sy = clamp(py + shift, 0, h - 1);
            const si = (sy * w + px) * 4;
            out[i] = src[si]; out[i + 1] = src[si + 1]; out[i + 2] = src[si + 2]; out[i + 3] = src[si + 3];
          } else {
            const shift = Math.round(Math.sin((py / h) * Math.PI * freq + rnd() * 2 * Math.PI) * amplitude);
            const sx = clamp(px + shift, 0, w - 1);
            const si = (py * w + sx) * 4;
            out[i] = src[si]; out[i + 1] = src[si + 1]; out[i + 2] = src[si + 2]; out[i + 3] = src[si + 3];
          }
        }
      }
      tctx.putImageData(new ImageData(out, w, h), 0, 0);
      textCtx.clearRect(0, 0, w, h); textCtx.drawImage(tmp, 0, 0);
      return { canvas: textCanvas, ctx: textCtx, abortSignal };
    }
  },
  waves: {
    name: 'Waves',
    params: [
      { key: 'amplitude', label: 'Amplitude', type: 'range', min: 0, max: 60, step: 1, default: 8 },
      { key: 'frequency', label: 'Frequency', type: 'range', min: 0.1, max: 10, step: 0.1, default: 2.5 },
      { key: 'axis', label: 'Axis', type: 'select', options: ['x', 'y'], default: 'y' },
      { key: 'seed', label: 'Seed', type: 'range', min: -2147483648, max: 2147483647, step: 1, default: 0 }
    ],
    apply: (textCtx, textCanvas, text, x, y, params = {}, abortSignal) => {
      const w = textCanvas.width;
      const h = textCanvas.height;

      // 1. Get raw pixel data
      // Note: We use the existing context to get data, avoiding new canvas creation
      const imgData = textCtx.getImageData(0, 0, w, h);

      // 2. Create 32-bit views of the data
      // This allows us to move a whole pixel (RGBA) in one operation instead of 4
      const srcBuffer = new Uint32Array(imgData.data.buffer);
      const outBuffer = new Uint32Array(srcBuffer.length);

      const amplitude = params.amplitude ?? 8;
      const freq = params.frequency ?? 2.5;
      const axis = params.axis ?? 'y';

      // Use seed to shift the phase globally, rather than calculating random per pixel (which is slow and noisy)
      const seeded = typeof createSeededRandom === 'function' ? createSeededRandom(params.seed) : Math.random;
      const phaseShift = (seeded() * 2 * Math.PI);

      // 3. Pre-calculate the Wave Offsets (Lookup Table)
      // We only calculate sin() 'w' times or 'h' times, not 'w*h' times.
      const size = axis === 'y' ? w : h;
      const offsets = new Int16Array(size); // Int16 is enough for pixel offsets

      for (let i = 0; i < size; i++) {
        // We calculate the sine wave ONCE here
        const rawVal = Math.sin((i / size) * Math.PI * freq + phaseShift);
        offsets[i] = Math.round(rawVal * amplitude);
      }

      // 4. The Loop (Optimized)
      // No Math.sin, no Math.random, just array lookups and bit shifting
      if (axis === 'y') {
        // Vertical Wave (Pixel moves Up/Down based on X)
        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            // Get the pre-calculated shift for this column (px)
            const shift = offsets[px];

            // Fast Clamp logic
            let sy = py + shift;
            if (sy < 0) sy = 0;
            else if (sy >= h) sy = h - 1;

            // Copy 32-bit integer (RGBA)
            outBuffer[py * w + px] = srcBuffer[sy * w + px];
          }
        }
      } else {
        // Horizontal Wave (Pixel moves Left/Right based on Y)
        for (let py = 0; py < h; py++) {
          // Get shift for this row (py)
          const shift = offsets[py];

          for (let px = 0; px < w; px++) {
            let sx = px + shift;
            if (sx < 0) sx = 0;
            else if (sx >= w) sx = w - 1;

            outBuffer[py * w + px] = srcBuffer[py * w + sx];
          }
        }
      }

      // 5. Put data back
      // We write the modified buffer back into the ImageData object
      imgData.data.set(new Uint8ClampedArray(outBuffer.buffer));
      textCtx.putImageData(imgData, 0, 0);

      return { canvas: textCanvas, ctx: textCtx, abortSignal };
    }
  },

  pixelMatrix: {
    name: 'Pixelate',
    params: [
      { key: 'pixelSize', label: 'Size', type: 'range', min: 1, max: 64, step: 1, default: 8 }
    ],
    // We ignore 'text', 'x', and 'y' since we are manipulating existing pixels
    apply: (textCtx, textCanvas, text, x, y, params = {}, abortSignal) => {
      const psize = Math.max(1, Math.round(params.pixelSize ?? 8));

      // FIX 1: Access dimensions via the canvas object, not the context
      const w = textCtx.canvas.width;
      const h = textCtx.canvas.height;

      // Calculate scaled dimensions
      const sw = Math.ceil(w / psize);
      const sh = Math.ceil(h / psize);

      // Create a small buffer for the pixelation (Downscaling)
      const smallCanvas = createCanvas(sw, sh);
      const smallCtx = smallCanvas.getContext('2d');

      // Disable smoothing to ensure hard pixel edges
      smallCtx.imageSmoothingEnabled = false;
      textCtx.imageSmoothingEnabled = false;

      // FIX 2: Draw the CURRENT context content, not the passed 'textCanvas' argument
      // This prevents the "ghosting" or "second text" issue.
      smallCtx.drawImage(textCtx.canvas, 0, 0, w, h, 0, 0, sw, sh);

      // Clear the original context
      textCtx.clearRect(0, 0, w, h);

      // Draw the pixelated version back up (Upscaling)
      textCtx.drawImage(smallCanvas, 0, 0, sw, sh, 0, 0, w, h);

      return { canvas: textCanvas, ctx: textCtx, abortSignal };
    }
  },

  skew: {
    name: 'Skew',
    params: [
      { key: 'x', label: 'Skew X', type: 'range', min: -1, max: 1, step: 0.05, default: -0.2 },
      { key: 'y', label: 'Skew Y', type: 'range', min: -1, max: 1, step: 0.05, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const sx = params.x ?? -0.2;
      const sy = params.y ?? 0;
      const tempCanvas = createCanvas(canvas.width, canvas.height);
      const tCtx = tempCanvas.getContext('2d');

      tCtx.save();
      tCtx.translate(canvas.width / 2, canvas.height / 2);
      tCtx.transform(1, sy, sx, 1, 0, 0);
      tCtx.translate(-canvas.width / 2, -canvas.height / 2);
      tCtx.drawImage(canvas, 0, 0);
      tCtx.restore();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  flip: {
    name: 'Flip',
    params: [
      { key: 'axis', label: 'Axis', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Horizontal' }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const isVert = params.axis === 'Vertical';
      const tempCanvas = createCanvas(canvas.width, canvas.height);
      const tCtx = tempCanvas.getContext('2d');
      const w = canvas.width, h = canvas.height;

      tCtx.save();
      if (!isVert) {
        tCtx.translate(w, 0);
        tCtx.scale(-1, 1);
      } else {
        tCtx.translate(0, h);
        tCtx.scale(1, -1);
      }
      tCtx.drawImage(canvas, 0, 0);
      tCtx.restore();

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  // ===========================================
  // ARTISTIC & DAMAGE
  // ===========================================

  distress: {
    name: 'Texture',
    params: [
      {
        key: 'mode',
        label: 'Type',
        type: 'select',
        // Added 'wave' to the list
        options: [
          'noise', 'decay', 'scratch', 'rust',
          'mold', 'scanlines', 'fabric', 'glitch', 'vhs', 'burn',
          'halftone', 'paper', 'marble', 'wave'
        ],
        default: 'decay',
        group: 'Style'
      },
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5, group: 'Intensity' },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, default: 1, group: 'Random' }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const amount = params.amount ?? 0.5;
      const mode = params.mode ?? 'decay';

      const seeded = typeof createSeededRandom === 'function' ? createSeededRandom(params.seed) : null;
      const rnd = seeded ? seeded : Math.random;

      const w = canvas.width;
      const h = canvas.height;

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // PERFORMANCE: Skip empty pixels immediately
        if (data[i + 3] === 0) continue;

        let shouldRemove = false;
        const rVal = rnd();

        // Calculate coordinates 
        const pixelIndex = i / 4;
        const px = pixelIndex % w;
        const py = Math.floor(pixelIndex / w);

        // --- GROUP 1: Simple Randoms (Fastest) ---
        if (mode === 'noise') {
          if (rVal < amount * 0.4) shouldRemove = true;
        }
        else if (mode === 'scratch') {
          if (rnd() < 0.001) shouldRemove = true;
          if (rVal < amount * 0.1) shouldRemove = true;
        }

        // --- GROUP 2: Color Shifters ---
        else if (mode === 'rust') {
          if (rVal < amount) {
            data[i] = Math.min(255, data[i] + 60);
            data[i + 1] = Math.max(0, data[i + 1] - 40);
            data[i + 2] = Math.max(0, data[i + 2] - 80);
          }
          if (rVal < amount * 0.15) shouldRemove = true;
        }
        else if (mode === 'mold') {
          if (rVal < amount) {
            data[i] = Math.max(0, data[i] - 40);
            data[i + 1] = Math.min(255, data[i + 1] + 30);
            data[i + 2] = Math.max(0, data[i + 2] - 40);
          }
          const patch = Math.sin(px * 0.05) * Math.cos(py * 0.05);
          if (patch + rVal < amount * 0.5) shouldRemove = true;
        }
        else if (mode === 'burn') {
          if (rVal < amount) {
            data[i] *= 0.4;
            data[i + 1] *= 0.3;
            data[i + 2] *= 0.2;
          }
          if (rVal < amount * 0.3) shouldRemove = true;
        }
        else if (mode === 'vhs') {
          if (rVal < amount * 0.5) data[i] = 0;
          else if (rVal > 1 - (amount * 0.5)) data[i + 2] = 0;
          if (rnd() < amount * 0.05) shouldRemove = true;
        }
        else if (mode === 'glitch') {
          if (rVal < amount * 0.1) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
          }
          if ((px % 10 < 2 || py % 6 < 2) && rVal < amount * 0.3) {
            shouldRemove = true;
          }
        }

        // --- GROUP 3: Geometric / Pattern (Trig Heavy) ---
        else if (mode === 'decay') {
          const noise = (Math.sin(px * 0.1) + Math.cos(py * 0.1) + rVal) / 3;
          if (Math.abs(noise) < amount * 0.5) shouldRemove = true;
        }
        else if (mode === 'scanlines') {
          if (py % 3 === 0) {
            if (rVal < amount * 0.8) shouldRemove = true;
            else data[i + 3] = Math.max(0, data[i + 3] - 50);
          }
        }
        else if (mode === 'fabric') {
          const weave = Math.sin(px * 0.5) + Math.cos(py * 0.5);
          if (weave + rVal < amount) shouldRemove = true;
        }
        else if (mode === 'halftone') {
          const size = 6;
          const centerX = (Math.floor(px / size) * size) + size / 2;
          const centerY = (Math.floor(py / size) * size) + size / 2;
          const dist = Math.sqrt(Math.pow(px - centerX, 2) + Math.pow(py - centerY, 2));
          const radius = (size / 1.8) * (1 - (amount * 0.8));
          if (dist > radius) shouldRemove = true;
        }
        else if (mode === 'paper') {
          const grain = (Math.sin(px * 0.3) + Math.cos(py * 0.43) + Math.sin((px + py) * 0.7));
          if (grain + rVal < (amount * 4) - 2) shouldRemove = true;
        }
        else if (mode === 'marble') {
          const liquid = Math.sin(px * 0.02 + py * 0.01) + Math.cos(py * 0.03 - px * 0.01);
          if (Math.abs(liquid) < amount * 0.3) shouldRemove = true;
        }
        // NEW: Water damage / Dampness
        else if (mode === 'wave') {
          const wave = (Math.sin(px * 0.04 + rVal * 3) + Math.cos(py * 0.04 + rVal * 2)) * 0.5;
          if (wave < amount * 0.3) {
            data[i] *= 0.8;      // Darken Red
            data[i + 1] *= 0.85;   // Darken Green
            data[i + 2] *= 0.9;    // Darken Blue slightly less (damp feel)
          }
        }

        // Final Apply
        if (shouldRemove) data[i + 3] = 0;
      }

      ctx.putImageData(imageData, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  melt: {
    name: 'Melt',
    params: [
      { key: 'strength', label: 'Drip Length', type: 'range', min: 0, max: 100, step: 1, default: 20 },
      { key: 'chaos', label: 'Chaos', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const strength = params.strength ?? 20;
      const chaos = params.chaos ?? 0.5;
      const seeded = createSeededRandom(params.seed);
      const rnd = seeded ? seeded : Math.random;
      const w = canvas.width, h = canvas.height;

      // 1. Drip Map
      const dripMap = new Float32Array(w);
      let noiseVal = 0;
      for (let ix = 0; ix < w; ix++) {
        noiseVal += (rnd() - 0.5) * chaos * 10;
        if (noiseVal > strength) noiseVal = strength;
        if (noiseVal < 0) noiseVal = 0;
        if (rnd() > 0.98) noiseVal += rnd() * strength;
        dripMap[ix] = Math.abs(noiseVal);
      }

      // 2. Displacement
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      for (let ix = 0; ix < w; ix++) {
        const shift = dripMap[ix];
        if (shift < 1) tCtx.drawImage(canvas, ix, 0, 1, h, ix, 0, 1, h);
        else tCtx.drawImage(canvas, ix, 0, 1, h, ix, shift * 0.5, 1, h + shift);
      }

      // 3. Gooey Filter (Blur + Threshold)
      const gooCanvas = createCanvas(w, h);
      const gCtx = gooCanvas.getContext('2d');
      gCtx.filter = 'blur(4px)';
      gCtx.drawImage(tempCanvas, 0, 0);
      gCtx.filter = 'none';

      const iData = getImageDataSafe(gCtx, 0, 0, w, h);
      const data = iData.data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 100) data[i] = 0; // Cut transparent blur
        else data[i] = 255; // Solidify core
      }
      gCtx.putImageData(iData, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(gooCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  paintBrush: {
    name: 'Smudge',
    params: [
      { key: 'brushSize', label: 'Size', type: 'range', min: 1, max: 128, step: 1, default: 12 },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: 'iterations', label: 'Passes', type: 'range', min: 1, max: 20, step: 1, default: 6 },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, step: 1, default: 0 }
    ],
    apply: (textCtx, textCanvas, text, x, y, params = {}, abortSignal) => {
      const bsize = Math.max(1, (params.brushSize ?? 12) | 0);
      // Intensity: higher = more opaque smear
      const intensity = clamp(params.intensity ?? 0.6, 0, 1);
      const iters = Math.max(1, (params.iterations ?? 6) | 0);

      const seeded = createSeededRandom(params.seed);
      const rnd = seeded ?? Math.random;

      const w = textCanvas.width;
      const h = textCanvas.height;

      // Create a temporary canvas to read data safely
      const tmp = createCanvas(w, h);
      const tctx = tmp.getContext('2d');
      tctx.drawImage(textCanvas, 0, 0);

      // Get the pixel data once
      const src = tctx.getImageData(0, 0, w, h);
      const sD = src.data;

      // Pre-calculate loop step to avoid Math inside loop
      // If brush is huge, step is larger (performance gain)
      const stepBase = Math.max(2, bsize * 0.6);

      for (let iter = 0; iter < iters; iter++) {
        // Randomize grid start slightly for organic look
        const startY = (rnd() * stepBase) | 0;
        const startX = (rnd() * stepBase) | 0;

        for (let sy = startY; sy < h; sy += Math.max(2, (stepBase + rnd() * 2) | 0)) {
          for (let sx = startX; sx < w; sx += Math.max(2, (stepBase + rnd() * 2) | 0)) {

            // 1. GET COLOR (Optimized)
            // Instead of averaging neighbors (slow), just grab the center pixel.
            // It creates the same "smear" effect visually but instantly.
            const centerIdx = ((sy * w) + sx) << 2; // Bitwise shift for * 4

            // Skip transparent pixels (don't smudge nothingness)
            if (sD[centerIdx + 3] === 0) continue;

            const r = sD[centerIdx];
            const g = sD[centerIdx + 1];
            const b = sD[centerIdx + 2];
            const a = sD[centerIdx + 3];

            // 2. DEFINE BOUNDS (Optimized)
            // Calculate start/end X/Y here to avoid checking "if (x<0)" inside the loop
            const halfSize = (bsize / 2) | 0;
            const minX = Math.max(0, sx - halfSize);
            const maxX = Math.min(w, sx + halfSize);
            const minY = Math.max(0, sy - halfSize);
            const maxY = Math.min(h, sy + halfSize);

            // 3. SMEAR (Optimized)
            for (let py = minY; py < maxY; py++) {
              // Pre-calculate Y offset
              const yOffset = py * w;
              for (let px = minX; px < maxX; px++) {

                const di = (yOffset + px) << 2; // Index

                // Random noise for the brush texture
                const noise = intensity * rnd();

                // Simple Lerp (Linear Interpolation)
                // Note: Uint8ClampedArray handles rounding automatically, 
                // so we don't need Math.round() here.
                sD[di] = sD[di] + (r - sD[di]) * noise;
                sD[di + 1] = sD[di + 1] + (g - sD[di + 1]) * noise;
                sD[di + 2] = sD[di + 2] + (b - sD[di + 2]) * noise;
                sD[di + 3] = sD[di + 3] + (a - sD[di + 3]) * noise;
              }
            }
          }
        }
      }

      // Put data back
      tctx.putImageData(src, 0, 0);
      textCtx.clearRect(0, 0, w, h);
      textCtx.drawImage(tmp, 0, 0);

      return { canvas: textCanvas, ctx: textCtx, abortSignal };
    }
  },

  /**
 * Deterministic Lightning Effect for Text Canvas.
 * Usage: Add this object to your effects dictionary.
 */
  lightning: {
    name: 'Lightning',
    params: [
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      // Use a wide range for the seed so you can scroll through many variations
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 1000, step: 1, default: 123 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      // 3. Parameters
      const intensity = clamp(params.intensity ?? 0.6, 0, 1);
      const color = params.color ?? '#ffffff';
      const seedVal = params.seed ?? 123;

      // Initialize the deterministic random function
      const rnd = createSeededRandom(seedVal);

      const w = canvas.width;
      const h = canvas.height;

      // 4. Create separate layer for lightning
      const tmp = createCanvas(w, h);
      const tctx = tmp.getContext('2d');

      // Optional: Draw original text to temp if you want the text to "glow" with the lightning
      // If you only want lightning on top, comment this out:
      tctx.drawImage(canvas, 0, 0);

      const lines = Math.max(1, Math.round(1 + intensity * 12));

      tctx.lineCap = 'round';
      tctx.lineJoin = 'round';
      tctx.strokeStyle = color;
      tctx.lineWidth = Math.max(1, Math.min(4, 2 + intensity * 3));
      // Fade the lightning based on intensity
      tctx.globalAlpha = clamp(0.7 * intensity, 0, 1);

      // 5. Generate Bolts
      for (let i = 0; i < lines; i++) {
        const sx = Math.floor(rnd() * w);
        const sy = Math.floor(rnd() * h);
        const segments = 4 + Math.floor(rnd() * 8 * intensity);

        tctx.beginPath();
        tctx.moveTo(sx, sy);

        let cx = sx;
        let cy = sy;

        for (let s = 0; s < segments; s++) {
          // Use rnd() for every random decision
          cx += Math.floor((rnd() - 0.5) * 200 * intensity);
          cy += Math.floor((rnd() - 0.5) * 200 * intensity);
          tctx.lineTo(clamp(cx, 0, w), clamp(cy, 0, h));
        }
        tctx.stroke();
      }

      // 6. Blend back onto main canvas
      ctx.save();
      // 'lighter' blend mode makes the lightning glow against the background
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      return { canvas, ctx, abortSignal};
    }
  },
  /**
 * Adapted Scanlines effect for Text Canvas.
 * Usage: Add this object to your effects dictionary.
 */
  scanLines: {
    name: 'Scanlines',
    params: [
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.2 },
      { key: 'density', label: 'Density', type: 'range', min: 1, max: 10, step: 1, default: 8 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      // 1. Parse parameters with fallbacks
      const val = params.opacity ?? 0.2;
      const opacity = Math.min(Math.max(val, 0), 1);

      // Invert density logic: 
      // Higher density input (e.g. 10) -> Smaller spacing (e.g. 2) -> More lines
      const rawDensity = Math.max(1, Math.round(params.density ?? 8));
      const spacing = Math.max(2, 12 - rawDensity);

      const w = canvas.width;
      const h = canvas.height;

      // Optimization: Skip if invisible
      if (opacity <= 0) return;

      ctx.save();

      // CRITICAL: Lock drawing to existing pixels (the text).
      // This prevents the black lines from appearing in the transparent areas.
      ctx.globalCompositeOperation = 'source-atop';

      ctx.fillStyle = 'rgba(0, 0, 0, ' + opacity + ')';

      // Draw lines across the screen space using the calculated spacing
      for (let row = 0; row < h; row += spacing) {
        ctx.fillRect(0, row, w, 1);
      }

      ctx.restore();
      return { canvas, ctx, abortSignal};
    }
  },

  glassRefraction: {
    name: 'Glass Refraction',
    params: [
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 20, step: 1, default: 6 },
      { key: 'scale', label: 'Distortion Scale', type: 'range', min: 1, max: 10, step: 0.1, default: 3 },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, step: 1, default: 42 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const intensity = params.intensity ?? 6;
      const scale = params.scale ?? 3;
      const seeded = createSeededRandom(params.seed);
      const rnd = seeded ?? Math.random;

      const t = createCanvas(w, h);
      const c = t.getContext('2d');
      c.drawImage(canvas, 0, 0);

      const data = c.getImageData(0, 0, w, h);
      const src = data.data;
      const out = new Uint8ClampedArray(src.length);

      const turbulence = (x, y) =>
        Math.sin(x * 0.02 * scale + rnd() * 10) +
        Math.cos(y * 0.02 * scale + rnd() * 10);

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const dx = Math.round(turbulence(px, py) * intensity);
          const dy = Math.round(turbulence(py, px) * intensity);
          const sx = clamp(px + dx, 0, w - 1);
          const sy = clamp(py + dy, 0, h - 1);
          const si = (sy * w + sx) * 4;
          const di = (py * w + px) * 4;
          out[di] = src[si]; out[di + 1] = src[si + 1]; out[di + 2] = src[si + 2]; out[di + 3] = src[si + 3];
        }
      }

      c.putImageData(new ImageData(out, w, h), 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(t, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  vectorWarp: {
    name: 'Vector Warp',
    params: [
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 50, step: 1, default: 12 },
      { key: 'direction', label: 'Direction', type: 'select', options: ['left', 'right', 'up', 'down'], default: 'right' },
      { key: 'frequency', label: 'Frequency', type: 'range', min: 0.1, max: 10, step: 0.1, default: 3 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const amt = params.amount ?? 12;
      const freq = params.frequency ?? 3;
      const dir = params.direction ?? 'right';

      const t = createCanvas(w, h);
      const tc = t.getContext('2d');
      tc.drawImage(canvas, 0, 0);

      const src = tc.getImageData(0, 0, w, h);
      const s = src.data;
      const out = new Uint8ClampedArray(s.length);

      const warp = (v) => Math.sin(v * freq * 0.03) * amt;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sx = x, sy = y;

          const val = warp(dir === 'left' || dir === 'right' ? y : x);

          if (dir === 'right') sx += val;
          if (dir === 'left') sx -= val;
          if (dir === 'down') sy += val;
          if (dir === 'up') sy -= val;

          sx = clamp(sx | 0, 0, w - 1);
          sy = clamp(sy | 0, 0, h - 1);

          const si = (sy * w + sx) * 4;
          const di = (y * w + x) * 4;

          out[di] = s[si];
          out[di + 1] = s[si + 1];
          out[di + 2] = s[si + 2];
          out[di + 3] = s[si + 3];
        }
      }

      tc.putImageData(new ImageData(out, w, h), 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(t, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  reflection: {
    name: 'Reflection',
    params: [
      { key: 'offset', label: 'Distance', type: 'range', min: -1500, max: 1500, step: 1, default: 0 },
      { key: 'opacity', label: 'Start Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'scale', label: 'Height Scale', type: 'range', min: 0.1, max: 1, step: 0.1, default: 0.8 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const offset = params.offset ?? 0;
      const opacity = clamp(params.opacity ?? 0.5, 0, 1);
      const scaleY = params.scale ?? 0.8;
      const w = canvas.width, h = canvas.height;

      const refCanvas = createCanvas(w, h);
      const rCtx = refCanvas.getContext('2d');

      rCtx.save();
      rCtx.translate(0, h);
      rCtx.scale(1, -scaleY);
      rCtx.drawImage(canvas, 0, 0); // Draw original inverted
      rCtx.restore();

      rCtx.globalCompositeOperation = 'destination-in';
      const grad = rCtx.createLinearGradient(0, h - (h * scaleY), 0, h);
      grad.addColorStop(0, `rgba(0,0,0,${opacity})`); // Top of reflection (near text)
      grad.addColorStop(1, 'rgba(0,0,0,0)');         // Bottom of reflection (faded)
      rCtx.fillStyle = grad;
      rCtx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'destination-over'; // Draw behind existing text

      ctx.drawImage(refCanvas, 0, offset);
      ctx.restore();

      return { canvas, ctx, abortSignal};
    }
  },

  stereo: {
    name: '3D Anaglyph',
    params: [
      { key: 'offset', label: 'Separation', type: 'range', min: 0, max: 30, step: 1, default: 6 },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Red/Cyan', 'Green/Magenta'], default: 'Red/Cyan' }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const offset = params.offset ?? 6;
      const mode = params.mode ?? 'Red/Cyan';
      const w = canvas.width, h = canvas.height;

      const tR = createCanvas(w, h); // Left Eye
      const tL = createCanvas(w, h); // Right Eye

      const ctxR = tR.getContext('2d');
      const ctxL = tL.getContext('2d');

      ctxR.drawImage(canvas, 0, 0);
      ctxL.drawImage(canvas, 0, 0);

      // Channel Filtering function
      const isolateChannel = (targetCtx, keepR, keepG, keepB) => {
        targetCtx.globalCompositeOperation = 'source-in';
        targetCtx.fillStyle = `rgb(${keepR ? 255 : 0}, ${keepG ? 255 : 0}, ${keepB ? 255 : 0})`;
        targetCtx.fillRect(0, 0, w, h);
      };

      if (mode === 'Red/Cyan') {
        isolateChannel(ctxR, true, false, false); // Keep Red
        isolateChannel(ctxL, false, true, true);  // Keep Cyan (G+B)
      } else {
        isolateChannel(ctxR, false, true, false); // Keep Green
        isolateChannel(ctxL, true, false, true);  // Keep Magenta (R+B)
      }

      ctx.clearRect(0, 0, w, h);

      // Compose with screen blend mode for additive light
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(tL, -offset, 0); // Shift Left Channel
      ctx.drawImage(tR, offset, 0);  // Shift Right Channel

      // Restore standard composite
      ctx.globalCompositeOperation = 'source-over';

      return { canvas, ctx, abortSignal};
    }
  },

  stitch: {
    name: 'Embroidery',
    params: [
      { key: 'size', label: 'Stitch Size', type: 'range', min: 3, max: 12, step: 0.5, default: 4 }, // Min 3 to be safe
      { key: 'density', label: 'Density', type: 'range', min: 1, max: 4, step: 1, default: 2 },
      { key: 'color', label: 'Thread Color', type: 'color', default: '#ffffff' },
      { key: 'shadow', label: 'Shadow', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      // Prevent 0 or very small size causing infinite loops or memory crashes
      const size = Math.max(2.5, params.size ?? 4);
      const density = params.density ?? 2;
      const color = params.color ?? '#ffffff';
      const shadowAlpha = params.shadow ?? 0.5;

      const w = canvas.width, h = canvas.height;

      // Get Data for hit testing
      // We need to know where the text IS to draw stitches there.
      const srcData = ctx.getImageData(0, 0, w, h).data;

      // Robust Hit Test Function
      const isSolid = (tx, ty) => {
        // FLOORS are critical here. Arrays can't take float indexes.
        const xx = Math.floor(tx);
        const yy = Math.floor(ty);

        // Bounds check
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;

        // Alpha check (index = (y * w + x) * 4 + 3)
        const idx = (yy * w + xx) * 4 + 3;
        return srcData[idx] > 50; // Threshold
      };

      const stitchCanvas = createCanvas(w, h);
      const sCtx = stitchCanvas.getContext('2d');

      // Style setup
      sCtx.strokeStyle = color;
      sCtx.lineWidth = 1.5;
      sCtx.lineCap = 'round';
      sCtx.lineJoin = 'round';

      // Scan the grid
      for (let py = 0; py < h; py += size) {
        for (let px = 0; px < w; px += size) {

          // Sample the center of this grid block
          const cx = px + size / 2;
          const cy = py + size / 2;

          if (isSolid(cx, cy)) {
            sCtx.beginPath();

            // Variance creates the "messy" thread look
            const pad = size * 0.2;

            // Cross Stitch (X shape)
            // We repeat lines to simulate thread thickness/density
            for (let k = 0; k < density; k++) {
              // Jitter allows multiple threads to be seen
              const j = (k * 0.5);

              // Line 1: Top-Left to Bottom-Right
              sCtx.moveTo(px + pad + j, py + pad);
              sCtx.lineTo(px + size - pad + j, py + size - pad);

              // Line 2: Top-Right to Bottom-Left
              sCtx.moveTo(px + size - pad - j, py + pad);
              sCtx.lineTo(px + pad - j, py + size - pad);
            }
            sCtx.stroke();
          }
        }
      }

      // Add Shadow for depth (makes it pop off the bg)
      if (shadowAlpha > 0) {
        sCtx.globalCompositeOperation = 'source-atop';
        sCtx.shadowColor = 'black';
        sCtx.shadowBlur = 2;
        sCtx.shadowOffsetX = 1;
        sCtx.shadowOffsetY = 1;
        sCtx.stroke(); // Re-stroke to apply shadow
        sCtx.globalCompositeOperation = 'source-over';
      }

      // Replace original text with the stitches
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(stitchCanvas, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  pattern: {
    name: 'Pattern Fill',
    params: [
      { key: 'type', label: 'Style', type: 'select', options: ['Dots', 'Stripes', 'Checkers', 'Grid'], default: 'Stripes' },
      { key: 'size', label: 'Scale', type: 'range', min: 2, max: 50, step: 1, default: 6 },
      { key: 'color', label: 'Pattern Color', type: 'color', default: '#000000' },
      { key: 'bg', label: 'Keep Base', type: 'select', options: ['Yes', 'No'], default: 'Yes' } // If no, transparent holes
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const type = params.type ?? 'Stripes';
      const size = params.size ?? 6;
      const color = params.color ?? '#000000';
      const keepBase = params.bg === 'Yes';
      const w = canvas.width, h = canvas.height;

      // 1. Generate Pattern Tile
      const pCanvas = createCanvas(size * 2, size * 2);
      const pCtx = pCanvas.getContext('2d');

      pCtx.fillStyle = color;

      if (type === 'Dots') {
        pCtx.beginPath();
        pCtx.arc(size, size, size * 0.4, 0, Math.PI * 2);
        pCtx.fill();
      } else if (type === 'Stripes') {
        pCtx.beginPath();
        pCtx.moveTo(0, 0); pCtx.lineTo(size * 2, size * 2); // Diagonal
        pCtx.lineWidth = size * 0.5;
        pCtx.strokeStyle = color;
        pCtx.stroke();
      } else if (type === 'Checkers') {
        pCtx.fillRect(0, 0, size, size);
        pCtx.fillRect(size, size, size, size);
      } else if (type === 'Grid') {
        pCtx.strokeStyle = color;
        pCtx.lineWidth = Math.max(1, size * 0.1);
        pCtx.strokeRect(0, 0, size * 2, size * 2);
      }

      const pattern = ctx.createPattern(pCanvas, 'repeat');

      // 2. Apply Pattern
      const temp = createCanvas(w, h);
      const tCtx = temp.getContext('2d');

      // If we keep base, we draw the original text first
      if (keepBase) {
        tCtx.drawImage(canvas, 0, 0);
        tCtx.globalCompositeOperation = 'source-atop'; // Draw pattern ONLY on top of text pixels
      } else {
        // If not keeping base, we use the text as a mask for the pattern
        tCtx.drawImage(canvas, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
      }

      tCtx.fillStyle = pattern;
      tCtx.fillRect(0, 0, w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  crystallize: {
    name: 'Crystallize',
    params: [
      { key: 'size', label: 'Shard Size', type: 'range', min: 5, max: 100, step: 1, default: 20 },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const size = params.size ?? 20;
      const w = canvas.width, h = canvas.height;

      const seeded = createSeededRandom(params.seed);
      const rnd = seeded ? seeded : Math.random;

      // 1. Generate random points (Voronoi centers)
      const count = Math.floor((w * h) / (size * size)) * 2;
      const points = [];
      for (let i = 0; i < count; i++) {
        points.push({ x: rnd() * w, y: rnd() * h });
      }

      const srcData = ctx.getImageData(0, 0, w, h);
      const src = new Uint32Array(srcData.data.buffer);
      const outData = ctx.createImageData(w, h);
      const out = new Uint32Array(outData.data.buffer);

      // 2. Iterate pixels and find nearest point
      // Optimization: We scan in blocks to avoid checking ALL points for ALL pixels (slow)
      // For this simplified version, we'll check against a smaller subset or use a simple grid jitter

      // Faster approach: Block-based Jitter (Mosaic)
      for (let py = 0; py < h; py += size / 2) {
        for (let px = 0; px < w; px += size / 2) {

          // Random offset for this block
          const offX = (rnd() - 0.5) * size;
          const offY = (rnd() - 0.5) * size;

          // Center of the "shard"
          const cx = Math.floor(px + size / 4 + offX);
          const cy = Math.floor(py + size / 4 + offY);

          // Ensure valid sample
          const safeCX = clamp(cx, 0, w - 1);
          const safeCY = clamp(cy, 0, h - 1);

          const colorVal = src[safeCY * w + safeCX];

          // Fill a polygon-ish area (simulated by overlapping rects for speed)
          // or simple rects. For "Crystal", triangles are better but complex to rasterize here.
          // Let's stick to Voronoi approximation via nearest neighbor on a grid

          // Draw this color into the output block
          const bSize = Math.ceil(size);
          for (let by = 0; by < bSize; by++) {
            for (let bx = 0; bx < bSize; bx++) {
              const drawX = Math.floor(px + bx);
              const drawY = Math.floor(py + by);
              if (drawX < w && drawY < h) {
                // A simple distance check to make it look jagged/polygonal
                if (Math.random() > 0.3) { // Noise to break boxes
                  out[drawY * w + drawX] = colorVal;
                }
              }
            }
          }
        }
      }

      // Re-apply original alpha mask to clean up messy edges
      // This ensures the crystal effect doesn't spill outside the text shape too much
      // (Optional: remove this if you want an exploding look)
      for (let i = 0; i < src.length; i++) {
        if ((src[i] & 0xFF000000) === 0) out[i] = 0; // If original was transparent, keep transparent
      }

      outData.data.set(new Uint8ClampedArray(out.buffer));
      ctx.putImageData(outData, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  mosaic: {
    name: 'Mosaic',
    params: [
      { key: 'tileSize', label: 'Tile Size', type: 'range', min: 2, max: 64, step: 1, default: 16 },
      { key: 'randomness', label: 'Randomness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
      { key: 'colorVariation', label: 'Color Variation', type: 'range', min: 0, max: 1, step: 0.01, default: 0.2 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const tileSize = Math.max(2, params.tileSize ?? 16);
      const randomness = params.randomness ?? 0.3;
      const colorVariation = params.colorVariation ?? 0.2;
      const w = canvas.width, h = canvas.height;

      const mosaicCanvas = createCanvas(w, h);
      const mCtx = mosaicCanvas.getContext('2d');

      // Get average colors for each tile
      const imgData = ctx.getImageData(0, 0, w, h);

      for (let ty = 0; ty < h; ty += tileSize) {
        for (let tx = 0; tx < w; tx += tileSize) {
          let r = 0, g = 0, b = 0, a = 0, count = 0;

          // Sample tile area
          for (let y = ty; y < Math.min(ty + tileSize, h); y++) {
            for (let x = tx; x < Math.min(tx + tileSize, w); x++) {
              const idx = (y * w + x) * 4;
              if (imgData.data[idx + 3] > 0) {
                r += imgData.data[idx];
                g += imgData.data[idx + 1];
                b += imgData.data[idx + 2];
                a += imgData.data[idx + 3];
                count++;
              }
            }
          }

          if (count > 0) {
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            a = Math.round(a / count);

            // Add variation
            if (colorVariation > 0) {
              r = clamp(r + (Math.random() - 0.5) * 255 * colorVariation, 0, 255);
              g = clamp(g + (Math.random() - 0.5) * 255 * colorVariation, 0, 255);
              b = clamp(b + (Math.random() - 0.5) * 255 * colorVariation, 0, 255);
            }

            // Random tile offset
            const offsetX = Math.random() * randomness * tileSize - (randomness * tileSize / 2);
            const offsetY = Math.random() * randomness * tileSize - (randomness * tileSize / 2);

            // Draw mosaic tile
            mCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
            mCtx.fillRect(
              tx + offsetX,
              ty + offsetY,
              tileSize * (0.8 + Math.random() * 0.4),
              tileSize * (0.8 + Math.random() * 0.4)
            );
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(mosaicCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  arch: {
    name: 'Arch',
    params: [
      { key: 'curve', label: 'Curve Amount', type: 'range', min: -1920, max: 1920, step: 1, default: 50 },
      { key: 'offsetY', label: 'Vertical Offset', type: 'range', min: -100, max: 100, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const curve = params.curve ?? 50;
      const offsetY = params.offsetY ?? 0;
      const w = canvas.width, h = canvas.height;

      // --- 1. Detect Text Bounding Box ---
      // We need to know where the text actually STARTS and ENDS to curve it properly.
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = 0;
      let found = false;

      // Scan for horizontal bounds (Optimized stride)
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            found = true;
          }
        }
      }

      // If canvas is empty, do nothing
      if (!found) return { canvas, ctx, abortSignal};

      // Add a little padding to the bounds so the curve doesn't cut off hard
      const textWidth = (maxX - minX);
      const centerX = minX + (textWidth / 2);

      // --- 2. Apply Arch ---
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);

      // We slice the ORIGINAL canvas (0 to w), but we calculate the math 
      // relative to the TEXT bounds (centerX).
      for (let ix = 0; ix < w; ix++) {

        // Normalized X based on TEXT position (-1 to 1 range within the text)
        // If ix is outside the text, val will be > 1 or < -1, which continues the curve naturally
        const val = (ix - centerX) / (textWidth / 2);

        // Parabolic Curve: y = (1 - x^2) * amount
        // Peak is at x=0 (center of text)
        const shift = -((1 - (val * val)) * curve) + offsetY;

        // Draw vertical slice
        // Source: tempCanvas, x=ix, y=0, w=1, h=h
        // Dest:   ctx,        x=ix, y=shift
        ctx.drawImage(tempCanvas, ix, 0, 1, h, ix, shift, 1, h);
      }

      return { canvas, ctx, abortSignal};
    }
  },



  box: {
    name: 'Box',
    params: [
      { key: 'color', label: 'Box Color', type: 'color', default: '#ec1d24' }, // Classic Marvel Red
      { key: 'padding', label: 'Size (Padding)', type: 'range', min: 0, max: 100, step: 1, default: 15 },
      { key: 'radius', label: 'Roundness', type: 'range', min: 0, max: 50, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const color = params.color ?? '#ec1d24';
      const padding = params.padding ?? 15;
      const radius = params.radius ?? 0;
      const w = canvas.width, h = canvas.height;

      // 1. Scan for Text Bounds (Auto-size the box to fit content)
      // We reuse the bounding box logic to ensure the square fits the text perfectly
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let found = false;

      for (let py = 0; py < h; py += 4) {
        for (let px = 0; px < w; px += 4) {
          const alpha = data[(py * w + px) * 4 + 3];
          if (alpha > 0) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            found = true;
          }
        }
      }

      // If empty, just return
      if (!found) return { canvas, ctx, abortSignal};

      // 2. Calculate Box Dimensions
      const boxX = minX - padding;
      const boxY = minY - padding;
      const boxW = (maxX - minX) + (padding * 2);
      const boxH = (maxY - minY) + (padding * 2);

      // 3. Draw the Box
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');

      tCtx.fillStyle = color;

      if (tCtx.roundRect) {
        tCtx.beginPath();
        tCtx.roundRect(boxX, boxY, boxW, boxH, radius);
        tCtx.fill();
      } else {
        // Fallback for browsers without roundRect
        tCtx.fillRect(boxX, boxY, boxW, boxH);
      }

      // 4. Draw Text on Top
      tCtx.drawImage(canvas, 0, 0);

      // 5. Output
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  extrude: {
    name: '3D Extrude',
    params: [
      { key: 'depth', label: 'Depth', type: 'range', min: 0, max: 50, step: 1, default: 10 },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 45 },
      { key: 'color', label: 'Side Color', type: 'color', default: '#555555' },
      { key: 'shading', label: 'Darken Depth', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const depth = params.depth ?? 10;
      const angle = (params.angle ?? 45) * (Math.PI / 180);
      const color = params.color ?? '#555555';
      const shading = params.shading ?? 0.5;
      const w = canvas.width, h = canvas.height;

      // 1. Create the Extrusion Layer
      const extCanvas = createCanvas(w, h);
      const eCtx = extCanvas.getContext('2d');

      // 2. Prepare the "Side" color (silhouette)
      const silCanvas = createCanvas(w, h);
      const sCtx = silCanvas.getContext('2d');
      sCtx.drawImage(canvas, 0, 0);
      sCtx.globalCompositeOperation = 'source-in';
      sCtx.fillStyle = color;
      sCtx.fillRect(0, 0, w, h);

      // 3. Draw layers back-to-front
      // We draw from depth -> 0 so the face ends up on top
      // Optimization: Don't draw every single pixel if depth is huge. Step if needed.
      const step = 1;

      for (let i = depth; i > 0; i -= step) {
        const dx = Math.cos(angle) * i;
        const dy = Math.sin(angle) * i;

        // Calculate shading: Further back = darker?
        // Or just solid color. Let's do solid color but allow global shading.
        eCtx.globalAlpha = 1;

        // Optional: darken the very bottom layers more for "fake ambient occlusion"
        if (shading > 0) {
          // Simple linear darken based on depth
          const darkFactor = 1 - (i / depth) * shading;
          eCtx.filter = `brightness(${darkFactor * 100}%)`;
        }

        eCtx.drawImage(silCanvas, dx, dy);
        eCtx.filter = 'none';
      }

      // 4. Draw the Face (Original Text) on top
      // The extrusion is "behind" the text naturally if we draw it at 0,0
      // But we need to combine them.

      // Clear main ctx
      ctx.clearRect(0, 0, w, h);

      // Draw Extrusion
      ctx.drawImage(extCanvas, 0, 0);

      // Draw Face
      // Note: We don't move the face. The extrusion grows "out" (or in).
      // If you want the face to move "up", you'd shift this, but usually 
      // text stays anchored and 3d goes back.
      ctx.drawImage(canvas, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  slice: {
    name: 'Slice / Cut',
    params: [
      { key: 'angle', label: 'Cut Angle', type: 'range', min: -90, max: 90, step: 1, default: -20 },
      { key: 'offset', label: 'Separation', type: 'range', min: 0, max: 50, step: 1, default: 15 },
      { key: 'yPos', label: 'Cut Position', type: 'range', min: 0, max: 100, step: 1, default: 50 } // Percent height
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const angleDeg = params.angle ?? -20;
      const offset = params.offset ?? 15;
      const yPerc = (params.yPos ?? 50) / 100;

      const w = canvas.width, h = canvas.height;
      const cutY = h * yPerc;

      // 1. Create Top Half
      const topC = createCanvas(w, h);
      const tCtx = topC.getContext('2d');

      // Clip Top Region
      tCtx.save();
      tCtx.beginPath();
      // Draw a giant rectangle that represents the "Top" relative to the angled line
      // Math: Rotate context around the cut point, draw rect, restore.
      tCtx.translate(w / 2, cutY);
      tCtx.rotate(angleDeg * Math.PI / 180);
      tCtx.rect(-w, -h, w * 3, h); // Top half rect
      tCtx.clip();

      // Reset transform to draw text upright inside the clipped zone
      tCtx.rotate(-angleDeg * Math.PI / 180);
      tCtx.translate(-w / 2, -cutY);
      tCtx.drawImage(canvas, 0, 0);
      tCtx.restore();

      // 2. Create Bottom Half
      const botC = createCanvas(w, h);
      const bCtx = botC.getContext('2d');

      // Clip Bottom Region
      bCtx.save();
      bCtx.beginPath();
      bCtx.translate(w / 2, cutY);
      bCtx.rotate(angleDeg * Math.PI / 180);
      bCtx.rect(-w, 0, w * 3, h); // Bottom half rect
      bCtx.clip();

      // Reset transform
      bCtx.rotate(-angleDeg * Math.PI / 180);
      bCtx.translate(-w / 2, -cutY);
      bCtx.drawImage(canvas, 0, 0);
      bCtx.restore();

      // 3. Composite with shift
      // Slide top along the angle? Or just horizontal/vertical shift?
      // A clean "Cut" usually slides the top piece UP/LEFT or bottom DOWN/RIGHT.
      // Let's slide along the cut angle for realism.
      const rad = angleDeg * Math.PI / 180;
      const dx = Math.cos(rad) * offset;
      const dy = Math.sin(rad) * offset;

      ctx.clearRect(0, 0, w, h);

      // Move Top Left/Up
      ctx.drawImage(topC, -dx / 2, -dy / 2);

      // Move Bottom Right/Down
      ctx.drawImage(botC, dx / 2, dy / 2);

      return { canvas, ctx, abortSignal};
    }
  },

  perspective: {
    name: 'Perspective',
    params: [
      { key: 'depth', label: 'Tilt Strength', type: 'range', min: -1, max: 1, step: 0.05, default: 0.5 },
      { key: 'direction', label: 'Side', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Horizontal' }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const depth = params.depth ?? 0.5;
      const isVert = params.direction === 'Vertical';
      const w = canvas.width, h = canvas.height;

      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);

      if (!isVert) {
        // HORIZONTAL: Left side big, Right side small (or vice versa)
        const centerY = h / 2;

        for (let ix = 0; ix < w; ix++) {
          // Normalize 0 to 1
          const perc = ix / w;

          // Calculate scale factor for this column
          // If depth > 0: Left=1, Right=1-depth
          // If depth < 0: Left=1+depth, Right=1
          let scale = 1;
          if (depth > 0) scale = 1 - (perc * depth);
          else scale = 1 - ((1 - perc) * Math.abs(depth));

          const destH = h * scale;
          const destY = centerY - (destH / 2);

          // Draw slice
          ctx.drawImage(tempCanvas, ix, 0, 1, h, ix, destY, 1, destH);
        }
      } else {
        // VERTICAL: Top big, Bottom small
        const centerX = w / 2;

        for (let iy = 0; iy < h; iy++) {
          const perc = iy / h;
          let scale = 1;
          if (depth > 0) scale = 1 - (perc * depth);
          else scale = 1 - ((1 - perc) * Math.abs(depth));

          const destW = w * scale;
          const destX = centerX - (destW / 2);

          ctx.drawImage(tempCanvas, 0, iy, w, 1, destX, iy, destW, 1);
        }
      }
      return { canvas, ctx, abortSignal};
    }
  },

  innerShadow: {
    name: 'Inner Shadow',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#000000' },
      { key: 'blur', label: 'Blur', type: 'range', min: 0, max: 20, step: 1, default: 5 },
      { key: 'offsetX', label: 'Offset X', type: 'range', min: -20, max: 20, step: 1, default: 3 },
      { key: 'offsetY', label: 'Offset Y', type: 'range', min: -20, max: 20, step: 1, default: 3 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.1, default: 0.8 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const color = params.color ?? '#000000';
      const blur = params.blur ?? 5;
      const offX = params.offsetX ?? 3;
      const offY = params.offsetY ?? 3;
      const opacity = params.opacity ?? 0.8;
      const w = canvas.width, h = canvas.height;

      // 1. Draw Text Normally first
      // We need the base text visible.
      // (If we were doing "Cutout" from a solid block, we wouldn't do this, 
      // but "Inner Shadow" implies the text object has a shadow inside it).

      // Actually, since we are MODIFYING the existing canvas, the text is already there.
      // We just need to overlay the shadow.

      // 2. Create the Shadow
      // Logic: 
      // A. Create an inverted mask of the text (Hole in a solid wall)
      // B. Drop a shadow from that wall onto a new layer
      // C. Mask that shadow layer so it ONLY appears where the original text was.

      const shadowCanvas = createCanvas(w, h);
      const sCtx = shadowCanvas.getContext('2d');

      // Draw Text (as the "caster")
      sCtx.drawImage(canvas, 0, 0);

      // Composite: Source-Alpha? 
      // Easier way for inner shadow:
      // 1. Fill entire canvas with color.
      // 2. Cut out the text (destination-out).
      // 3. Draw shadow of the *result* (the negative space) offset inwards?

      // Let's use the standard "Inverted Shadow" trick:

      sCtx.globalCompositeOperation = 'source-over';
      sCtx.drawImage(canvas, 0, 0);

      // Turn the text opaque color (for the shadow caster)
      sCtx.globalCompositeOperation = 'source-in';
      sCtx.fillStyle = color;
      sCtx.fillRect(0, 0, w, h);

      // Now we have a solid colored text on sCtx.

      // 3. The Composition
      ctx.save();

      // We want to draw on TOP of the existing text
      // But clipped to the text.
      ctx.globalCompositeOperation = 'source-atop';

      // Setup Shadow
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = offX;
      ctx.shadowOffsetY = offY;
      ctx.globalAlpha = opacity;

      // The Trick:
      // We draw the text *outside* the canvas, but with a shadow that falls *inside*.
      // But to do that, we need an inverted shape.

      // Alternative (Simpler & Faster for Canvas):
      // Just draw the inverted mask with a shadow.

      // 1. Mask to text
      // (Already done via source-atop on the main ctx)

      // 2. Draw an object that covers everything EXCEPT the text, 
      //    and cast a shadow from it.
      const invCanvas = createCanvas(w, h);
      const iCtx = invCanvas.getContext('2d');

      // Fill all
      iCtx.fillStyle = '#000000';
      iCtx.fillRect(0, 0, w, h);

      // Remove text
      iCtx.globalCompositeOperation = 'destination-out';
      iCtx.drawImage(canvas, 0, 0);

      // Now invCanvas is a solid block with a hole in the shape of the text.

      // Draw this block with a shadow. The shadow will fall INTO the hole (the text).
      ctx.drawImage(invCanvas, 0, 0);

      ctx.restore();

      return { canvas, ctx, abortSignal};
    }
  },

  // ===========================================
  // KINETIC & MATERIAL (NEW)
  // ===========================================

  motionBlur: {
    name: 'Motion Blur',
    params: [
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0 },
      { key: 'distance', label: 'Speed', type: 'range', min: 0, max: 100, step: 1, default: 30 },
      { key: 'opacity', label: 'Trail Opacity', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const angle = (params.angle ?? 0) * (Math.PI / 180);
      const dist = params.distance ?? 30;
      const opacity = params.opacity ?? 0.5;
      const w = canvas.width, h = canvas.height;

      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      
      // Optimization: Instead of drawing 100 copies for a 100px blur (slow),
      // we draw fewer copies with lower opacity to simulate the streak.
      const steps = Math.min(dist, 20); // Cap steps for performance
      const stepSize = dist / steps;

      // 1. Draw the trails
      tCtx.globalAlpha = opacity / (steps / 2); // Divide opacity so they don't stack to white immediately
      
      for(let i = 1; i <= steps; i++) {
        const d = i * stepSize;
        const dx = Math.cos(angle) * d;
        const dy = Math.sin(angle) * d;
        
        // Draw centered? No, motion blur usually trails BEHIND.
        // If angle is 0 (right), we draw trails to the left?
        // Let's assume angle is the DIRECTION of movement. Trail goes opposite.
        tCtx.drawImage(canvas, -dx, -dy);
      }

      // 2. Draw original on top
      tCtx.globalAlpha = 1;
      tCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  chrome: {
    name: 'Chrome / Metallic',
    params: [
      { key: 'sky', label: 'Sky Color', type: 'color', default: '#33ccff' },
      { key: 'ground', label: 'Ground Color', type: 'color', default: '#333333' },
      { key: 'horizon', label: 'Horizon Y', type: 'range', min: 0, max: 100, step: 1, default: 50 },
      { key: 'edge', label: 'Edge Shine', type: 'range', min: 0, max: 10, step: 0.5, default: 2 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const sky = params.sky ?? '#33ccff';
      const ground = params.ground ?? '#333333';
      const horizonPerc = (params.horizon ?? 50) / 100;
      const edgeWidth = params.edge ?? 2;
      const w = canvas.width, h = canvas.height;

      // 1. Create the Metallic Gradient
      // Chrome is distinct because it has a sharp cut in the middle (Horizon)
      const gradCanvas = createCanvas(w, h);
      const gCtx = gradCanvas.getContext('2d');
      
      // We need bounds to position gradient correctly on the text
      // (Simplified: use canvas height)
      const grad = gCtx.createLinearGradient(0, 0, 0, h);
      
      // Sky stops
      grad.addColorStop(0, '#ffffff'); // Glint at top
      grad.addColorStop(Math.max(0, horizonPerc - 0.05), sky);
      grad.addColorStop(horizonPerc, '#ffffff'); // Hard Horizon Line (White Flash)
      grad.addColorStop(horizonPerc, ground); // Hard switch to ground
      grad.addColorStop(1, '#000000'); // Bottom shadow
      
      gCtx.fillStyle = grad;
      gCtx.fillRect(0,0,w,h);
      
      // 2. Composite Gradient INTO text
      gCtx.globalCompositeOperation = 'destination-in';
      gCtx.drawImage(canvas, 0, 0);

      // 3. Add a white border (optional, enhances the metal look)
      if (edgeWidth > 0) {
        gCtx.globalCompositeOperation = 'source-over';
        gCtx.shadowColor = 'white';
        gCtx.shadowBlur = edgeWidth;
        gCtx.shadowOffsetX = 0;
        gCtx.shadowOffsetY = 0;
        // Draw text again to trigger shadow, but we need to mask it strictly to edges?
        // Simpler: Just stroke it
        // Since we don't have the text path, we use the shadow-trick on the silhouette
        const borderC = createCanvas(w, h);
        const bCtx = borderC.getContext('2d');
        bCtx.drawImage(canvas, 0, 0);
        bCtx.globalCompositeOperation = 'source-in';
        bCtx.fillStyle = 'white';
        bCtx.fillRect(0,0,w,h); // Solid white text
        
        // Draw the white text behind the gradient text with a slight blur
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = 0.8;
        ctx.drawImage(borderC, -1, -1); // Highlight Top-Left
        ctx.drawImage(borderC, 1, 1);   // Highlight Bot-Right
        ctx.globalAlpha = 1;
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      // Draw Chrome
      ctx.drawImage(gradCanvas, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  echo: {
    name: 'Echo / Trail',
    params: [
      { key: 'count', label: 'Copies', type: 'range', min: 1, max: 10, step: 1, default: 3 },
      { key: 'offset', label: 'Spacing', type: 'range', min: 0, max: 50, step: 1, default: 20 },
      { key: 'fade', label: 'Fade Out', type: 'range', min: 0, max: 1, step: 0.1, default: 0.2 },
      { key: 'color', label: 'Tint', type: 'color', default: '' } // Optional tint
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const count = params.count ?? 3;
      const offset = params.offset ?? 20;
      const fade = params.fade ?? 0.2;
      const tint = params.color; // If empty string, use original colors
      const w = canvas.width, h = canvas.height;

      const resultCanvas = createCanvas(w, h);
      const rCtx = resultCanvas.getContext('2d');

      // 1. Prepare a tinted version if needed
      let srcCanvas = canvas;
      if (tint) {
        const tC = createCanvas(w, h);
        const tcCtx = tC.getContext('2d');
        tcCtx.drawImage(canvas, 0, 0);
        tcCtx.globalCompositeOperation = 'source-in';
        tcCtx.fillStyle = tint;
        tcCtx.fillRect(0, 0, w, h);
        srcCanvas = tC;
      }

      // 2. Draw Echoes (Back to Front)
      // We draw the furthest copy first
      for (let i = count; i > 0; i--) {
        // Calculate transparency
        // If fade is 0.2, each copy is 20% less visible? 
        // Or simple linear: 
        const alpha = Math.max(0, 1 - (i * fade));
        
        if (alpha > 0) {
          rCtx.save();
          rCtx.globalAlpha = alpha;
          // Shift: usually echo goes to the right/down
          rCtx.drawImage(srcCanvas, i * offset, 0); 
          rCtx.restore();
        }
      }

      // 3. Draw Main Text (Original, untinted)
      rCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(resultCanvas, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  bulge: {
    name: 'Bulge / Pinch',
    params: [
      { key: 'strength', label: 'Strength', type: 'range', min: -5, max: 5, step: 0.1, default: 0.5 },
      { key: 'radius', label: 'Radius', type: 'range', min: 10, max: 1000, step: 10, default: 200 },
      { key: 'offsetX', label: 'Center X', type: 'range', min: -500, max: 500, step: 10, default: 0 }, // New
      { key: 'offsetY', label: 'Center Y', type: 'range', min: -500, max: 500, step: 10, default: 0 }  // New
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const strength = params.strength ?? 0.5;
      const radius = params.radius ?? 200;
      const offX = params.offsetX ?? 0;
      const offY = params.offsetY ?? 0;
      
      const w = canvas.width, h = canvas.height;

      const srcData = ctx.getImageData(0, 0, w, h);
      const src = new Uint32Array(srcData.data.buffer);
      const outData = ctx.createImageData(w, h);
      const out = new Uint32Array(outData.data.buffer);

      // Calculate Center based on canvas size + user offset
      const cx = (w / 2) + offX;
      const cy = (h / 2) + offY;
      const radiusSq = radius * radius;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          
          const dx = px - cx;
          const dy = py - cy;
          const distSq = dx*dx + dy*dy;

          // Only process inside the radius circle
          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            const percent = dist / radius;
            
            // Calculate angle
            const angle = Math.atan2(dy, dx);
            
            // Calculate source distance
            let srcDist = dist;
            if (strength > 0) {
               // Bulge: source is closer to center (magnify)
               srcDist = dist * (1 - strength * (1 - percent)); 
            } else {
               // Pinch: source is further out (shrink)
               srcDist = dist * (1 + Math.abs(strength) * (1 - percent));
            }

            const sx = cx + Math.cos(angle) * srcDist;
            const sy = cy + Math.sin(angle) * srcDist;

            const ix = Math.floor(sx);
            const iy = Math.floor(sy);

            // Boundary checks to avoid reading outside array
            if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
               out[py*w + px] = src[iy*w + ix];
            } else {
               // If source pixel is outside canvas, leave empty (transparent)
               // or repeat edge? Transparent is cleaner.
            }

          } else {
            // Outside radius, copy original pixel as is
            out[py*w + px] = src[py*w + px];
          }
        }
      }
      
      outData.data.set(new Uint8ClampedArray(out.buffer));
      ctx.putImageData(outData, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  ring: {
    name: 'Ring / Circle',
    params: [
      { key: 'radius', label: 'Radius', type: 'range', min: 50, max: 500, step: 10, default: 200 },
      { key: 'angle', label: 'Arc Angle', type: 'range', min: 90, max: 360, step: 10, default: 360 },
      { key: 'rotate', label: 'Rotation', type: 'range', min: 0, max: 360, step: 1, default: 0 },
      { key: 'inward', label: 'Facing', type: 'select', options: ['Inward', 'Outward'], default: 'Inward' }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const radius = params.radius ?? 200;
      const arc = (params.angle ?? 360) * (Math.PI / 180);
      const startRot = (params.rotate ?? 0) * (Math.PI / 180);
      const inward = params.inward === 'Inward';
      const w = canvas.width, h = canvas.height;

      // 1. Detect Text Width to map it to the circle circumference
      // We need to know how "long" the text strip is to wrap it correctly.
      // (Simplified: We assume the canvas width contains the relevant text).
      // Ideally, you'd use the text metrics, but here we scan bounds.
      const data = ctx.getImageData(0,0,w,h).data;
      let minX = w, maxX = 0;
      for(let y=0; y<h; y+=4) {
        for(let x=0; x<w; x+=4) {
          if(data[(y*w+x)*4+3]>0) {
            if(x<minX) minX=x;
            if(x>maxX) maxX=x;
          }
        }
      }
      if (minX > maxX) return { canvas, ctx, abortSignal}; // Empty

      const textWidth = maxX - minX;
      const textCenterX = minX + (textWidth/2);

      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);

      // 2. Polar Mapping
      // We iterate over the DESTINATION circle pixels and find which SOURCE pixel maps there.
      // This prevents gaps.
      
      const cx = w / 2;
      const cy = h / 2;

      // Optimization: Bounding box of the destination circle to avoid scanning 1920x1080
      const box = radius + (h/2); // approximate max extent
      const minDestX = Math.max(0, Math.floor(cx - box));
      const maxDestX = Math.min(w, Math.ceil(cx + box));
      const minDestY = Math.max(0, Math.floor(cy - box));
      const maxDestY = Math.min(h, Math.ceil(cy + box));

      for (let py = minDestY; py < maxDestY; py++) {
        for (let px = minDestX; px < maxDestX; px++) {
          
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          // Angle from -PI to PI
          let angle = Math.atan2(dy, dx) - startRot; 
          
          // Normalize angle to linear X
          // We map the Arc Angle to the Text Width
          
          // If inward: text sits on radius, heads point to center? 
          // Usually "Inward" means the bottom of text is on the circle.
          // "Outward" means top of text is on the circle.
          
          // Calculate sample Y (distance from radius ring)
          const deltaR = inward ? (radius - dist) : (dist - radius);
          
          // If we are too far from the ring (outside text height), skip
          if (Math.abs(deltaR) > h/2) continue;
          
          // Map Angle to X
          // -Arc/2 to +Arc/2 maps to -Width/2 to +Width/2
          
          // Normalize angle within range
          // Wrap angle math is complex, simplified:
          while(angle <= -Math.PI) angle += Math.PI*2;
          while(angle > Math.PI) angle -= Math.PI*2;

          // Check if within our defined arc
          if (Math.abs(angle) > arc/2) continue;

          // Ratio of angle to total arc
          const ratio = angle / (arc/2); // -1 to 1
          
          // Map to Source X
          const sx = textCenterX + (ratio * (textWidth/2));
          
          // Map to Source Y (Middle of text + delta)
          const sy = (h/2) + deltaR;

          // Sample
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
             // Basic nearest neighbor
             const idx = (Math.floor(sy) * w + Math.floor(sx)) * 4;
             // But we need to write to (px, py)
             // We can't use imageData for random writes easily without buffer
             // So we assume we are using a buffer or draw 1x1 rects (slow).
             // Let's use get/put logic via buffer for performance.
          }
        }
      }
      
      // RE-IMPLEMENTATION: SLICE METHOD (Much Faster & Smoother)
      // Instead of pixel-by-pixel polar coordinates (which is aliased and slow in JS),
      // we cut the text into vertical strips and rotate them.
      
      const slices = Math.max(20, Math.ceil(textWidth / 2)); // 1 slice per 2px
      const sliceWidth = textWidth / slices;
      const anglePerSlice = arc / slices;
      
      for(let i=0; i<slices; i++) {
        const sx = minX + (i * sliceWidth);
        
        // Destination Angle
        // Map 0..slices to -Angle/2 .. +Angle/2
        const progress = (i / slices) - 0.5; // -0.5 to 0.5
        const rot = progress * arc + startRot + (Math.PI / 2); // +90 to start at 12 o'clock?
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        
        // Move out to radius
        // Inward: Text Upright at top.
        const rOffset = inward ? -radius : radius;
        ctx.translate(0, rOffset);
        
        if (!inward) {
           // Flip text if outward so it's readable? 
           // Usually outward text needs to be mirrored or it looks upside down at bottom
           // Let's keep simple wrap.
        }

        // Draw Slice
        // We take a slice from tempCanvas and draw it centered here
        ctx.drawImage(
          tempCanvas, 
          sx, 0, sliceWidth, h, 
          -sliceWidth/2, -h/2, sliceWidth+1, h // +1 to fix gaps
        );
        
        ctx.restore();
      }

      return { canvas, ctx, abortSignal};
    }
  },

  roughen: {
    name: 'Roughen Edges',
    params: [
      { key: 'strength', label: 'Strength', type: 'range', min: 0, max: 20, step: 1, default: 5 },
      { key: 'scale', label: 'Detail', type: 'range', min: 1, max: 20, step: 1, default: 10 },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const strength = params.strength ?? 5;
      const scale = params.scale ?? 10;
      const seeded = createSeededRandom(params.seed);
      const rnd = seeded ? seeded : Math.random;
      const w = canvas.width, h = canvas.height;

      // 1. Create a "Noise Map" for displacement
      // We generate low-res noise and scale it up to get smooth "waves" along the edge
      // instead of static/grainy noise.
      
      const noiseW = Math.ceil(w / scale);
      const noiseH = Math.ceil(h / scale);
      const noiseMap = new Float32Array(noiseW * noiseH * 2); // X and Y shift

      for(let i=0; i<noiseMap.length; i++) {
        noiseMap[i] = (rnd() - 0.5) * strength * 2;
      }

      // Helper to get smooth noise value
      const getNoise = (x, y) => {
        const nx = x / scale;
        const ny = y / scale;
        const ix = Math.floor(nx);
        const iy = Math.floor(ny);
        // Simple linear interpolation could go here, 
        // but nearest neighbor is "jagged" which is what we want for roughen!
        // We clamp to bounds
        const idx = (Math.max(0, Math.min(noiseH-1, iy)) * noiseW + Math.max(0, Math.min(noiseW-1, ix))) * 2;
        return { x: noiseMap[idx], y: noiseMap[idx+1] };
      };

      const srcData = ctx.getImageData(0, 0, w, h);
      const src = new Uint32Array(srcData.data.buffer);
      const outData = ctx.createImageData(w, h);
      const out = new Uint32Array(outData.data.buffer);

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          
          // Get shift for this pixel
          const shift = getNoise(px, py);
          
          // To roughen the edge, we displace the SOURCE lookup.
          // If we are at edge, we might pull a transparent pixel in (eroding)
          // or push a solid pixel out (growing).
          
          const sx = Math.floor(px + shift.x);
          const sy = Math.floor(py + shift.y);

          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const val = src[sy * w + sx];
            // Only write if we actually grabbed something (or if we are eroding)
            out[py * w + px] = val;
          }
        }
      }

      outData.data.set(new Uint8ClampedArray(out.buffer));
      ctx.putImageData(outData, 0, 0);

      return { canvas, ctx, abortSignal};
    }
  },

  scale: {
    name: 'Scale / Stretch',
    params: [
      { key: 'w', label: 'Width Scale', type: 'range', min: 0.1, max: 3, step: 0.05, default: 1 },
      { key: 'h', label: 'Height Scale', type: 'range', min: 0.1, max: 3, step: 0.05, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const sx = params.w ?? 1;
      const sy = params.h ?? 1;
      const w = canvas.width, h = canvas.height;

      // 1. Copy original state
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      // 2. Clear and Prepare transform
      ctx.clearRect(0, 0, w, h);
      ctx.save();

      // 3. Move to Center -> Scale -> Move Back
      // This ensures the text expands/shrinks from its middle, not from the top-left corner.
      ctx.translate(w / 2, h / 2);
      ctx.scale(sx, sy);
      ctx.translate(-w / 2, -h / 2);

      // 4. Draw
      ctx.drawImage(tempCanvas, 0, 0);
      
      ctx.restore();

      return { canvas, ctx, abortSignal};
    }
  },

  // ===========================================
  // BASICS & UTILITIES (NEW)
  // ===========================================

  blur: {
    name: 'Blur',
    params: [
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 20, step: 0.5, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const amount = params.amount ?? 0;
      if (amount <= 0) return { canvas, ctx, abortSignal};

      const w = canvas.width, h = canvas.height;
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      
      // Use standard Canvas Filter (hardware accelerated in modern browsers)
      tCtx.filter = `blur(${amount}px)`;
      tCtx.drawImage(canvas, 0, 0);
      tCtx.filter = 'none';

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  rotate: {
    name: 'Rotate',
    params: [
      { key: 'angle', label: 'Angle', type: 'range', min: -180, max: 180, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const angle = (params.angle ?? 0) * (Math.PI / 180);
      if (angle === 0) return { canvas, ctx, abortSignal};

      const w = canvas.width, h = canvas.height;
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');

      // Rotate around center
      tCtx.translate(w / 2, h / 2);
      tCtx.rotate(angle);
      tCtx.translate(-w / 2, -h / 2);
      
      tCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  adjustments: {
    name: 'Color Adjust',
    params: [
      { key: 'hue', label: 'Hue', type: 'range', min: 0, max: 360, step: 1, default: 0 },
      { key: 'sat', label: 'Saturation', type: 'range', min: 0, max: 200, step: 1, default: 100 },
      { key: 'bright', label: 'Brightness', type: 'range', min: 0, max: 200, step: 1, default: 100 },
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0, max: 200, step: 1, default: 100 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const hVal = params.hue ?? 0;
      const sVal = params.sat ?? 100;
      const bVal = params.bright ?? 100;
      const cVal = params.contrast ?? 100;

      const w = canvas.width, h = canvas.height;
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');

      // Combine CSS filters
      tCtx.filter = `hue-rotate(${hVal}deg) saturate(${sVal}%) brightness(${bVal}%) contrast(${cVal}%)`;
      tCtx.drawImage(canvas, 0, 0);
      tCtx.filter = 'none';

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },

  invert: {
    name: 'Invert / Negative',
    params: [
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 1, step: 0.01, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const val = params.amount ?? 1;
      const w = canvas.width, h = canvas.height;
      
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');

      tCtx.filter = `invert(${val})`;
      tCtx.drawImage(canvas, 0, 0);
      tCtx.filter = 'none';

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal};
    }
  },
  splatter: {
    name: 'Splatter',
    params: [
      { key: 'mode', label: 'Type', type: 'select', options: ['Erode', 'Paint'], default: 'Erode ([REC] Style)' },
      { key: 'color', label: 'Fluid Color', type: 'color', default: '#cc0000' }, 
      { key: 'density', label: 'Amount', type: 'range', min: 1, max: 100, step: 1, default: 40 },
      { key: 'size', label: 'Drop Size', type: 'range', min: 1, max: 50, step: 1, default: 15 },
      { key: 'spread', label: 'Scatter', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: 'distortion', label: 'Distortion', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 }, // New param
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const mode = params.mode ?? 'Erode';
      const isErode = mode.startsWith('Erode');
      const color = params.color ?? '#cc0000';
      const density = params.density ?? 40;
      const baseSize = params.size ?? 15;
      const spread = params.spread ?? 0.8;
      const distortion = params.distortion ?? 0.6;
      const seed = params.seed ?? 1;

      const w = canvas.width;
      const h = canvas.height;

      // Deterministic Random Generator
      let _s = seed * 12345;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // Helper: Draw a Distorted Blob (Liquid Shape)
      const drawBlob = (ctx, cx, cy, radius, distor) => {
        ctx.beginPath();
        const segments = 8 + Math.floor(radius / 2); // More segments for bigger drops
        const angleStep = (Math.PI * 2) / segments;
        const points = [];

        // Generate perturbed points
        for (let i = 0; i < segments; i++) {
          const theta = i * angleStep;
          // Random offset based on distortion
          // distor 0 = 1.0 (perfect circle)
          // distor 1 = 0.5 to 1.5 variation
          const noise = (rng() - 0.5) * distor * 1.5; 
          const r = Math.max(0.1, radius * (1 + noise));
          points.push({
            x: cx + Math.cos(theta) * r,
            y: cy + Math.sin(theta) * r
          });
        }

        // Smooth curve through points
        // We move to the midpoint between the last and first point
        const len = points.length;
        const midX = (points[len - 1].x + points[0].x) / 2;
        const midY = (points[len - 1].y + points[0].y) / 2;
        
        ctx.moveTo(midX, midY);

        for (let i = 0; i < len; i++) {
          const p1 = points[i];
          const p2 = points[(i + 1) % len];
          // Control point is p1, destination is midpoint(p1, p2)
          const midNextX = (p1.x + p2.x) / 2;
          const midNextY = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, midNextX, midNextY);
        }
        ctx.fill();
      };

      // 1. Create the "Splash Map"
      const splashCanvas = createCanvas(w, h);
      const sCtx = splashCanvas.getContext('2d');
      
      // Determine bounds to keep drops near text
      const data = ctx.getImageData(0,0,w,h).data;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let hasText = false;
      for(let py=0; py<h; py+=10) {
        for(let px=0; px<w; px+=10) {
           if(data[(py*w+px)*4+3] > 0) {
              if(px<minX) minX=px; if(px>maxX) maxX=px;
              if(py<minY) minY=py; if(py>maxY) maxY=py;
              hasText = true;
           }
        }
      }
      if(!hasText) { minX=0; maxX=w; minY=0; maxY=h; }
      
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const textW = maxX - minX;
      const textH = maxY - minY;

      sCtx.fillStyle = '#000000'; 

      // Draw Drops
      const count = Math.floor((textW * textH) / (10000 / density)) + density;
      
      for (let i = 0; i < count; i++) {
         let dx, dy;
         
         if (rng() > 0.3) {
           // Random scatter
           const limitW = textW * (0.5 + spread);
           const limitH = textH * (0.5 + spread);
           dx = cx + (rng() - 0.5) * limitW * 2;
           dy = cy + (rng() - 0.5) * limitH * 2;
         } else {
           // Edge clustering
           const edge = rng() > 0.5 ? minX : maxX;
           dx = edge + (rng() - 0.5) * 100;
           dy = cy + (rng() - 0.5) * textH;
         }

         const size = (rng() * baseSize) + 2;
         
         // Draw main distorted blob
         drawBlob(sCtx, dx, dy, size, distortion);
         
         // Draw "Satellites" (tiny splatter bits)
         const satellites = Math.floor(rng() * 5);
         for(let j=0; j<satellites; j++) {
            const angle = rng() * Math.PI * 2;
            const dist = size * (1.5 + rng() * 3);
            const sSize = size * 0.3 * rng();
            // Higher distortion on satellites creates jagged specks
            drawBlob(sCtx, dx + Math.cos(angle)*dist, dy + Math.sin(angle)*dist, sSize, Math.min(1, distortion + 0.2));
         }
      }
      
      // 2. Apply to Text
      if (isErode) {
         // [REC] Style: Remove text where the drops are
         ctx.globalCompositeOperation = 'destination-out';
         ctx.drawImage(splashCanvas, 0, 0);
         ctx.globalCompositeOperation = 'source-over'; 
      } else {
         // Paint Style
         sCtx.globalCompositeOperation = 'source-in';
         sCtx.fillStyle = color;
         sCtx.fillRect(0,0,w,h);
         
         ctx.globalCompositeOperation = 'source-over';
         ctx.drawImage(splashCanvas, 0, 0);
      }

      return { canvas, ctx, abortSignal};
    }
  },

};

/* -------------------------
   3. API Helpers
   ------------------------- */
function applyTextEffect(textCtx, textCanvas, effectType, text, x, y, params = {}) {
  const effect = TEXT_EFFECTS[effectType];
  if (effect && effect.apply) {
    textCtx.save();
    try {
      effect.apply(textCtx, textCanvas, text, x, y, params);
    } finally {
      textCtx.restore();
    }
  }
}

function getAvailableTextEffects() {
  return Object.entries(TEXT_EFFECTS)
    .map(([id, effect]) => ({
      id,
      name: effect.name,
      params: effect.params || []
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

if (typeof window !== 'undefined') {
  window.getAvailableTextEffects = getAvailableTextEffects;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TEXT_EFFECTS, applyTextEffect, getAvailableTextEffects };
}