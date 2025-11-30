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
    apply: (ctx, canvas, text, x, y, params) => {
      const amount = clamp(params.amount ?? 1, 0, 1);
      const w = canvas.width, h = canvas.height;
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');
      tCtx.globalAlpha = amount;
      tCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx };
    }
  },

  fade: {
    name: 'Fade',
    params: [
      { key: 'direction', label: 'Fade Side', type: 'select', options: ['top', 'bottom', 'left', 'right'], default: 'bottom' },
      { key: 'strength', label: 'Reach', type: 'range', min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: 'endsAt', label: 'End Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
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
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
    }
  },

  neon: {
    name: 'Neon',
    params: [
      { key: 'color', label: 'Glow Color', type: 'color', default: '#00ff00' },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 50, step: 0.1, default: 2 },
      { key: 'size', label: 'Spread', type: 'range', min: 0, max: 50, step: 1, default: 15 }
    ],

    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
    }
  },

  glowEdge: {
    name: 'Projection',
    params: [
      { key: 'radius', label: 'Radius', type: 'range', min: 1, max: 40, step: 1, default: 8 },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: 'color', label: 'Color', type: 'color', default: '#ffffff' }
    ],
    apply: (textCtx, textCanvas, text, x, y, params = {}) => {
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
      return { canvas: textCanvas, ctx: textCtx };
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

    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
    }
  },



  outline: {
    name: 'Outline',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#000000' },
      { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 100, step: 0.5, default: 3 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
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
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
    }
  },

  chromatic: {
    name: 'Chromatic Aberration',
    params: [
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 20, step: 1, default: 4 },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 45 }
    ],
    apply: (textCtx, textCanvas, text, x, y, params = {}) => {
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
      return { canvas: textCanvas, ctx: textCtx };
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
    apply: (textCtx, textCanvas, text, x, y, params = {}) => {
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
      return { canvas: textCanvas, ctx: textCtx };
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
    apply: (textCtx, textCanvas, text, x, y, params = {}) => {
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

      return { canvas: textCanvas, ctx: textCtx };
    }
  },

  pixelMatrix: {
    name: 'Pixelate',
    params: [
      { key: 'pixelSize', label: 'Size', type: 'range', min: 1, max: 64, step: 1, default: 8 }
    ],
    // We ignore 'text', 'x', and 'y' since we are manipulating existing pixels
    apply: (textCtx, textCanvas, text, x, y, params = {}) => {
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

      return { canvas: textCanvas, ctx: textCtx };
    }
  },

  skew: {
    name: 'Skew',
    params: [
      { key: 'x', label: 'Skew X', type: 'range', min: -1, max: 1, step: 0.05, default: -0.2 },
      { key: 'y', label: 'Skew Y', type: 'range', min: -1, max: 1, step: 0.05, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
    }
  },

  flip: {
    name: 'Flip',
    params: [
      { key: 'axis', label: 'Axis', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Horizontal' }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
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
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
    }
  },

  melt: {
    name: 'Melt',
    params: [
      { key: 'strength', label: 'Drip Length', type: 'range', min: 0, max: 100, step: 1, default: 20 },
      { key: 'chaos', label: 'Chaos', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 999, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
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
      return { canvas, ctx };
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
    apply: (textCtx, textCanvas, text, x, y, params = {}) => {
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

      return { canvas: textCanvas, ctx: textCtx };
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
    apply: (ctx, canvas, text, x, y, params = {}) => {
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
      return { canvas, ctx };
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
    apply: (ctx, canvas, text, x, y, params = {}) => {
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
      return { canvas, ctx };
    }
  }
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
  return Object.keys(TEXT_EFFECTS).sort().map(key => ({
    id: key,
    name: TEXT_EFFECTS[key].name,
    params: TEXT_EFFECTS[key].params || []
  }));
}

if (typeof window !== 'undefined') {
  window.getAvailableTextEffects = getAvailableTextEffects;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TEXT_EFFECTS, applyTextEffect, getAvailableTextEffects };
}