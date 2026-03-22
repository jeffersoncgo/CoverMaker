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
      return { canvas, ctx, abortSignal };
    }
  },

  fade: {
    name: 'Fade',
    params: [
      { key: 'direction', label: 'Direction', type: 'select', options: ['Bottom', 'Top', 'Left', 'Right', 'Vertical (Both)', 'Horizontal (Both)', 'Radial (Vignette)'], default: 'Bottom' },
      { key: 'strength', label: 'Reach', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'endsAt', label: 'End Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const strength = Math.max(0, Math.min(1, Number(params.strength ?? 0.5)));
      const endsAt = Math.max(0, Math.min(1, Number(params.endsAt ?? 0)));
      const direction = params.direction ?? 'Bottom';
      const w = canvas.width;
      const h = canvas.height;

      // 1. Exact Bounding Box Scan
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let found = false;

      for (let py = 0; py < h; py += 4) {
        for (let px = 0; px < w; px += 4) {
          if (data[(py * w + px) * 4 + 3] > 0) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            found = true;
          }
        }
      }

      if (!found) return { canvas, ctx };

      const gMinX = minX; const gMaxX = maxX;
      const gMinY = minY; const gMaxY = maxY;
      const cx = (gMinX + gMaxX) / 2;
      const cy = (gMinY + gMaxY) / 2;
      const textW = gMaxX - gMinX;
      const textH = gMaxY - gMinY;

      // 2. Prepare Mask
      const fadeCanvas = createCanvas(w, h);
      const fCtx = fadeCanvas.getContext('2d');

      fCtx.drawImage(canvas, 0, 0);
      fCtx.globalCompositeOperation = 'destination-in';

      const cSolid = 'rgba(0,0,0,1)';
      const cFade = `rgba(0,0,0,${endsAt})`;

      // The "Safety Margin" - Fade finishes this % before the edge.
      // 0.15 = 15% from the edge.
      const buffer = 0.15;

      let grad;
      let radLimit = 0; // Store this for the Force Clear step

      // --- RADIAL (VIGNETTE) ---
      if (direction === 'Radial (Vignette)') {
        const halfW = textW / 2;
        const halfH = textH / 2;
        const maxR = Math.sqrt(halfW * halfW + halfH * halfH);

        grad = fCtx.createRadialGradient(cx, cy, 0, cx, cy, maxR);

        // 1. Define the "Wall" (Where visibility hits the 'endsAt' value)
        // We pull this back by the buffer amount.
        const wall = 1 - buffer;
        radLimit = maxR * wall; // Save absolute pixel radius for clipping later

        // 2. Define the "Safe Zone" (Solid Center)
        // The strength slider controls how far inward the fade starts from the wall.
        // If strength = 1, fade starts at center. If strength = 0, fade starts at wall (no fade).
        const safeRadius = Math.max(0, wall - (strength * wall));

        grad.addColorStop(0, cSolid);
        grad.addColorStop(safeRadius, cSolid);
        grad.addColorStop(wall, cFade);
        grad.addColorStop(1, cFade);
      }
      // --- DUAL AXIS ---
      else if (direction === 'Vertical (Both)') {
        grad = fCtx.createLinearGradient(0, gMinY, 0, gMaxY);
        const fadeSize = strength * 0.5;

        grad.addColorStop(0, cFade);
        grad.addColorStop(Math.min(0.5, buffer), cFade);
        grad.addColorStop(Math.min(0.5, buffer + fadeSize), cSolid);
        grad.addColorStop(Math.max(0.5, 1 - (buffer + fadeSize)), cSolid);
        grad.addColorStop(Math.max(0.5, 1 - buffer), cFade);
        grad.addColorStop(1, cFade);

      } else if (direction === 'Horizontal (Both)') {
        grad = fCtx.createLinearGradient(gMinX, 0, gMaxX, 0);
        const fadeSize = strength * 0.5;

        grad.addColorStop(0, cFade);
        grad.addColorStop(Math.min(0.5, buffer), cFade);
        grad.addColorStop(Math.min(0.5, buffer + fadeSize), cSolid);
        grad.addColorStop(Math.max(0.5, 1 - (buffer + fadeSize)), cSolid);
        grad.addColorStop(Math.max(0.5, 1 - buffer), cFade);
        grad.addColorStop(1, cFade);
      }
      // --- SINGLE AXIS ---
      else {
        let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
        if (direction === 'Bottom') { x0 = 0; y0 = gMinY; x1 = 0; y1 = gMaxY; }
        else if (direction === 'Top') { x0 = 0; y0 = gMaxY; x1 = 0; y1 = gMinY; }
        else if (direction === 'Right') { x0 = gMinX; y0 = 0; x1 = gMaxX; y1 = 0; }
        else if (direction === 'Left') { x0 = gMaxX; y0 = 0; x1 = gMinX; y1 = 0; }

        grad = fCtx.createLinearGradient(x0, y0, x1, y1);

        // Start Solid -> Safe Zone -> Wall (EndsAt) -> Physical Edge
        const wall = 1 - buffer;
        // How wide is the fade ramp? controlled by strength
        const rampSize = strength * wall;
        const safeZone = Math.max(0, wall - rampSize);

        grad.addColorStop(0, cSolid);
        grad.addColorStop(safeZone, cSolid);
        grad.addColorStop(wall, cFade);
        grad.addColorStop(1, cFade);
      }

      fCtx.fillStyle = grad;
      fCtx.fillRect(0, 0, w, h);

      // --- FORCE CLEAR (The Nuclear Option) ---
      // If endsAt is 0, we forcibly delete everything past the buffer zone.
      if (endsAt <= 0.05) {
        fCtx.globalCompositeOperation = 'destination-out';
        fCtx.fillStyle = 'rgba(0,0,0,1)';

        // Calculate the pixel margin based on bounds
        const bW = (gMaxX - gMinX) * buffer;
        const bH = (gMaxY - gMinY) * buffer;

        if (direction === 'Radial (Vignette)') {
          // Create hole mask using the calculated wall radius
          fCtx.beginPath();
          fCtx.rect(0, 0, w, h);
          // Cut out the safe circle (Counter-Clockwise)
          fCtx.arc(cx, cy, radLimit, 0, Math.PI * 2, true);
          fCtx.fill();
        }
        else if (direction === 'Bottom') fCtx.fillRect(0, gMaxY - bH, w, h);
        else if (direction === 'Top') fCtx.fillRect(0, 0, w, gMinY + bH);
        else if (direction === 'Right') fCtx.fillRect(gMaxX - bW, 0, w, h);
        else if (direction === 'Left') fCtx.fillRect(0, 0, gMinX + bW, h);

        else if (direction === 'Vertical (Both)') {
          fCtx.fillRect(0, 0, w, gMinY + bH);
          fCtx.fillRect(0, gMaxY - bH, w, h);
        }
        else if (direction === 'Horizontal (Both)') {
          fCtx.fillRect(0, 0, gMinX + bW, h);
          fCtx.fillRect(gMaxX - bW, 0, w, h);
        }
      }

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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
    }
  },

  outerGlow: {
    name: 'Outer Glow',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#00ff00' },
      { key: 'distance', label: 'Distance', type: 'range', min: 0, max: 100, step: 1, default: 15 },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 10, step: 0.1, default: 2.0 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const color = params.color ?? '#00ff00';
      const distance = params.distance ?? 15;
      const intensity = params.intensity ?? 2.0;

      const w = canvas.width;
      const h = canvas.height;

      // 1. SAVE ORIGINAL CONTENT (Critical Fix)
      // We must create a copy because 'canvas' will be cleared/modified
      const original = createCanvas(w, h);
      const oCtx = original.getContext('2d');
      oCtx.drawImage(canvas, 0, 0);

      // 2. Create Glow Source (Solid Color Mask from Original)
      const maskCanvas = createCanvas(w, h);
      const mCtx = maskCanvas.getContext('2d');
      mCtx.drawImage(original, 0, 0);
      mCtx.globalCompositeOperation = 'source-in';
      mCtx.fillStyle = color;
      mCtx.fillRect(0, 0, w, h);

      // 3. Clear Main Canvas
      ctx.clearRect(0, 0, w, h);

      // 4. Draw the Glow (Behind)
      ctx.save();
      ctx.filter = `blur(${distance}px)`;

      const passes = Math.ceil(intensity);
      const remainder = intensity - Math.floor(intensity);

      for (let i = 0; i < passes; i++) {
        ctx.globalAlpha = (i === passes - 1 && remainder > 0) ? remainder : 1;
        ctx.drawImage(maskCanvas, 0, 0);
      }
      ctx.restore();

      // 6. Draw Original Text (On Top)
      // We draw the SAVED COPY, ensuring the original pixels return perfectly
      ctx.drawImage(original, 0, 0);

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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      { key: 'seed', label: 'Seed', type: 'range', min: -2147483648, max: 2147483647, step: 1, default: 1 }
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      if (!found) return { canvas, ctx, abortSignal };

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

      return { canvas, ctx, abortSignal };
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
      if (!found) return { canvas, ctx, abortSignal };

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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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

      for (let i = 1; i <= steps; i++) {
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

      return { canvas, ctx, abortSignal };
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
      gCtx.fillRect(0, 0, w, h);

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
        bCtx.fillRect(0, 0, w, h); // Solid white text

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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
    }
  },

  bulge: {
    name: 'Bulge / Pinch',
    params: [
      { key: 'strength', label: 'Strength', type: 'range', min: -5, max: 5, step: 0.1, default: 0.5 },
      { key: 'radius', label: 'Radius', type: 'range', min: 10, max: 1000, step: 10, default: 200 },
      { key: 'offsetX', label: 'Center X', type: 'range', min: -1000, max: 1000, step: 10, default: 0 }, // New
      { key: 'offsetY', label: 'Center Y', type: 'range', min: -1000, max: 1000, step: 10, default: 0 }  // New
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
          const distSq = dx * dx + dy * dy;

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
              out[py * w + px] = src[iy * w + ix];
            } else {
              // If source pixel is outside canvas, leave empty (transparent)
              // or repeat edge? Transparent is cleaner.
            }

          } else {
            // Outside radius, copy original pixel as is
            out[py * w + px] = src[py * w + px];
          }
        }
      }

      outData.data.set(new Uint8ClampedArray(out.buffer));
      ctx.putImageData(outData, 0, 0);

      return { canvas, ctx, abortSignal };
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
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = 0;
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          if (data[(y * w + x) * 4 + 3] > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }
      if (minX > maxX) return { canvas, ctx, abortSignal }; // Empty

      const textWidth = maxX - minX;
      const textCenterX = minX + (textWidth / 2);

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
      const box = radius + (h / 2); // approximate max extent
      const minDestX = Math.max(0, Math.floor(cx - box));
      const maxDestX = Math.min(w, Math.ceil(cx + box));
      const minDestY = Math.max(0, Math.floor(cy - box));
      const maxDestY = Math.min(h, Math.ceil(cy + box));

      for (let py = minDestY; py < maxDestY; py++) {
        for (let px = minDestX; px < maxDestX; px++) {

          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

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
          if (Math.abs(deltaR) > h / 2) continue;

          // Map Angle to X
          // -Arc/2 to +Arc/2 maps to -Width/2 to +Width/2

          // Normalize angle within range
          // Wrap angle math is complex, simplified:
          while (angle <= -Math.PI) angle += Math.PI * 2;
          while (angle > Math.PI) angle -= Math.PI * 2;

          // Check if within our defined arc
          if (Math.abs(angle) > arc / 2) continue;

          // Ratio of angle to total arc
          const ratio = angle / (arc / 2); // -1 to 1

          // Map to Source X
          const sx = textCenterX + (ratio * (textWidth / 2));

          // Map to Source Y (Middle of text + delta)
          const sy = (h / 2) + deltaR;

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

      for (let i = 0; i < slices; i++) {
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
          -sliceWidth / 2, -h / 2, sliceWidth + 1, h // +1 to fix gaps
        );

        ctx.restore();
      }

      return { canvas, ctx, abortSignal };
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

      for (let i = 0; i < noiseMap.length; i++) {
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
        const idx = (Math.max(0, Math.min(noiseH - 1, iy)) * noiseW + Math.max(0, Math.min(noiseW - 1, ix))) * 2;
        return { x: noiseMap[idx], y: noiseMap[idx + 1] };
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

      return { canvas, ctx, abortSignal };
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

      return { canvas, ctx, abortSignal };
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
      if (amount <= 0) return { canvas, ctx, abortSignal };

      const w = canvas.width, h = canvas.height;
      const tempCanvas = createCanvas(w, h);
      const tCtx = tempCanvas.getContext('2d');

      // Use standard Canvas Filter (hardware accelerated in modern browsers)
      tCtx.filter = `blur(${amount}px)`;
      tCtx.drawImage(canvas, 0, 0);
      tCtx.filter = 'none';

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
      return { canvas, ctx, abortSignal };
    }
  },

  rotate: {
    name: 'Rotate',
    params: [
      { key: 'angle', label: 'Angle', type: 'range', min: -180, max: 180, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const angle = (params.angle ?? 0) * (Math.PI / 180);
      if (angle === 0) return { canvas, ctx, abortSignal };

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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      return { canvas, ctx, abortSignal };
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
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let hasText = false;
      for (let py = 0; py < h; py += 10) {
        for (let px = 0; px < w; px += 10) {
          if (data[(py * w + px) * 4 + 3] > 0) {
            if (px < minX) minX = px; if (px > maxX) maxX = px;
            if (py < minY) minY = py; if (py > maxY) maxY = py;
            hasText = true;
          }
        }
      }
      if (!hasText) { minX = 0; maxX = w; minY = 0; maxY = h; }

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
        for (let j = 0; j < satellites; j++) {
          const angle = rng() * Math.PI * 2;
          const dist = size * (1.5 + rng() * 3);
          const sSize = size * 0.3 * rng();
          // Higher distortion on satellites creates jagged specks
          drawBlob(sCtx, dx + Math.cos(angle) * dist, dy + Math.sin(angle) * dist, sSize, Math.min(1, distortion + 0.2));
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
        sCtx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(splashCanvas, 0, 0);
      }

      return { canvas, ctx, abortSignal };
    }
  },








  sauronFire: {
    name: 'Sauron / Magma',
    params: [
      { type: 'span', label: 'Colors' },
      { key: 'innerColor', label: 'Magma Color', type: 'color', default: '#ffb000' },
      { key: 'outerColor', label: 'Crust Color', type: 'color', default: '#ff3300' },
      { key: 'hotspotColor', label: 'Hotspot Color', type: 'color', default: '#ffffcc' },

      { type: 'span', label: 'Texture' },
      { key: 'scale', label: 'Scale', type: 'range', min: 10, max: 100, step: 1, default: 40 },
      { key: 'warp', label: 'Flow', type: 'range', min: 0, max: 50, step: 1, default: 20 },
      { key: 'veins', label: 'Veins', type: 'range', min: 0, max: 2, step: 0.1, default: 0.5 },

      { type: 'span', label: 'Pupil' },
      { key: 'pupilWidth', label: 'Width', type: 'range', min: 0, max: 100, step: 1, default: 25 },
      { key: 'pupilHeight', label: 'Height %', type: 'range', min: 10, max: 100, step: 1, default: 80 },
      { key: 'pupilFade', label: 'Edge Fade', type: 'range', min: 0, max: 50, step: 1, default: 10 },
      { key: 'pupilRim', label: 'Rim Glow', type: 'range', min: 0, max: 2, step: 0.1, default: 1.2 },
      { key: 'pupilOffset', label: 'Shift X', type: 'range', min: -100, max: 100, step: 1, default: 0 },
      { key: 'pupilOffsetY', label: 'Shift Y', type: 'range', min: -100, max: 100, step: 1, default: 0 },

      { type: 'span', label: 'Effects' },
      { key: 'glowSize', label: 'Outer Glow Size', type: 'range', min: 0, max: 200, step: 1, default: 60 },
      { key: 'glowIntensity', label: 'Glow Strength', type: 'range', min: 0, max: 10, step: 0.1, default: 1.5 },
      { key: 'showBase', label: 'Show Text Base', type: 'checkbox', default: false, className: 'optioncheckbox' },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      // 1. Parse Parameters
      const scale = params.scale ?? 40;
      const warp = params.warp ?? 20;
      const veinsStrength = params.veins ?? 0.5;
      const seed = params.seed ?? 1;

      const pupilWidth = params.pupilWidth ?? 25;
      const pupilHeightPerc = (params.pupilHeight ?? 80) / 100;
      const pupilOffsetX = params.pupilOffset ?? 0;
      const pupilOffsetY = params.pupilOffsetY ?? 0;
      const pupilFade = params.pupilFade ?? 10;
      const pupilRimStr = params.pupilRim ?? 1.2;

      const glowSize = params.glowSize ?? 60;
      const glowIntensity = params.glowIntensity ?? 1.5;
      const showBase = params.showBase ?? false;

      const cIn = hexToRgb(params.innerColor ?? '#ffb000');
      const cOut = hexToRgb(params.outerColor ?? '#ff3300');
      const cHot = hexToRgb(params.hotspotColor ?? '#ffffcc');

      const w = canvas.width;
      const h = canvas.height;

      // 2. Detect Bounding Box
      // We scan the canvas to find where the text actually lives.
      const rawData = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let found = false;

      for (let py = 0; py < h; py += 4) {
        for (let px = 0; px < w; px += 4) {
          if (rawData[(py * w + px) * 4 + 3] > 0) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            found = true;
          }
        }
      }

      // If empty, just return
      if (!found) return { canvas, ctx };

      // Add a small padding to bounds for safety
      minX = Math.max(0, minX - 2);
      minY = Math.max(0, minY - 2);
      maxX = Math.min(w, maxX + 2);
      maxY = Math.min(h, maxY + 2);

      const textW = maxX - minX;
      const textH = maxY - minY;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // 3. Copy text mask
      const textMask = createCanvas(w, h);
      const tmCtx = textMask.getContext('2d');
      tmCtx.drawImage(canvas, 0, 0);

      // 4. Deterministic Random
      let _s = seed * 4567;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // 5. Generate Fractal Noise Map (Covering full canvas for safety)
      const noiseW = Math.ceil(w / 4);
      const noiseH = Math.ceil(h / 4);
      const noiseMap = new Float32Array(noiseW * noiseH);

      const generateLayer = (freq, amp) => {
        const gridW = Math.ceil(noiseW / freq);
        const gridH = Math.ceil(noiseH / freq);
        const grid = new Float32Array(gridW * gridH);
        for (let i = 0; i < grid.length; i++) grid[i] = rng();

        for (let y = 0; y < noiseH; y++) {
          for (let x = 0; x < noiseW; x++) {
            const gx = x / freq; const gy = y / freq;
            const ix = Math.floor(gx); const iy = Math.floor(gy);
            const fx = gx - ix; const fy = gy - iy;

            const i1 = (iy * gridW + ix) % grid.length;
            const i2 = (iy * gridW + (ix + 1)) % grid.length;
            const i3 = ((iy + 1) * gridW + ix) % grid.length;
            const i4 = ((iy + 1) * gridW + (ix + 1)) % grid.length;

            const top = grid[i1] + (grid[i2] - grid[i1]) * fx;
            const bot = grid[i3] + (grid[i4] - grid[i3]) * fx;
            const val = top + (bot - top) * fy;
            noiseMap[y * noiseW + x] += val * amp;
          }
        }
      };

      generateLayer(scale / 4, 1.0);
      generateLayer(scale / 8, 0.5);
      generateLayer(scale / 16, 0.25);

      // 6. Render Fire Texture
      const fireCanvas = createCanvas(w, h);
      const fCtx = fireCanvas.getContext('2d');
      const imgData = fCtx.createImageData(w, h);
      const data = imgData.data;

      // Pupil Geometry (Relative to Text Height)
      const pRadiusY = (textH / 2) * pupilHeightPerc;
      const pupilCX = cx + pupilOffsetX;
      const pupilCY = cy + pupilOffsetY;

      // Optimization: Only loop through the bounding box
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Normalize distance based on text size (avg of width/height)
          const normDist = dist / (Math.min(textW, textH) * 0.6);

          // Noise Sample
          const nx = Math.floor(x / 4);
          const ny = Math.floor(y / 4);
          // Bounds check for noise array
          let nVal = 0;
          if (nx >= 0 && nx < noiseW && ny >= 0 && ny < noiseH) {
            nVal = noiseMap[ny * noiseW + nx];
          }
          nVal /= 1.75;

          // -- Heat Calculation --
          let heat = (nVal * 0.4) + ((1 - normDist) * 0.9);
          heat += (nVal - 0.5) * (warp / 100);

          // -- Pupil Calculation --
          const pDx = x - pupilCX;
          const pDy = y - pupilCY;
          const absDy = Math.abs(pDy);
          let inPupil = false;
          let rimFactor = 0;
          let alpha = 255;

          if (pupilWidth > 0 && pRadiusY > 0) {
            if (absDy < pRadiusY) {
              const yRatio = absDy / pRadiusY;
              // Base elliptical width
              const allowedW = pupilWidth * Math.sqrt(1 - yRatio * yRatio);
              const absDx = Math.abs(pDx);

              if (absDx < allowedW) {
                inPupil = true;

                const edgeDist = allowedW - absDx;

                if (pupilFade > 0) {
                  const fadeProgress = Math.max(0, Math.min(1, edgeDist / pupilFade));
                  alpha = Math.floor(255 * (1 - fadeProgress));
                } else {
                  alpha = 0;
                }
              } else {
                const distToEdge = absDx - allowedW;
                if (distToEdge < 20) {
                  rimFactor = Math.pow(1 - (distToEdge / 20), 2) * pupilRimStr;
                }
              }
            }
          }

          // Boost heat if near rim
          heat += rimFactor * 0.5;

          // -- Veins --
          let electric = 0;
          if (veinsStrength > 0) electric = Math.pow(nVal, 8) * veinsStrength;

          // -- Color Mixing --
          let r, g, b;

          heat = Math.max(0, Math.min(1, heat));

          r = lerp(cOut.r, cIn.r, heat);
          g = lerp(cOut.g, cIn.g, heat);
          b = lerp(cOut.b, cIn.b, heat);

          if (electric > 0) {
            r += electric * 255;
            g += electric * 255;
            b += electric * 255;
          }

          if (heat > 0.75) {
            const core = (heat - 0.75) / 0.25;
            r = lerp(r, cHot.r, core);
            g = lerp(g, cHot.g, core);
            b = lerp(b, cHot.b, core);
          }

          const idx = (y * w + x) * 4;
          data[idx] = Math.min(255, r);
          data[idx + 1] = Math.min(255, g);
          data[idx + 2] = Math.min(255, b);
          data[idx + 3] = alpha;
        }
      }
      fCtx.putImageData(imgData, 0, 0);

      // 7. Mask Fire to Text
      fCtx.globalCompositeOperation = 'destination-in';
      fCtx.drawImage(textMask, 0, 0);

      // 8. Final Composite
      ctx.clearRect(0, 0, w, h);

      // A. Draw Base Text
      if (showBase) {
        ctx.save();
        ctx.drawImage(textMask, 0, 0);
        ctx.restore();
      }

      // B. Outer Glow
      if (glowSize > 0 && glowIntensity > 0) {
        ctx.save();
        ctx.shadowColor = params.outerColor ?? '#ff3300';
        ctx.shadowBlur = glowSize;

        const passes = Math.min(10, Math.ceil(glowIntensity));
        const baseAlpha = glowIntensity > 10 ? (glowIntensity / 10) : 1;

        for (let i = 0; i < passes; i++) {
          let alpha = baseAlpha;
          if (glowIntensity < passes && i === passes - 1) {
            alpha = glowIntensity - Math.floor(glowIntensity);
          }
          ctx.globalAlpha = alpha;
          ctx.drawImage(textMask, 0, 0);
        }
        ctx.restore();
      }

      // C. Draw Fire Texture
      ctx.drawImage(fireCanvas, 0, 0);

      return { canvas, ctx };
    }
  },



  chiseledMetal: {
    name: 'Gold / Chiseled Metal',
    params: [
      { type: 'span', label: 'Material' },
      { key: 'color', label: 'Base Color', type: 'color', default: '#c6a324' }, // LOTR Gold
      { key: 'shine', label: 'Specular', type: 'range', min: 0, max: 2, step: 0.1, default: 1.2 },
      { key: 'roughness', label: 'Weathering', type: 'range', min: 0, max: 20, step: 1, default: 14 },

      { type: 'span', label: 'Geometry' },
      { key: 'depth', label: 'Bevel Depth', type: 'range', min: 1, max: 50, step: 1, default: 28 },
      { key: 'lightAngle', label: 'Light Angle', type: 'range', min: 0, max: 360, step: 10, default: 210 },

      { key: 'seed', label: 'Texture Seed', type: 'range', min: 1, max: 100, step: 1, default: 46 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const colorHex = params.color ?? '#c6a324';
      const depth = params.depth ?? 28; // Controls the "Blur" radius for height map
      const roughness = params.roughness ?? 14; // Noise intensity
      const shine = params.shine ?? 1.2;
      const angle = (params.lightAngle ?? 210) * (Math.PI / 180);
      const seed = params.seed ?? 46;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Create HEIGHT MAP (The 3D Shape)
      // We use a blur filter. 
      // Edges = Gray, Center = White. This creates a "Dome" or "Bevel" shape data.
      const heightCanvas = createCanvas(w, h);
      const hCtx = heightCanvas.getContext('2d');
      hCtx.drawImage(canvas, 0, 0);

      // Force text to white for the map
      hCtx.globalCompositeOperation = 'source-in';
      hCtx.fillStyle = '#fff';
      hCtx.fillRect(0, 0, w, h);

      // Apply blur to create the slopes
      // We draw it multiple times to smooth the gradient (Box Blur approx)
      hCtx.filter = `blur(${depth}px)`;
      hCtx.globalCompositeOperation = 'source-over';
      hCtx.drawImage(heightCanvas, 0, 0); // Self-draw to reinforce core
      hCtx.drawImage(heightCanvas, 0, 0);
      hCtx.filter = 'none';

      // 2. Get Data Buffers
      // We need to read pixels to calculate lighting math manually
      const srcData = ctx.getImageData(0, 0, w, h); // Original text (for alpha mask)
      const heightData = hCtx.getImageData(0, 0, w, h).data; // The blurred height map
      const output = ctx.createImageData(w, h);
      const outData = output.data;
      const sData = srcData.data;

      // Light Vector (Normalised)
      // Lighting coming from top-left usually
      const lx = Math.cos(angle);
      const ly = Math.sin(angle);
      const lz = 0.5; // Light comes slightly from front

      // Normalize Light Vector
      const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
      const LnX = lx / lLen; const LnY = ly / lLen; const LnZ = lz / lLen;

      // Base Color RGB
      const baseC = hexToRgb(colorHex);

      // Deterministic Noise Generator
      let _s = seed * 999;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // Pre-generate a noise buffer for performance
      // We use a smaller noise map and tile it to save loops
      const noiseSize = 256;
      const noise = new Float32Array(noiseSize * noiseSize);
      for (let i = 0; i < noise.length; i++) noise[i] = rng();

      // Loop Pixels
      for (let y = 1; y < h - 1; y++) {
        // Optimization: Calculate row offsets once
        const rowOffset = y * w;
        const prevRow = (y - 1) * w;
        const nextRow = (y + 1) * w;

        for (let x = 1; x < w - 1; x++) {
          const idx = (rowOffset + x) * 4;

          // Skip if original text is transparent (Optimization)
          const alpha = sData[idx + 3];
          if (alpha < 10) continue;

          // --- A. Sample Height ---
          // We use the Green channel of the blurred map as "Height"
          // (0 = low/edge, 255 = high/center)
          let hVal = heightData[idx + 1];

          // --- B. Apply Weathering (Noise) ---
          // We subtract noise from height to create "Dents"
          // Map x,y to noise buffer
          const nx = x % noiseSize;
          const ny = y % noiseSize;
          const nVal = noise[ny * noiseSize + nx];

          // "Carve" the surface
          // We only carve if we have some height (don't destroy the very edge)
          if (hVal > 10) {
            hVal -= (nVal * roughness);
          }

          // --- C. Compute Surface Normals (Sobel-ish) ---
          // Look at neighbors to see "which way is up"
          // dx = height(right) - height(left)
          // dy = height(bottom) - height(top)

          // Note: We need to sample the *weathered* height for neighbors for true bump mapping
          // But sampling pure blur is smoother and faster. 
          // Let's sample the blur map, because calculating noise for neighbors is heavy.
          // We add the noise randomness to the normal vector directly instead.

          const hL = heightData[(rowOffset + x - 1) * 4 + 1];
          const hR = heightData[(rowOffset + x + 1) * 4 + 1];
          const hT = heightData[(prevRow + x) * 4 + 1];
          const hB = heightData[(nextRow + x) * 4 + 1];

          let nxVec = (hL - hR); // Slope X
          let nyVec = (hT - hB); // Slope Y
          let nzVec = 20; // Z pointing up (flatness). Lower = steeper slopes.

          // Apply Noise to Normal (Bump Mapping)
          // This creates the small surface scratches
          nxVec += (nVal - 0.5) * roughness * 2;
          nyVec += (nVal - 0.5) * roughness * 2;

          // Normalize Surface Normal
          const len = Math.sqrt(nxVec * nxVec + nyVec * nyVec + nzVec * nzVec);
          const Nnx = nxVec / len;
          const Nny = nyVec / len;
          const Nnz = nzVec / len;

          // --- D. Lighting Calculations (Phong) ---

          // 1. Diffuse (Dot Product of Light & Normal)
          // How much light hits this angle?
          let diffuse = (Nnx * LnX + Nny * LnY + Nnz * LnZ);
          // Clamp (No negative light)
          if (diffuse < 0) diffuse = 0;

          // 2. Specular (Reflection)
          // Blinn-Phong approximation or simple reflection
          // Reflection vector R = 2*(N.L)*N - L
          // View vector V is roughly [0,0,1] (looking straight on)
          // Specular = (R.V)^shininess

          // Simplified: Raise diffuse to power for highlights
          let specular = Math.pow(diffuse, 10) * shine;

          // 3. Ambient Occlusion (Fake)
          // Deep crevices (low height) should be darker
          // hVal is 0..255. 
          const ao = Math.min(1, hVal / 50); // Darken edges

          // --- E. Combine Colors ---
          // Metal Color * Diffuse + White * Specular

          let r = baseC.r * (0.2 + diffuse * 0.8) * ao;
          let g = baseC.g * (0.2 + diffuse * 0.8) * ao;
          let b = baseC.b * (0.2 + diffuse * 0.8) * ao;

          // Add Specular (White hot highlights)
          r += specular * 255;
          g += specular * 255;
          b += specular * 255;

          outData[idx] = Math.min(255, r);
          outData[idx + 1] = Math.min(255, g);
          outData[idx + 2] = Math.min(255, b);
          outData[idx + 3] = alpha; // Keep original alpha
        }
      }

      ctx.putImageData(output, 0, 0);
      return { canvas, ctx };
    }
  },

  engravedMetal: {
    name: 'Engraved / LOTR',
    params: [
      { type: 'span', label: 'Material' },
      { key: 'color', label: 'Metal Color', type: 'color', default: '#eeb244' }, // LOTR Gold
      { key: 'shine', label: 'Specular', type: 'range', min: 0, max: 3, step: 0.1, default: 1.5 },
      { key: 'roughness', label: 'Hammered Grain', type: 'range', min: 0, max: 20, step: 1, default: 5 }, // High grain for that ancient look

      { type: 'span', label: 'Chisel Geometry' },
      { key: 'mode', label: 'Type', type: 'select', options: ['Raised (Relief)', 'Engraved (Indent)'], default: 'Raised (Relief)' },
      { key: 'bevel', label: 'Bevel Width', type: 'range', min: 1, max: 100, step: 1, default: 10 }, // Controls Plateau size
      { key: 'depth', label: 'Z Intensity', type: 'range', min: 1, max: 100, step: 1, default: 30 },   // Controls Contrast
      { key: 'profile', label: 'Edge Profile', type: 'range', min: 0.1, max: 2, step: 0.1, default: 0.4 }, // 0.4 = Sharp Chisel, 1.0 = Round Dome
      { key: 'lightAngle', label: 'Light Angle', type: 'range', min: 0, max: 360, step: 10, default: 135 },

      { type: 'span', label: 'Generation' },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const colorHex = params.color ?? '#eeb244';
      const bevel = params.bevel ?? 10;
      const depth = params.depth ?? 30;
      const profile = params.profile ?? 0.4;
      const shineStr = params.shine ?? 1.5;
      const roughness = params.roughness ?? 5;
      const angle = (params.lightAngle ?? 135) * (Math.PI / 180);
      const isIndent = params.mode === 'Engraved (Indent)';
      const seed = params.seed ?? 1;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Generate Height Map (The 3D Shape)
      const mapCanvas = createCanvas(w, h);
      const mCtx = mapCanvas.getContext('2d');
      mCtx.drawImage(canvas, 0, 0);

      // Flatten text to white silhouette
      mCtx.globalCompositeOperation = 'source-in';
      mCtx.fillStyle = '#fff';
      mCtx.fillRect(0, 0, w, h);

      // Create the slope gradient using blur
      mCtx.filter = `blur(${bevel}px)`;
      mCtx.globalCompositeOperation = 'source-over';
      // Triple draw to harden the gaussian curve into something closer to linear/box
      mCtx.drawImage(mapCanvas, 0, 0);
      mCtx.drawImage(mapCanvas, 0, 0);
      mCtx.drawImage(mapCanvas, 0, 0);
      mCtx.filter = 'none';

      // 2. Processing
      const srcData = ctx.getImageData(0, 0, w, h);
      const mapData = mCtx.getImageData(0, 0, w, h).data;
      const output = ctx.createImageData(w, h);
      const outData = output.data;
      const sData = srcData.data;

      // Light Vector
      const lx = Math.cos(angle);
      const ly = Math.sin(angle);
      const lz = 0.5;
      const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
      const LnX = lx / lLen; const LnY = ly / lLen; const LnZ = lz / lLen;

      const baseC = hexToRgb(colorHex);

      // Pre-calc Hammered Noise (Deterministic)
      const noise = new Float32Array(w * h);
      if (roughness > 0) {
        let _s = seed * 1234;
        const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };
        for (let i = 0; i < noise.length; i++) noise[i] = rng() - 0.5;
      }

      for (let y = 1; y < h - 1; y++) {
        const rowOffset = y * w;
        for (let x = 1; x < w - 1; x++) {
          const idx = (rowOffset + x) * 4;
          const alpha = sData[idx + 3];

          if (alpha < 5) continue;

          // --- A. Sample & Profile Correction ---
          // Get height (0..1)
          let hRaw = mapData[idx + 1] / 255;

          // This is the magic. 
          // Gaussian blur makes a dome (ease-in-out). 
          // We apply a Power curve to force it into a straight Pyramid (linear) or sharp Indent.
          // profile < 1.0 sharpens the top (Chisel). profile > 1.0 rounds it (Dome).
          let hVal = Math.pow(hRaw, profile) * 255;

          // --- B. Surface Normals ---
          // We differentiate the profiled height map
          const hL_raw = mapData[(rowOffset + x - 1) * 4 + 1] / 255;
          const hR_raw = mapData[(rowOffset + x + 1) * 4 + 1] / 255;
          const hT_raw = mapData[((y - 1) * w + x) * 4 + 1] / 255;
          const hB_raw = mapData[((y + 1) * w + x) * 4 + 1] / 255;

          const hL = Math.pow(hL_raw, profile) * 255;
          const hR = Math.pow(hR_raw, profile) * 255;
          const hT = Math.pow(hT_raw, profile) * 255;
          const hB = Math.pow(hB_raw, profile) * 255;

          let nx = (hL - hR);
          let ny = (hT - hB);

          // If Engraved, we invert the normals (light hits bottom-right instead of top-left)
          if (isIndent) {
            nx = -nx;
            ny = -ny;
          }

          // Apply Hammered Grain
          if (roughness > 0) {
            const n = noise[y * w + x] * roughness * 3;
            nx += n;
            ny += n;
          }

          // Depth scales the Z component. 
          // Higher depth input = Lower Z = Steeper appearance.
          const nz = 2550 / Math.max(1, depth);

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const NdotL = (nx * LnX + ny * LnY + nz * LnZ) / len;

          // --- C. Lighting ---
          let light = Math.max(0, NdotL); // Diffuse

          // Metallic Specular (Sharper highlight curve -> pow 16)
          let spec = Math.pow(light, 16) * shineStr;

          // Edge Occlusion / Crevice Shadow
          // If raised: darken edges (low height).
          // If engraved: darken center (high height map value = deep hole).
          let ao = 1;
          if (isIndent) {
            // For indent, the "top" of the blur is the "bottom" of the hole.
            // We want deep holes to be darker.
            ao = 0.4 + (1 - (hVal / 255)) * 0.6;
          } else {
            // For raised, low height is the edge near background.
            ao = 0.4 + (hVal / 255) * 0.6;
          }

          // --- D. Combine ---
          let r = baseC.r * (0.2 + light * 0.8) * ao;
          let g = baseC.g * (0.2 + light * 0.8) * ao;
          let b = baseC.b * (0.2 + light * 0.8) * ao;

          r += spec * 255;
          g += spec * 255;
          b += spec * 255;

          outData[idx] = Math.min(255, r);
          outData[idx + 1] = Math.min(255, g);
          outData[idx + 2] = Math.min(255, b);
          outData[idx + 3] = alpha;
        }
      }

      ctx.putImageData(output, 0, 0);
      return { canvas, ctx };
    }
  },

  plasma: {
    name: 'Plasma / Electricity',
    params: [
      { type: 'span', label: 'Colors' },
      { key: 'coreColor', label: 'Core Color', type: 'color', default: '#ffffff' },
      { key: 'glowColor', label: 'Glow Color', type: 'color', default: '#00ccff' },

      { type: 'span', label: 'Structure' },
      { key: 'strands', label: 'Strand Count', type: 'range', min: 2, max: 100, step: 1, default: 20 },
      { key: 'sharpness', label: 'Sharpness', type: 'range', min: 1, max: 20, step: 0.5, default: 8 },
      { key: 'detail', label: 'Detail/Grit', type: 'range', min: 0, max: 2, step: 0.1, default: 1.0 },

      { type: 'span', label: 'Motion' },
      { key: 'warp', label: 'Distortion', type: 'range', min: 0, max: 50, step: 1, default: 15 },
      { key: 'flow', label: 'Radial Flow', type: 'range', min: 0, max: 5, step: 0.1, default: 1 },

      { type: 'span', label: 'Origin' },
      { key: 'centerX', label: 'Center X', type: 'range', min: -500, max: 500, step: 10, default: 0 },
      { key: 'centerY', label: 'Center Y', type: 'range', min: -500, max: 500, step: 10, default: 0 },

      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const strands = params.strands ?? 20;
      const sharpness = params.sharpness ?? 8;
      const detail = params.detail ?? 1.0;
      const warpStr = params.warp ?? 15;
      const flow = params.flow ?? 1;
      const seed = params.seed ?? 1;
      const offX = params.centerX ?? 0;
      const offY = params.centerY ?? 0;

      // Inline Helper: Hex to RGB (Safety)
      const toRgb = (hex) => {
        const n = parseInt(hex.replace('#', ''), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      };
      const cCore = toRgb(params.coreColor ?? '#ffffff');
      const cGlow = toRgb(params.glowColor ?? '#00ccff');

      const w = canvas.width;
      const h = canvas.height;
      const cx = (w / 2) + offX;
      const cy = (h / 2) + offY;

      // 1. Deterministic Random
      let _s = seed * 9999;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // 2. Setup Noise Buffer
      const noiseSize = 256;
      const noise = new Float32Array(noiseSize * noiseSize);
      for (let i = 0; i < noise.length; i++) noise[i] = rng();

      // Safe Bilinear Sample (Handles negative coordinates correctly)
      const getNoise = (x, y) => {
        let ix = Math.floor(x);
        let iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;

        // Safe Modulo for wrapping
        const wrap = (v, max) => ((v % max) + max) % max;

        const iX0 = wrap(ix, noiseSize);
        const iY0 = wrap(iy, noiseSize);
        const iX1 = wrap(ix + 1, noiseSize);
        const iY1 = wrap(iy + 1, noiseSize);

        const i00 = iY0 * noiseSize + iX0;
        const i10 = iY0 * noiseSize + iX1;
        const i01 = iY1 * noiseSize + iX0;
        const i11 = iY1 * noiseSize + iX1;

        const top = noise[i00] + (noise[i10] - noise[i00]) * fx;
        const bot = noise[i01] + (noise[i11] - noise[i01]) * fx;
        return top + (bot - top) * fy;
      };

      // 3. Render Plasma Texture
      const pCanvas = createCanvas(w, h);
      const pCtx = pCanvas.getContext('2d');
      const imgData = pCtx.createImageData(w, h);
      const data = imgData.data;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {

          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let angle = Math.atan2(dy, dx);

          // Warp: Use safe noise function
          const warpNoise = getNoise(dx * 0.05, dy * 0.05);
          angle += (warpNoise - 0.5) * (warpStr / 100);

          // Polar Mapping
          const u = ((angle + Math.PI) / (Math.PI * 2)) * strands;
          const v = dist * 0.02 * flow;

          // FBM Noise
          let n = 0;
          n += getNoise(u, v);
          n += getNoise(u * 2, v * 2) * 0.5 * detail;
          n += getNoise(u * 4, v * 4) * 0.25 * detail;

          n /= (1.75);

          // Ridge Filter (Lightning)
          let electricity = 1 - Math.abs((n - 0.5) * 2);
          electricity = Math.pow(electricity, sharpness);

          // Color Mapping
          let r, g, b, a;

          if (electricity < 0.1) {
            r = 0; g = 0; b = 0; a = 0;
          } else {
            // Mix Glow -> Core
            const t = (electricity - 0.1) / 0.9;

            // Manual Lerp
            r = cGlow.r + (cCore.r - cGlow.r) * (t * t);
            g = cGlow.g + (cCore.g - cGlow.g) * (t * t);
            b = cGlow.b + (cCore.b - cGlow.b) * (t * t);

            a = Math.min(255, t * 255 * 2);
          }

          const idx = (py * w + px) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }

      pCtx.putImageData(imgData, 0, 0);

      // 4. Mask to Text
      pCtx.globalCompositeOperation = 'destination-in';
      pCtx.drawImage(canvas, 0, 0);

      // 5. Final Composite
      ctx.clearRect(0, 0, w, h);

      // Draw Plasma
      ctx.drawImage(pCanvas, 0, 0);

      // Add Over-Glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(4px)';
      ctx.globalAlpha = 0.6;
      ctx.drawImage(pCanvas, 0, 0);
      ctx.restore();

      return { canvas, ctx };
    }
  },


  frozen: {
    name: 'Frozen / Ice',
    params: [
      { key: 'color', label: 'Ice Color', type: 'color', default: '#aaccff' },
      { key: 'freeze', label: 'Frost Amount', type: 'range', min: 0, max: 100, step: 1, default: 50 },
      { key: 'icicles', label: 'Icicle Length', type: 'range', min: 0, max: 100, step: 1, default: 30 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const colorHex = params.color ?? '#aaccff';
      const freeze = params.freeze ?? 50;
      const icicleLen = params.icicles ?? 30;
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      // 1. Prepare Base (White/Blue Tint)
      // We want the text to look like ice, so we lighten it or tint it.
      const iceBase = createCanvas(w, h);
      const iCtx = iceBase.getContext('2d');
      iCtx.drawImage(canvas, 0, 0);

      // Tint
      iCtx.globalCompositeOperation = 'source-atop';
      iCtx.fillStyle = colorHex;
      iCtx.globalAlpha = 0.6;
      iCtx.fillRect(0, 0, w, h);
      iCtx.globalAlpha = 1;

      // 2. Generate Icicles (Displacement)
      // We create a "drip map" where noise defines how far pixels fall.
      let _s = seed * 111;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const dripMap = new Float32Array(w);
      // Generate noise spikes for icicles
      for (let i = 0; i < w; i++) {
        // Low frequency noise for main icicle shapes
        const n1 = Math.sin(i * 0.05 + seed) * 0.5 + 0.5;
        // High frequency for jaggedness
        const n2 = Math.sin(i * 0.2 + seed * 2) * 0.2;

        // Threshold: Only form icicles in "valleys"
        let d = Math.max(0, n1 + n2 - 0.4);
        dripMap[i] = d * icicleLen * 2; // Scale up
      }

      const icicleCanvas = createCanvas(w, h);
      const icCtx = icicleCanvas.getContext('2d');

      // Pixel displacement loop
      // We scan columns. If we find a solid pixel at the bottom of the text,
      // we "smear" it downwards based on dripMap.
      const srcData = iCtx.getImageData(0, 0, w, h);
      const dstData = icCtx.createImageData(w, h);
      const sD = srcData.data;
      const dD = dstData.data;

      for (let x = 0; x < w; x++) {
        const drop = Math.floor(dripMap[x]);
        if (drop <= 0) {
          // Just copy column
          for (let y = 0; y < h; y++) {
            const idx = (y * w + x) * 4;
            dD[idx] = sD[idx]; dD[idx + 1] = sD[idx + 1]; dD[idx + 2] = sD[idx + 2]; dD[idx + 3] = sD[idx + 3];
          }
          continue;
        }

        // Find the "bottom" of the text in this column
        let lastY = -1;
        for (let y = h - 1; y >= 0; y--) {
          if (sD[(y * w + x) * 4 + 3] > 10) {
            lastY = y;
            break;
          }
        }

        // Copy original
        for (let y = 0; y < h; y++) {
          const idx = (y * w + x) * 4;
          dD[idx] = sD[idx]; dD[idx + 1] = sD[idx + 1]; dD[idx + 2] = sD[idx + 2]; dD[idx + 3] = sD[idx + 3];
        }

        // Draw icicle
        if (lastY > -1) {
          // Taper: The icicle gets thinner/transparent as it goes down?
          // Simple smear:
          for (let d = 1; d <= drop; d++) {
            const y = lastY + d;
            if (y >= h) break;

            // Taper alpha/width
            const progress = d / drop;
            // If we want pointy icicles, we should narrow the x-width, but we are in a column loop.
            // Instead, we fade opacity.
            const alpha = sD[(lastY * w + x) * 4 + 3] * (1 - progress);

            const idx = (y * w + x) * 4;
            const srcIdx = (lastY * w + x) * 4;

            dD[idx] = sD[srcIdx]; // R
            dD[idx + 1] = sD[srcIdx + 1]; // G
            dD[idx + 2] = sD[srcIdx + 2]; // B
            dD[idx + 3] = alpha;
          }
        }
      }
      icCtx.putImageData(dstData, 0, 0);

      // 3. Frost Texture (Crystalline Noise)
      // Overlay white noise to look like frost
      icCtx.globalCompositeOperation = 'source-atop';

      // Draw some "snow/frost" noise
      const frostAmt = freeze;
      if (frostAmt > 0) {
        const noiseC = createCanvas(w, h);
        const nCtx = noiseC.getContext('2d');
        const nID = nCtx.createImageData(w, h);
        const nD = nID.data;

        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          const n = rng();
          // Create scattered white specs
          if (n > 0.7) {
            const val = 255;
            const a = (n - 0.7) / 0.3 * (frostAmt / 100) * 255;
            nD[idx] = val; nD[idx + 1] = val; nD[idx + 2] = val; nD[idx + 3] = a;
          }
        }
        nCtx.putImageData(nID, 0, 0);
        icCtx.drawImage(noiseC, 0, 0);
      }

      // 4. Rim Light (White Edge)
      // Simulate ice reflecting light at edges
      icCtx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      // Draw result
      ctx.drawImage(icicleCanvas, 0, 0);

      // Add shine
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      // We don't have a path, but we can fake an edge glow by 
      // drawing the original text offset by -1,-1 in white
      ctx.drawImage(canvas, -1, -1);
      ctx.restore();

      return { canvas, ctx };
    }
  },

  matrix: {
    name: 'Matrix / Data',
    params: [
      { key: 'color', label: 'Code Color', type: 'color', default: '#00ff00' },
      { key: 'density', label: 'Density', type: 'range', min: 10, max: 50, step: 1, default: 20 },
      { key: 'speed', label: 'Rain Speed', type: 'range', min: 0, max: 100, step: 1, default: 50 }, // For static image, this is "Progress"
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const color = params.color ?? '#00ff00';
      const density = params.density ?? 20; // Column width approx
      const progress = params.speed ?? 50;
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 333;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // 1. Create Data Rain
      const mCanvas = createCanvas(w, h);
      const mCtx = mCanvas.getContext('2d');

      mCtx.fillStyle = '#000'; // Dark background for the code
      mCtx.fillRect(0, 0, w, h);

      mCtx.font = `${density}px monospace`;
      mCtx.fillStyle = color;

      const cols = Math.ceil(w / density);

      for (let i = 0; i < cols; i++) {
        const xPos = i * density;

        // Random start Y for this column
        // We use time/progress to shift it
        const speedOffset = (rng() * 2 + 1) * (progress * 10);
        const yStart = (rng() * h) + speedOffset;

        // Draw a trail
        const trailLen = 10 + rng() * 20;

        for (let j = 0; j < trailLen; j++) {
          const yPos = (yStart - (j * density)) % (h + 200) - 100; // Wrap
          if (yPos > h || yPos < -density) continue;

          // Character
          const char = String.fromCharCode(0x30A0 + Math.floor(rng() * 96)); // Katakana
          // or Binary: (rng()>0.5 ? '1' : '0')

          // Opacity (Head is bright, tail is dim)
          const alpha = 1 - (j / trailLen);

          mCtx.globalAlpha = alpha;

          // Head glows white
          if (j === 0) {
            mCtx.fillStyle = '#fff';
            mCtx.shadowColor = color;
            mCtx.shadowBlur = 10;
          } else {
            mCtx.fillStyle = color;
            mCtx.shadowBlur = 0;
          }

          mCtx.fillText(char, xPos, yPos);
        }
      }

      // 2. Mask to Text
      // We want the text shape to be filled with this rain
      const finalC = createCanvas(w, h);
      const fCtx = finalC.getContext('2d');

      fCtx.drawImage(canvas, 0, 0); // Base text shape
      fCtx.globalCompositeOperation = 'source-in';
      fCtx.drawImage(mCanvas, 0, 0); // Fill with matrix

      // 3. Add Outline/Glow so it's readable
      fCtx.globalCompositeOperation = 'source-over';
      fCtx.shadowColor = color;
      fCtx.shadowBlur = 5;
      fCtx.strokeStyle = color;
      fCtx.lineWidth = 1;
      fCtx.strokeText(text, x, y); // If we had text/x/y... 
      // Since we don't rely on render params, we can just glow the result

      ctx.clearRect(0, 0, w, h);
      // Draw background glow
      ctx.save();
      ctx.filter = 'blur(4px)';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(finalC, 0, 0);
      ctx.restore();

      ctx.drawImage(finalC, 0, 0);

      return { canvas, ctx };
    }
  },

  carbonFiber: {
    name: 'Carbon Fiber',
    params: [
      { key: 'color1', label: 'Thread A', type: 'color', default: '#222222' },
      { key: 'color2', label: 'Thread B', type: 'color', default: '#111111' },
      { key: 'scale', label: 'Weave Size', type: 'range', min: 2, max: 20, step: 1, default: 4 },
      { key: 'shine', label: 'Anisotropy', type: 'range', min: 0, max: 1, step: 0.1, default: 0.6 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const c1 = hexToRgb(params.color1 ?? '#222222');
      const c2 = hexToRgb(params.color2 ?? '#111111');
      const scale = params.scale ?? 4;
      const shine = params.shine ?? 0.6;
      const w = canvas.width, h = canvas.height;

      const cfCanvas = createCanvas(w, h);
      const cfCtx = cfCanvas.getContext('2d');
      const id = cfCtx.createImageData(w, h);
      const d = id.data;

      // Carbon Fiber Pattern:
      // A grid where (x + y) determine if it's a "Vertical" or "Horizontal" thread.
      // Standard Twill Weave: 2 over 2 under, offset by 1.

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;

          // Weave Logic
          const sx = Math.floor(px / scale);
          const sy = Math.floor(py / scale);

          // Simple Checkered Weave
          const isVert = (sx + sy) % 2 === 0;

          // Anisotropic Lighting
          // Vertical threads catch light differently than Horizontal
          // Fake a diagonal light gradient across the pixel

          let light = 0;

          // Calculate position within the "thread" (0..1)
          const localX = (px % scale) / scale;
          const localY = (py % scale) / scale;

          if (isVert) {
            // Vertical thread: Cylindrical highlight along X axis
            // Bright in middle of X, dark at edges
            light = Math.sin(localX * Math.PI);
          } else {
            // Horizontal thread
            light = Math.sin(localY * Math.PI);
          }

          // Apply shine intensity
          light = 0.2 + (light * 0.8 * shine); // Base ambient + shine

          // Pick base color
          const base = isVert ? c1 : c2;

          d[idx] = base.r * light;
          d[idx + 1] = base.g * light;
          d[idx + 2] = base.b * light;
          d[idx + 3] = 255;
        }
      }

      cfCtx.putImageData(id, 0, 0);

      // Mask to Text
      cfCtx.globalCompositeOperation = 'destination-in';
      cfCtx.drawImage(canvas, 0, 0);

      // Add slight Bevel/Edge light
      // (Optional: Reuse outline logic or just draw cf)

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cfCanvas, 0, 0);

      return { canvas, ctx };
    }
  },

  toxicSlime: {
    name: 'Toxic Slime',
    params: [
      { key: 'colorA', label: 'Slime Color', type: 'color', default: '#00ff00' },
      { key: 'colorB', label: 'Highlight', type: 'color', default: '#ffff00' },
      { key: 'drip', label: 'Melt Amount', type: 'range', min: 0, max: 100, step: 1, default: 40 },
      { key: 'bubbles', label: 'Bubbles', type: 'range', min: 0, max: 50, step: 1, default: 20 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const cA = params.colorA ?? '#00ff00';
      const cB = params.colorB ?? '#ffff00';
      const dripStr = params.drip ?? 40;
      const bubbleCount = params.bubbles ?? 20;
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 777;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // 1. Create Melt Map (Similar to Melt effect but rounder)
      const meltCanvas = createCanvas(w, h);
      const mCtx = meltCanvas.getContext('2d');
      mCtx.drawImage(canvas, 0, 0);

      const dripMap = new Float32Array(w);
      // Smooth noise for drips
      let t = 0;
      for (let i = 0; i < w; i++) {
        t += (rng() - 0.5) * 0.5;
        // Clamp t to stay within reason
        if (t > 1) t = 1; if (t < -1) t = -1;

        // Smoothed accumulation
        const val = Math.max(0, Math.sin(i * 0.05) + t);
        dripMap[i] = val * dripStr;
      }

      // Apply Displacement
      const distCanvas = createCanvas(w, h);
      const dCtx = distCanvas.getContext('2d');
      // Copy columns shifted down
      for (let i = 0; i < w; i++) {
        const d = dripMap[i];
        dCtx.drawImage(meltCanvas, i, 0, 1, h, i, d, 1, h);
      }

      // 2. Liquid Look (Metaball Thresholding)
      // Blur the result heavily, then threshold alpha to make it "goopy"
      const goopy = createCanvas(w, h);
      const gCtx = goopy.getContext('2d');
      gCtx.filter = 'blur(8px)';
      gCtx.drawImage(distCanvas, 0, 0);
      gCtx.filter = 'none';

      // Threshold & Colorize
      const id = gCtx.getImageData(0, 0, w, h);
      const data = id.data;
      const rgbA = hexToRgb(cA);
      const rgbB = hexToRgb(cB);

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 100) {
          data[i + 3] = 0; // Cut edges
        } else {
          data[i + 3] = 255; // Solidify core

          // Internal Gradient (Fake 3D)
          // Use the original alpha value (before threshold) as height map
          // High alpha = center of drip (highlight). Low alpha = edge.
          const height = (a - 100) / 155;

          // Mix colors based on height
          const r = lerp(rgbA.r, rgbB.r, height * height);
          const g = lerp(rgbA.g, rgbB.g, height * height);
          const b = lerp(rgbA.b, rgbB.b, height * height);

          data[i] = r; data[i + 1] = g; data[i + 2] = b;
        }
      }
      gCtx.putImageData(id, 0, 0);

      // 3. Add Bubbles
      for (let k = 0; k < bubbleCount; k++) {
        const bx = rng() * w;
        const by = rng() * h;
        // Check if inside slime
        const idx = (Math.floor(by) * w + Math.floor(bx)) * 4;
        if (data[idx + 3] > 0) {
          const r = 2 + rng() * 6;
          gCtx.beginPath();
          gCtx.arc(bx, by, r, 0, Math.PI * 2);
          gCtx.fillStyle = 'rgba(255,255,255,0.4)';
          gCtx.fill();
          // Highlight
          gCtx.beginPath();
          gCtx.arc(bx - r * 0.3, by - r * 0.3, r * 0.3, 0, Math.PI * 2);
          gCtx.fillStyle = 'white';
          gCtx.fill();
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(goopy, 0, 0);

      return { canvas, ctx };
    }
  },

  brokenMirror: {
    name: 'Broken Mirror',
    params: [
      { key: 'shards', label: 'Shard Count', type: 'range', min: 5, max: 100, step: 1, default: 30 },
      { key: 'displace', label: 'Explosion', type: 'range', min: 0, max: 50, step: 1, default: 10 },
      { key: 'seed', label: 'Crack Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const numShards = params.shards ?? 30;
      const displacement = params.displace ?? 10;
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 999;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // 1. Generate Voronoi Points
      const points = [];
      for (let i = 0; i < numShards; i++) {
        points.push({
          x: rng() * w,
          y: rng() * h,
          dx: (rng() - 0.5) * displacement, // Shift Amount X
          dy: (rng() - 0.5) * displacement, // Shift Amount Y
          bright: 0.8 + rng() * 0.4 // Random brightness for reflection angle
        });
      }

      // 2. Fragment Processing (Pixel by Pixel Voronoi)
      // Faster: Draw polygons? Voronoi polygons are hard to calc.
      // Pixel shader approach is O(W*H * Points) -> Slow if points high.
      // Cone Rendering approach?
      // Let's use the Pixel Scan method, optimized.

      const srcData = ctx.getImageData(0, 0, w, h).data;
      const outImg = ctx.createImageData(w, h);
      const out = outImg.data;

      // To speed up, we can use a low-res grid to find "candidate points"
      // But standard Nearest Neighbor loop is simplest for JS.

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {

          // Find nearest shard center
          let minDist = 999999;
          let bestP = points[0];

          for (let k = 0; k < numShards; k++) {
            const p = points[k];
            const d = (px - p.x) * (px - p.x) + (py - p.y) * (py - p.y);
            if (d < minDist) {
              minDist = d;
              bestP = p;
            }
          }

          // Calculate source pixel with displacement
          const sx = Math.floor(px - bestP.dx);
          const sy = Math.floor(py - bestP.dy);

          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const sIdx = (sy * w + sx) * 4;
            const dIdx = (py * w + px) * 4;

            // Copy pixel if source not empty
            if (srcData[sIdx + 3] > 0) {
              // Apply brightness shift (reflection)
              out[dIdx] = Math.min(255, srcData[sIdx] * bestP.bright);
              out[dIdx + 1] = Math.min(255, srcData[sIdx + 1] * bestP.bright);
              out[dIdx + 2] = Math.min(255, srcData[sIdx + 2] * bestP.bright);
              out[dIdx + 3] = srcData[sIdx + 3];
            }

            // Optional: Draw crack lines
            // If dist to nearest is very close to dist to 2nd nearest? (Edge detection)
            // That's expensive. Simpler: Leave gaps naturally via displacement.
          }
        }
      }

      ctx.putImageData(outImg, 0, 0);
      return { canvas, ctx };
    }
  },

  retroWave: {
    name: 'Retro Wave / 80s',
    params: [
      { key: 'topColor', label: 'Sky Top', type: 'color', default: '#ff00cc' },
      { key: 'midColor', label: 'Sky Bottom', type: 'color', default: '#ffcc00' },
      { key: 'gridColor', label: 'Grid Color', type: 'color', default: '#00ffff' },
      { key: 'horizon', label: 'Horizon Y %', type: 'range', min: 0, max: 100, step: 1, default: 60 },
      { key: 'zoom', label: 'Grid Zoom', type: 'range', min: 0.5, max: 5, step: 0.1, default: 1.0 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const topC = params.topColor ?? '#ff00cc';
      const midC = params.midColor ?? '#ffcc00';
      const gridC = params.gridColor ?? '#00ffff';
      const horizonPerc = (params.horizon ?? 60) / 100;
      const zoom = params.zoom ?? 1.0;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Detect Text Bounds (Critical for framing the scene)
      const data = ctx.getImageData(0, 0, w, h).data;
      let minY = h, maxY = 0;
      let found = false;
      // Vertical scan is enough to find top/bottom
      for (let iy = 0; iy < h; iy += 4) {
        for (let ix = 0; ix < w; ix += 10) { // coarse X scan
          if (data[(iy * w + ix) * 4 + 3] > 0) {
            if (iy < minY) minY = iy;
            if (iy > maxY) maxY = iy;
            found = true;
          }
        }
      }
      if (!found) return { canvas, ctx };

      // Add a tiny padding so the scene doesn't clip awkwardly at the very pixel edge
      const textH = (maxY - minY);
      const sceneTop = minY;
      const sceneBot = maxY;

      // Calculate absolute Horizon Y based on text bounds
      const horizonY = sceneTop + (textH * horizonPerc);

      const bgCanvas = createCanvas(w, h);
      const bCtx = bgCanvas.getContext('2d');

      // 2. Draw Sky (Top of Text -> Horizon)
      if (horizonY > sceneTop) {
        const skyGrad = bCtx.createLinearGradient(0, sceneTop, 0, horizonY);
        skyGrad.addColorStop(0, topC);
        skyGrad.addColorStop(1, midC);
        bCtx.fillStyle = skyGrad;
        bCtx.fillRect(0, sceneTop, w, horizonY - sceneTop);
      }

      // 3. Draw Grid Background (Horizon -> Bottom of Text)
      if (horizonY < sceneBot) {
        bCtx.fillStyle = '#1a0033';
        bCtx.fillRect(0, horizonY, w, sceneBot - horizonY);

        bCtx.save();
        bCtx.beginPath();
        bCtx.rect(0, horizonY, w, sceneBot - horizonY);
        bCtx.clip();

        bCtx.strokeStyle = gridC;
        bCtx.lineWidth = 2 * zoom; // Lines get thicker with zoom? Or remain thin? Let's scale slightly.
        bCtx.shadowColor = gridC;
        bCtx.shadowBlur = 5;

        const cx = w / 2;
        const perspective = 4 * (1 / zoom);

        // Vertical Lines (Fan out)
        // We limit them to the text area roughly to save perf
        for (let i = -15; i <= 15; i++) {
          bCtx.beginPath();
          bCtx.moveTo(cx + (i * 20 * zoom), horizonY);
          // Fan out to bottom
          bCtx.lineTo(cx + (i * 20 * zoom * perspective), sceneBot + 100);
          bCtx.stroke();
        }

        // Horizontal Lines (Logarithmic spacing from Horizon down)
        const gridH = sceneBot - horizonY;
        for (let i = 0; i < 20; i++) {
          const p = i / 20;
          // Curve determines how "flat" the ground looks
          const lineY = horizonY + (Math.pow(p, 2.5 * zoom) * gridH);

          if (lineY > sceneBot) continue;

          bCtx.beginPath();
          bCtx.moveTo(0, lineY);
          bCtx.lineTo(w, lineY);
          bCtx.stroke();
        }
        bCtx.restore();
      }

      // 4. Sun (Optional - sits on horizon)
      // Only draw if horizon is visible within text
      if (horizonY > sceneTop && horizonY < sceneBot) {
        const sunSize = textH * 0.4;
        bCtx.fillStyle = midC;
        bCtx.globalAlpha = 0.8;
        bCtx.beginPath();
        bCtx.arc(w / 2, horizonY + (sunSize * 0.2), sunSize, Math.PI, 0);
        bCtx.fill();
        bCtx.globalAlpha = 1;
      }

      // 5. Mask Scene to Text
      bCtx.globalCompositeOperation = 'destination-in';
      bCtx.drawImage(canvas, 0, 0);

      // 6. Final Composite & Chrome Edge
      ctx.clearRect(0, 0, w, h);

      // Outline / Bevel
      ctx.save();
      ctx.shadowColor = midC;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.drawImage(canvas, 0, 0);

      // Add gloss reflection to top half of text
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, sceneTop, w, textH / 2);
      ctx.restore();

      ctx.drawImage(bgCanvas, 0, 0);

      return { canvas, ctx };
    }
  },

  blueprint: {
    name: 'Blueprint / CAD',
    params: [
      { key: 'lineColor', label: 'Line Color', type: 'color', default: '#aaddff' },
      { key: 'bgColor', label: 'Paper Color', type: 'color', default: '#003366' },
      { key: 'lineWidth', label: 'Line Thickness', type: 'range', min: 0.5, max: 5, step: 0.5, default: 1.5 },
      { key: 'gridAlpha', label: 'Grid Opacity', type: 'range', min: 0, max: 1, step: 0.1, default: 0.3 },
      { key: 'grid', label: 'Show Grid', type: 'checkbox', default: true, className: 'optioncheckbox' },
      { key: 'guides', label: 'Tech Guides', type: 'checkbox', default: true, className: 'optioncheckbox' }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const lineC = params.lineColor ?? '#aaddff';
      // bgColor used if we were filling background, mostly for reference logic
      const lineWidth = params.lineWidth ?? 1.5;
      const gridAlpha = params.gridAlpha ?? 0.3;
      const showGrid = params.grid ?? true;
      const showGuides = params.guides ?? true;
      const w = canvas.width, h = canvas.height;

      // 1. Detect Bounds
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let hasContent = false;
      for (let py = 0; py < h; py += 4) {
        for (let px = 0; px < w; px += 4) {
          if (data[(py * w + px) * 4 + 3] > 0) {
            if (px < minX) minX = px; if (px > maxX) maxX = px;
            if (py < minY) minY = py; if (py > maxY) maxY = py;
            hasContent = true;
          }
        }
      }

      const bpCanvas = createCanvas(w, h);
      const bCtx = bpCanvas.getContext('2d');

      // 2. Grid (Background)
      if (showGrid) {
        bCtx.save();
        bCtx.strokeStyle = lineC;
        bCtx.globalAlpha = gridAlpha; // Control Grid Opacity
        bCtx.lineWidth = 1; // Grid is usually thin
        const gridSize = 20;

        bCtx.beginPath();
        for (let i = 0; i < w; i += gridSize) { bCtx.moveTo(i, 0); bCtx.lineTo(i, h); }
        for (let i = 0; i < h; i += gridSize) { bCtx.moveTo(0, i); bCtx.lineTo(w, i); }
        bCtx.stroke();
        bCtx.restore();
      }

      // 3. Text Outline (Hollow)
      bCtx.save();
      // Use the user's line width
      bCtx.lineWidth = lineWidth;
      bCtx.strokeStyle = lineC;
      bCtx.shadowColor = lineC;
      bCtx.shadowBlur = 0; // Crisp CAD lines usually don't glow much, or maybe slight bleed?

      // Outline Trick using shadow-offset
      const outlineC = createCanvas(w, h);
      const oCtx = outlineC.getContext('2d');
      oCtx.drawImage(canvas, 0, 0);
      oCtx.globalCompositeOperation = 'source-in';
      oCtx.fillStyle = lineC;
      oCtx.fillRect(0, 0, w, h);

      // Draw 4 offsets to create stroke around shape
      // We scale offset by lineWidth to ensure it clears the center
      const off = Math.max(1, lineWidth);
      bCtx.drawImage(outlineC, -off, 0);
      bCtx.drawImage(outlineC, off, 0);
      bCtx.drawImage(outlineC, 0, -off);
      bCtx.drawImage(outlineC, 0, off);

      // Knockout Center (Hollow)
      bCtx.globalCompositeOperation = 'destination-out';
      bCtx.drawImage(canvas, 0, 0);
      bCtx.globalCompositeOperation = 'source-over';
      bCtx.restore();

      // 4. Tech Guides
      if (showGuides && hasContent) {
        bCtx.strokeStyle = lineC;
        bCtx.lineWidth = 1; // Guides are hairline
        bCtx.setLineDash([4, 4]);
        bCtx.globalAlpha = 0.8;

        bCtx.beginPath();
        // Horizontal bounds
        bCtx.moveTo(0, minY); bCtx.lineTo(w, minY);
        bCtx.moveTo(0, maxY); bCtx.lineTo(w, maxY);
        // Vertical bounds
        bCtx.moveTo(minX, 0); bCtx.lineTo(minX, h);
        bCtx.moveTo(maxX, 0); bCtx.lineTo(maxX, h);
        bCtx.stroke();

        // Center Marker
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        bCtx.setLineDash([]);
        bCtx.beginPath();
        bCtx.arc(cx, cy, 10, 0, Math.PI * 2);
        bCtx.moveTo(cx - 15, cy); bCtx.lineTo(cx + 15, cy);
        bCtx.moveTo(cx, cy - 15); bCtx.lineTo(cx, cy + 15);
        bCtx.stroke();
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bpCanvas, 0, 0);

      return { canvas, ctx };
    }
  },

  inkBleed: {
    name: 'Ink Bleed / Rorschach',
    params: [
      { key: 'color', label: 'Ink Color', type: 'color', default: '#0d0d0d' },
      { key: 'spread', label: 'Bleed Amount', type: 'range', min: 0, max: 50, step: 1, default: 20 },
      { key: 'mirror', label: 'Rorschach Mode', type: 'checkbox', default: true, className: 'optioncheckbox' },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const color = params.color ?? '#0d0d0d';
      const spread = params.spread ?? 20;
      const mirror = params.mirror ?? true;
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      // 1. Prepare Base Shape (Mirroring logic)
      const baseC = createCanvas(w, h);
      const bCtx = baseC.getContext('2d');

      if (mirror) {
        // Draw Left Side
        bCtx.save();
        bCtx.beginPath();
        bCtx.rect(0, 0, w / 2, h);
        bCtx.clip();
        bCtx.drawImage(canvas, 0, 0);
        bCtx.restore();

        // Draw Right Side (Mirrored)
        bCtx.save();
        bCtx.translate(w, 0);
        bCtx.scale(-1, 1);
        bCtx.beginPath();
        // We must clip the "new" left side which corresponds to the original right side
        bCtx.rect(0, 0, w / 2, h);
        bCtx.clip();
        bCtx.drawImage(canvas, 0, 0);
        bCtx.restore();
      } else {
        bCtx.drawImage(canvas, 0, 0);
      }

      // Make solid color
      bCtx.globalCompositeOperation = 'source-in';
      bCtx.fillStyle = color;
      bCtx.fillRect(0, 0, w, h);

      // 2. Fluid Simulation (Blur + Threshold)
      // This creates the "wet" look.
      const fluidC = createCanvas(w, h);
      const fCtx = fluidC.getContext('2d');

      // Draw jittered copies to expand the ink
      let _s = seed * 444;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const passes = 10;
      fCtx.globalAlpha = 0.1; // Accumulate density

      for (let i = 0; i < passes; i++) {
        const scale = 1 + (i / passes) * (spread / 200); // Slight grow
        // Perlin-ish offset
        const dx = (rng() - 0.5) * spread;
        const dy = (rng() - 0.5) * spread;

        fCtx.save();
        fCtx.translate(w / 2 + dx, h / 2 + dy);
        fCtx.scale(scale, scale);
        fCtx.translate(-w / 2, -h / 2);
        fCtx.drawImage(baseC, 0, 0);
        fCtx.restore();
      }

      // 3. Capillaries (Veins)
      // We draw thin lines extending out
      fCtx.globalAlpha = 0.3;
      fCtx.filter = 'blur(1px)';
      for (let i = 0; i < 5; i++) {
        const dx = (rng() - 0.5) * spread * 2;
        const dy = (rng() - 0.5) * spread * 2;
        fCtx.drawImage(baseC, dx, dy);
      }
      fCtx.filter = 'none';
      fCtx.globalAlpha = 1;

      // 4. Thresholding (The key step for sharp ink edges)
      // We read the alpha channel. 
      // High alpha -> Solid Ink. 
      // Low alpha -> Paper bleed (halftone/noise).

      const imgData = fCtx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const inkRGB = hexToRgb(color);

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 10) continue; // Skip empty

        // Noise for paper grain edge
        const grain = rng() * 50;

        if (a + grain > 100) {
          // Solid Ink
          data[i] = inkRGB.r;
          data[i + 1] = inkRGB.g;
          data[i + 2] = inkRGB.b;
          data[i + 3] = 255;
        } else {
          // Bleed Edge (Translucent)
          data[i] = inkRGB.r;
          data[i + 1] = inkRGB.g;
          data[i + 2] = inkRGB.b;
          data[i + 3] = a; // Fade out
        }
      }
      fCtx.putImageData(imgData, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(fluidC, 0, 0);

      return { canvas, ctx };
    }
  },

  smoke: {
    name: 'Smoke / Vapor',
    params: [
      { key: 'color', label: 'Smoke Color', type: 'color', default: '#eeeeee' },
      { key: 'density', label: 'Density', type: 'range', min: 0, max: 2, step: 0.1, default: 1.0 },
      { key: 'turbulence', label: 'Warp Amount', type: 'range', min: 0, max: 50, step: 1, default: 20 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const color = params.color ?? '#eeeeee';
      const density = params.density ?? 1.0;
      const warp = params.turbulence ?? 20;
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      // 1. Setup Noise
      let _s = seed * 888;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };
      const noiseW = Math.ceil(w / 8);
      const noiseH = Math.ceil(h / 8);
      const noise = new Float32Array(noiseW * noiseH);
      for (let i = 0; i < noise.length; i++) noise[i] = rng();

      const getNoise = (x, y) => {
        const ix = Math.floor(x) % noiseW; const iy = Math.floor(y) % noiseH;
        return noise[iy * noiseW + ix];
      };

      const smokeCanvas = createCanvas(w, h);
      const sCtx = smokeCanvas.getContext('2d');
      const imgData = sCtx.createImageData(w, h);
      const data = imgData.data;

      const srcData = ctx.getImageData(0, 0, w, h).data;
      const rgb = hexToRgb(color);

      // 2. Pixel Process
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {

          // FBM Noise for smoke structure
          const n1 = getNoise(px * 0.05, py * 0.05);
          const n2 = getNoise(px * 0.1, py * 0.1) * 0.5;
          const n3 = getNoise(px * 0.2, py * 0.2) * 0.25;
          const nTotal = n1 + n2 + n3; // 0..1.75

          // Advection: Warp the lookup of the source text upwards
          // We check pixels BELOW the current one to see if smoke rose here
          const warpX = (n1 - 0.5) * warp;
          const warpY = (n2 * warp * 2); // Mostly up

          const sx = Math.floor(px + warpX);
          const sy = Math.floor(py + warpY); // Look down

          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const sIdx = (sy * w + sx) * 4;
            const alpha = srcData[sIdx + 3];

            if (alpha > 0) {
              // Apply smoke density mask
              // We multiply text alpha by noise cloud
              const smokeAlpha = alpha * (nTotal / 1.5) * density;

              const idx = (py * w + px) * 4;
              data[idx] = rgb.r;
              data[idx + 1] = rgb.g;
              data[idx + 2] = rgb.b;
              data[idx + 3] = Math.min(255, smokeAlpha);
            }
          }
        }
      }
      sCtx.putImageData(imgData, 0, 0);

      // 3. Soften
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.filter = 'blur(3px)'; // Smoke is soft
      ctx.drawImage(smokeCanvas, 0, 0);
      ctx.restore();

      return { canvas, ctx };
    }
  },

  stainedGlass: {
    name: 'Stained Glass',
    params: [
      { key: 'size', label: 'Shard Size', type: 'range', min: 5, max: 100, step: 1, default: 20 },
      { key: 'grout', label: 'Grout Width', type: 'range', min: 0.1, max: 10, step: 0.5, default: 2 },
      { key: 'color', label: 'Grout Color', type: 'color', default: '#000000' },
      { key: 'variance', label: 'Color Variance', type: 'range', min: 0.1, max: 1, step: 0.1, default: 0.3 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params) => {
      const size = params.size ?? 20;
      const grout = params.grout ?? 2;
      const groutColor = hexToRgb(params.color ?? '#000000');
      const variance = params.variance ?? 0.3;
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 123;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // 1. Generate Voronoi Centers
      const points = [];
      const numPoints = Math.floor((w * h) / (size * size)) * 1.5;
      for (let i = 0; i < numPoints; i++) {
        points.push({ x: rng() * w, y: rng() * h, tint: (rng() - 0.5) * variance });
      }

      const srcData = ctx.getImageData(0, 0, w, h).data;
      const outImg = ctx.createImageData(w, h);
      const out = outImg.data;

      // 2. Pixel Scan
      // For each pixel, find closest point.
      // Check distance to 2nd closest point to calculate "Edge" (Grout)

      // Optimization: We skip true 2nd neighbor check (slow) and just use
      // distance thresholds or simple nearest neighbor with post-process stroke?
      // Let's do a simple optimization: Block scan.

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {

          // Only process pixels inside the text shape
          const idx = (py * w + px) * 4;
          if (srcData[idx + 3] < 128) continue; // Skip transparency

          // Find Closest
          let d1 = 999999;
          let bestP = points[0];

          // Optimization: Only check points roughly nearby?
          // JS loops are fast enough for <100 points. If >100, might lag.
          // Let's just iterate all for quality (this is "Boss Level" after all).
          for (let k = 0; k < points.length; k++) {
            const p = points[k];
            const dx = px - p.x;
            const dy = py - p.y;
            const d = dx * dx + dy * dy;
            if (d < d1) {
              d1 = d;
              bestP = p;
            }
          }

          // Grout Logic:
          // True Voronoi border math is (dist1 - dist2). 
          // Without calculating dist2, we can just draw simple cells.
          // To fake the grout, we can erode later, or check logic.
          // Let's stick to simple cells + Variance color first.

          // Source Color
          const r = clamp(srcData[idx] * (1 + bestP.tint), 0, 255);
          const g = clamp(srcData[idx + 1] * (1 + bestP.tint), 0, 255);
          const b = clamp(srcData[idx + 2] * (1 + bestP.tint), 0, 255);

          out[idx] = r;
          out[idx + 1] = g;
          out[idx + 2] = b;
          out[idx + 3] = 255;
        }
      }

      // 3. Apply Grout (Edge Detection)
      // Scan the Voronoi output. If neighbor pixel is different color/cell, draw black line.
      // This creates the "Lead" between glass panes.

      const finalImg = ctx.createImageData(w, h);
      const fData = finalImg.data;
      const gR = groutColor.r; const gG = groutColor.g; const gB = groutColor.b;

      // Copy Voronoi to buffer for reading
      const vData = new Uint32Array(out.buffer);

      for (let py = 1; py < h - 1; py++) {
        for (let px = 1; px < w - 1; px++) {
          const idx = (py * w + px) * 4;
          if (out[idx + 3] === 0) continue; // Skip empty

          // Check neighbors (Right and Bottom)
          const curr = vData[py * w + px];
          const right = vData[py * w + (px + 1)];
          const bottom = vData[(py + 1) * w + px];

          if (curr !== right || curr !== bottom) {
            // Edge found -> Draw Grout
            // Dilate based on grout width (simple hack)
            fData[idx] = gR; fData[idx + 1] = gG; fData[idx + 2] = gB; fData[idx + 3] = 255;
          } else {
            // Glass Center
            fData[idx] = out[idx];
            fData[idx + 1] = out[idx + 1];
            fData[idx + 2] = out[idx + 2];
            fData[idx + 3] = 255;
          }
        }
      }

      ctx.putImageData(finalImg, 0, 0);

      // Optional: Add gloss shine
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, 0, w, h / 2);

      return { canvas, ctx };
    }
  },
  infernoForge: {
    name: 'Inferno Forge',
    params: [
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 9999, step: 1, default: 1337 },

      { key: 'coreColor', label: 'Core', type: 'color', default: '#fff4d6' },
      { key: 'hotColor', label: 'Hot', type: 'color', default: '#ffb14a' },
      { key: 'midColor', label: 'Mid', type: 'color', default: '#ff5a00' },
      { key: 'darkColor', label: 'Dark', type: 'color', default: '#551100' },
      { key: 'emberColor', label: 'Embers', type: 'color', default: '#ff6a00' },
      { key: 'smokeColor', label: 'Smoke', type: 'color', default: '#3a0904' },

      { key: 'glowSize', label: 'Glow Size', type: 'range', min: 0, max: 120, step: 1, default: 34 },
      { key: 'glowIntensity', label: 'Glow Intensity', type: 'range', min: 0, max: 8, step: 0.1, default: 3.2 },
      { key: 'outerGlowSize', label: 'Outer Glow', type: 'range', min: 0, max: 180, step: 1, default: 78 },
      { key: 'crackAmount', label: 'Cracks', type: 'range', min: 0, max: 1, step: 0.01, default: 0.42 },
      { key: 'textureScale', label: 'Texture Scale', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.4 },
      { key: 'smokeAmount', label: 'Smoke Amount', type: 'range', min: 0, max: 1, step: 0.01, default: 0.58 },
      { key: 'embers', label: 'Embers', type: 'range', min: 0, max: 600, step: 1, default: 180 },
      { key: 'showBase', label: 'Show Base', type: 'checkbox', default: true }
    ],

    apply: (ctx, canvas, text, x, y, params = {}) => {
      const w = canvas.width;
      const h = canvas.height;

      const seed = params.seed ?? 1337;
      const rnd = (typeof createSeededRandom === 'function' ? createSeededRandom(seed) : null) ?? Math.random;

      const coreColor = params.coreColor ?? '#fff4d6';
      const hotColor = params.hotColor ?? '#ffb14a';
      const midColor = params.midColor ?? '#ff5a00';
      const darkColor = params.darkColor ?? '#551100';
      const emberColor = params.emberColor ?? '#ff6a00';
      const smokeColor = params.smokeColor ?? '#3a0904';

      const glowSize = params.glowSize ?? 34;
      const glowIntensity = params.glowIntensity ?? 3.2;
      const outerGlowSize = params.outerGlowSize ?? 78;
      const crackAmount = Math.max(0, Math.min(1, params.crackAmount ?? 0.42));
      const textureScale = Math.max(0.1, params.textureScale ?? 2.4);
      const smokeAmount = Math.max(0, Math.min(1, params.smokeAmount ?? 0.58));
      const emberCount = Math.max(0, params.embers ?? 180);
      const showBase = params.showBase ?? true;

      const hexToRgbSafe = (hex) => {
        const clean = String(hex).replace('#', '').trim();
        const full = clean.length === 3
          ? clean.split('').map(c => c + c).join('')
          : clean.padEnd(6, '0').slice(0, 6);
        return {
          r: parseInt(full.slice(0, 2), 16),
          g: parseInt(full.slice(2, 4), 16),
          b: parseInt(full.slice(4, 6), 16)
        };
      };

      const lerpSafe = (a, b, t) => a + (b - a) * t;
      const clampSafe = (v, a, b) => Math.max(a, Math.min(b, v));
      const smoothstep = (a, b, x) => {
        const t = clampSafe((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };

      const cCore = hexToRgbSafe(coreColor);
      const cHot = hexToRgbSafe(hotColor);
      const cMid = hexToRgbSafe(midColor);
      const cDark = hexToRgbSafe(darkColor);
      const cEmber = hexToRgbSafe(emberColor);
      const cSmoke = hexToRgbSafe(smokeColor);

      // Keep original text mask
      const textMask = document.createElement('canvas');
      textMask.width = w;
      textMask.height = h;
      const mCtx = textMask.getContext('2d');
      mCtx.drawImage(canvas, 0, 0);

      const src = mCtx.getImageData(0, 0, w, h);
      const srcData = src.data;

      // Bounds
      let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const a = srcData[(py * w + px) * 4 + 3];
          if (a > 10) {
            found = true;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
        }
      }
      if (!found) return { canvas, ctx };

      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const textW = Math.max(1, maxX - minX);
      const textH = Math.max(1, maxY - minY);

      // Distance-ish field from alpha using blur passes
      const fieldCanvas = document.createElement('canvas');
      fieldCanvas.width = w;
      fieldCanvas.height = h;
      const fCtx = fieldCanvas.getContext('2d');

      fCtx.drawImage(textMask, 0, 0);
      for (let i = 0; i < 4; i++) {
        const pass = document.createElement('canvas');
        pass.width = w;
        pass.height = h;
        const pCtx = pass.getContext('2d');
        pCtx.filter = `blur(${6 + i * 4}px)`;
        pCtx.drawImage(fieldCanvas, 0, 0);
        fCtx.clearRect(0, 0, w, h);
        fCtx.drawImage(pass, 0, 0);
      }

      const fieldData = fCtx.getImageData(0, 0, w, h).data;

      // Fractal noise helpers
      const hash2 = (x, y) => {
        const n = Math.sin((x * 127.1 + y * 311.7 + seed * 17.13)) * 43758.5453123;
        return n - Math.floor(n);
      };

      const valueNoise = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;

        const h00 = hash2(xi, yi);
        const h10 = hash2(xi + 1, yi);
        const h01 = hash2(xi, yi + 1);
        const h11 = hash2(xi + 1, yi + 1);

        const ux = xf * xf * (3 - 2 * xf);
        const uy = yf * yf * (3 - 2 * yf);

        const nx0 = lerpSafe(h00, h10, ux);
        const nx1 = lerpSafe(h01, h11, ux);
        return lerpSafe(nx0, nx1, uy);
      };

      const fbm = (x, y, octaves = 4) => {
        let value = 0;
        let amp = 0.5;
        let freq = 1;
        let norm = 0;
        for (let i = 0; i < octaves; i++) {
          value += valueNoise(x * freq, y * freq) * amp;
          norm += amp;
          amp *= 0.5;
          freq *= 2.0;
        }
        return value / norm;
      };

      // Fire fill
      const fireCanvas = document.createElement('canvas');
      fireCanvas.width = w;
      fireCanvas.height = h;
      const fireCtx = fireCanvas.getContext('2d');
      const fireImg = fireCtx.createImageData(w, h);
      const out = fireImg.data;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          const alpha = srcData[idx + 3];
          if (alpha < 8) continue;

          const field = fieldData[idx + 3] / 255; // blurred alpha = interior/edge gradient
          const nx = (px - minX) / Math.max(1, textW);
          const ny = (py - minY) / Math.max(1, textH);

          const n1 = fbm(px * 0.03 * textureScale, py * 0.04 * textureScale, 5);
          const n2 = fbm(px * 0.09 * textureScale, py * 0.11 * textureScale, 3);
          const n3 = fbm((px + seed) * 0.22, (py - seed) * 0.18, 2);

          const edgeHeat = smoothstep(0.18, 0.95, field);
          const verticalHeat = 1.0 - Math.abs(ny - 0.55) * 1.15;
          const centerBias = 1.0 - Math.abs(nx - 0.5) * 0.65;

          // crack network
          const crackNoise = Math.abs(n1 - 0.5) + Math.abs(n2 - 0.5) * 0.6;
          const crackMask = smoothstep(0.44 - crackAmount * 0.18, 0.56 - crackAmount * 0.15, crackNoise);

          // glowing fissures
          const fissureNoise = 1.0 - Math.abs(n3 - 0.5) * 2.0;
          const fissure = Math.pow(smoothstep(0.68, 0.98, fissureNoise), 2.4);

          let heat = edgeHeat * 0.9 + verticalHeat * 0.35 + centerBias * 0.18 + fissure * 0.9;
          heat = clampSafe(heat, 0, 1);

          // darken interior with crack texture but keep glowing crevices
          let coolMask = crackMask * 0.95 - fissure * 0.55;
          coolMask = clampSafe(coolMask, 0, 1);

          let r, g, b;

          if (heat > 0.82) {
            const t = smoothstep(0.82, 1.0, heat);
            r = lerpSafe(cHot.r, cCore.r, t);
            g = lerpSafe(cHot.g, cCore.g, t);
            b = lerpSafe(cHot.b, cCore.b, t);
          } else if (heat > 0.45) {
            const t = smoothstep(0.45, 0.82, heat);
            r = lerpSafe(cMid.r, cHot.r, t);
            g = lerpSafe(cMid.g, cHot.g, t);
            b = lerpSafe(cMid.b, cHot.b, t);
          } else {
            const t = smoothstep(0.0, 0.45, heat);
            r = lerpSafe(cDark.r, cMid.r, t);
            g = lerpSafe(cDark.g, cMid.g, t);
            b = lerpSafe(cDark.b, cMid.b, t);
          }

          // cracks / metal-like fractured texture
          r = lerpSafe(r, cDark.r, coolMask * 0.85);
          g = lerpSafe(g, cDark.g, coolMask * 0.85);
          b = lerpSafe(b, cDark.b, coolMask * 0.85);

          // brighten fissures
          r = lerpSafe(r, cCore.r, fissure * 0.9);
          g = lerpSafe(g, cHot.g, fissure * 0.75);
          b = lerpSafe(b, cHot.b, fissure * 0.3);

          out[idx] = clampSafe(r, 0, 255);
          out[idx + 1] = clampSafe(g, 0, 255);
          out[idx + 2] = clampSafe(b, 0, 255);
          out[idx + 3] = alpha;
        }
      }

      fireCtx.putImageData(fireImg, 0, 0);

      // Mask fire to text
      fireCtx.globalCompositeOperation = 'destination-in';
      fireCtx.drawImage(textMask, 0, 0);
      fireCtx.globalCompositeOperation = 'source-over';

      // Background smoke
      const smokeCanvas = document.createElement('canvas');
      smokeCanvas.width = w;
      smokeCanvas.height = h;
      const sCtx = smokeCanvas.getContext('2d');

      for (let i = 0; i < Math.floor(120 * smokeAmount); i++) {
        const px = minX - 60 + rnd() * (textW + 120);
        const py = minY - 120 + rnd() * (textH * 0.9);
        const rx = 30 + rnd() * 120;
        const ry = 18 + rnd() * 70;

        const grad = sCtx.createRadialGradient(px, py, 0, px, py, rx);
        const a0 = (0.05 + rnd() * 0.09) * smokeAmount;
        grad.addColorStop(0, `rgba(${cSmoke.r},${cSmoke.g},${cSmoke.b},${a0})`);
        grad.addColorStop(0.45, `rgba(${cSmoke.r},${cSmoke.g},${cSmoke.b},${a0 * 0.45})`);
        grad.addColorStop(1, `rgba(${cSmoke.r},${cSmoke.g},${cSmoke.b},0)`);

        sCtx.save();
        sCtx.translate(px, py);
        sCtx.rotate((rnd() - 0.5) * 1.2);
        sCtx.translate(-px, -py);
        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.restore();
      }

      sCtx.filter = 'blur(18px)';
      sCtx.drawImage(smokeCanvas, 0, 0);
      sCtx.filter = 'none';

      // Outer inferno glow
      const glowMask = document.createElement('canvas');
      glowMask.width = w;
      glowMask.height = h;
      const gCtx = glowMask.getContext('2d');
      gCtx.drawImage(textMask, 0, 0);
      gCtx.globalCompositeOperation = 'source-in';
      gCtx.fillStyle = `rgb(${cEmber.r},${cEmber.g},${cEmber.b})`;
      gCtx.fillRect(0, 0, w, h);

      // Embers
      const embersCanvas = document.createElement('canvas');
      embersCanvas.width = w;
      embersCanvas.height = h;
      const eCtx = embersCanvas.getContext('2d');

      for (let i = 0; i < emberCount; i++) {
        const px = minX - 80 + rnd() * (textW + 160);
        const py = minY - 80 + rnd() * (textH + 120);
        const size = 0.5 + rnd() * 2.4;
        const alpha = 0.08 + rnd() * 0.55;
        const stretch = 1 + rnd() * 2.5;

        eCtx.save();
        eCtx.translate(px, py);
        eCtx.rotate((rnd() - 0.5) * 1.6);
        eCtx.fillStyle = `rgba(${cEmber.r},${cEmber.g},${cEmber.b},${alpha})`;
        eCtx.beginPath();
        eCtx.ellipse(0, 0, size, size * stretch, 0, 0, Math.PI * 2);
        eCtx.fill();
        eCtx.restore();
      }

      eCtx.filter = 'blur(1.2px)';
      eCtx.drawImage(embersCanvas, 0, 0);
      eCtx.filter = 'none';

      // Final composite
      ctx.clearRect(0, 0, w, h);

      // dark smoky surround
      ctx.drawImage(smokeCanvas, 0, 0);

      // broad outer glow
      if (outerGlowSize > 0) {
        ctx.save();
        ctx.shadowColor = `rgba(${cEmber.r},${cEmber.g},${cEmber.b},0.95)`;
        ctx.shadowBlur = outerGlowSize;
        ctx.globalAlpha = 0.28;
        ctx.drawImage(glowMask, 0, 0);
        ctx.restore();
      }

      // tighter glow
      if (glowSize > 0 && glowIntensity > 0) {
        ctx.save();
        ctx.shadowColor = `rgba(${cHot.r},${cHot.g},${cHot.b},1)`;
        ctx.shadowBlur = glowSize;
        const passes = Math.max(1, Math.ceil(glowIntensity));
        for (let i = 0; i < passes; i++) {
          ctx.globalAlpha = 0.20 + (glowIntensity / passes) * 0.16;
          ctx.drawImage(glowMask, 0, 0);
        }
        ctx.restore();
      }

      // optional faint base
      if (showBase) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.drawImage(textMask, 0, 0);
        ctx.restore();
      }

      // main molten letters
      ctx.drawImage(fireCanvas, 0, 0);

      // bright edge kiss
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = '#ffd7a0';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.18;
      ctx.drawImage(textMask, 0, 0);
      ctx.restore();

      // embers on top
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(embersCanvas, 0, 0);
      ctx.restore();

      return { canvas, ctx };
    }
  },
  nordicRuneforge: {
    name: 'Nordic Runeforge',
    params: [
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 9999, step: 1, default: 7331 },

      { key: 'metalLight', label: 'Metal Light', type: 'color', default: '#b8a79a' },
      { key: 'metalMid', label: 'Metal Mid', type: 'color', default: '#7c665b' },
      { key: 'metalDark', label: 'Metal Dark', type: 'color', default: '#2c2522' },

      { key: 'patinaA', label: 'Patina A', type: 'color', default: '#4d8b88' },
      { key: 'patinaB', label: 'Patina B', type: 'color', default: '#7aa7a0' },
      { key: 'emberColor', label: 'Ember', type: 'color', default: '#8e1c14' },

      { key: 'bevelStrength', label: 'Bevel', type: 'range', min: 0, max: 1, step: 0.01, default: 0.72 },
      { key: 'textureScale', label: 'Texture Scale', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.4 },
      { key: 'textureStrength', label: 'Texture Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.68 },
      { key: 'patinaAmount', label: 'Patina', type: 'range', min: 0, max: 1, step: 0.01, default: 0.38 },
      { key: 'engraveDepth', label: 'Rune Depth', type: 'range', min: 0, max: 1, step: 0.01, default: 0.62 },
      { key: 'emberAmount', label: 'Inner Ember', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22 },
      { key: 'rimLight', label: 'Rim Light', type: 'range', min: 0, max: 1, step: 0.01, default: 0.58 }
    ],

    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width;
      const h = canvas.height;

      const seed = Number(params.seed ?? 7331);
      const rnd = createSeededRandom(seed) || Math.random;

      const bevelStrength = clamp(Number(params.bevelStrength ?? 0.72), 0, 1);
      const textureScale = Math.max(0.1, Number(params.textureScale ?? 2.4));
      const textureStrength = clamp(Number(params.textureStrength ?? 0.68), 0, 1);
      const patinaAmount = clamp(Number(params.patinaAmount ?? 0.38), 0, 1);
      const engraveDepth = clamp(Number(params.engraveDepth ?? 0.62), 0, 1);
      const emberAmount = clamp(Number(params.emberAmount ?? 0.22), 0, 1);
      const rimLight = clamp(Number(params.rimLight ?? 0.58), 0, 1);

      const hexToRgb = (hex) => {
        const clean = String(hex).replace('#', '').trim();
        const full = clean.length === 3
          ? clean.split('').map(c => c + c).join('')
          : clean.padEnd(6, '0').slice(0, 6);
        return {
          r: parseInt(full.slice(0, 2), 16),
          g: parseInt(full.slice(2, 4), 16),
          b: parseInt(full.slice(4, 6), 16)
        };
      };

      const smoothstep = (a, b, x) => {
        const t = clamp((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };

      const mixRgb = (a, b, t) => ({
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t)
      });

      const metalLight = hexToRgb(params.metalLight ?? '#b8a79a');
      const metalMid = hexToRgb(params.metalMid ?? '#7c665b');
      const metalDark = hexToRgb(params.metalDark ?? '#2c2522');
      const patinaA = hexToRgb(params.patinaA ?? '#4d8b88');
      const patinaB = hexToRgb(params.patinaB ?? '#7aa7a0');
      const emberColor = hexToRgb(params.emberColor ?? '#8e1c14');

      const maskCanvas = createCanvas(w, h);
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx.drawImage(canvas, 0, 0);

      const maskImg = getImageDataSafe(maskCtx, 0, 0, w, h);
      const src = maskImg.data;

      let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const a = src[(py * w + px) * 4 + 3];
          if (a > 10) {
            found = true;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
        }
      }
      if (!found) return { canvas, ctx, abortSignal };

      const textW = Math.max(1, maxX - minX);
      const textH = Math.max(1, maxY - minY);

      const fieldCanvas = createCanvas(w, h);
      const fieldCtx = fieldCanvas.getContext('2d');
      fieldCtx.drawImage(maskCanvas, 0, 0);

      for (let i = 0; i < 4; i++) {
        const pass = createCanvas(w, h);
        const pctx = pass.getContext('2d');
        pctx.filter = `blur(${4 + i * 3}px)`;
        pctx.drawImage(fieldCanvas, 0, 0);
        fieldCtx.clearRect(0, 0, w, h);
        fieldCtx.drawImage(pass, 0, 0);
      }

      const fieldData = getImageDataSafe(fieldCtx, 0, 0, w, h).data;

      const fieldAlpha = (px, py) => {
        px = clamp(px, 0, w - 1);
        py = clamp(py, 0, h - 1);
        return fieldData[(py * w + px) * 4 + 3] / 255;
      };

      const hash2 = (x, y) => {
        const n = Math.sin(x * 127.1 + y * 311.7 + seed * 17.13) * 43758.5453123;
        return n - Math.floor(n);
      };

      const valueNoise = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;

        const h00 = hash2(xi, yi);
        const h10 = hash2(xi + 1, yi);
        const h01 = hash2(xi, yi + 1);
        const h11 = hash2(xi + 1, yi + 1);

        const ux = xf * xf * (3 - 2 * xf);
        const uy = yf * yf * (3 - 2 * yf);

        return lerp(
          lerp(h00, h10, ux),
          lerp(h01, h11, ux),
          uy
        );
      };

      const fbm = (x, y, octaves = 4) => {
        let value = 0;
        let amp = 0.5;
        let freq = 1;
        let norm = 0;
        for (let i = 0; i < octaves; i++) {
          value += valueNoise(x * freq, y * freq) * amp;
          norm += amp;
          amp *= 0.5;
          freq *= 2;
        }
        return value / norm;
      };

      const ridge = (x, y, scale = 1) => {
        const n = fbm(x * scale, y * scale, 4);
        return 1 - Math.abs(n - 0.5) * 2;
      };

      const renderCanvas = createCanvas(w, h);
      const renderCtx = renderCanvas.getContext('2d');
      const renderImg = renderCtx.createImageData(w, h);
      const out = renderImg.data;

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          const alpha = src[idx + 3];
          if (alpha < 8) continue;

          const nx = (px - minX) / textW;
          const ny = (py - minY) / textH;
          const edge = fieldData[idx + 3] / 255;

          const nLarge = fbm(px * 0.018 * textureScale, py * 0.018 * textureScale, 5);
          const nMid = fbm(px * 0.065 * textureScale, py * 0.065 * textureScale, 4);
          const nFine = fbm(px * 0.18 * textureScale, py * 0.18 * textureScale, 3);

          const hammered = ridge(px * 0.055 * textureScale, py * 0.055 * textureScale, 1.0);
          const grain = ridge(px * 0.23 * textureScale + 11.7, py * 0.19 * textureScale + 3.1, 1.0);
          const crack = smoothstep(0.62, 0.90, nMid * 0.65 + nFine * 0.35);

          const gx = fieldAlpha(px + 1, py) - fieldAlpha(px - 1, py);
          const gy = fieldAlpha(px, py + 1) - fieldAlpha(px, py - 1);

          const bevel = clamp((-gx * 0.85 - gy * 0.55) * 2.2, -1, 1);
          const edgeRim = smoothstep(0.25, 0.95, edge);

          let metal = mixRgb(metalDark, metalMid, 0.52 + (hammered - 0.5) * 0.38);
          metal = mixRgb(metal, metalLight, smoothstep(0.52, 0.95, edgeRim) * 0.22);

          const texLift = ((hammered - 0.5) * 0.7 + (grain - 0.5) * 0.45 + (nLarge - 0.5) * 0.28) * textureStrength;
          metal.r += texLift * 110;
          metal.g += texLift * 95;
          metal.b += texLift * 85;

          metal.r += bevel * bevelStrength * 85;
          metal.g += bevel * bevelStrength * 72;
          metal.b += bevel * bevelStrength * 58;

          const innerShadow = (1 - edgeRim) * 0.34;
          metal.r = lerp(metal.r, metalDark.r, innerShadow);
          metal.g = lerp(metal.g, metalDark.g, innerShadow);
          metal.b = lerp(metal.b, metalDark.b, innerShadow);

          const patinaNoise = fbm(px * 0.030 * textureScale + 80.1, py * 0.030 * textureScale + 12.4, 5);
          const patinaMask = smoothstep(0.66, 0.88, patinaNoise) * patinaAmount * (0.35 + (1 - edgeRim) * 0.85);
          const patinaColor = mixRgb(patinaA, patinaB, nFine);

          metal.r = lerp(metal.r, patinaColor.r, patinaMask);
          metal.g = lerp(metal.g, patinaColor.g, patinaMask);
          metal.b = lerp(metal.b, patinaColor.b, patinaMask);

          const emberNoise = fbm(px * 0.05 + 120.4, py * 0.07 + 77.8, 4);
          const emberMask = smoothstep(0.74, 0.94, emberNoise) * emberAmount * (1 - edgeRim) * 0.9;
          metal.r = lerp(metal.r, emberColor.r, emberMask);
          metal.g = lerp(metal.g, emberColor.g, emberMask * 0.35);
          metal.b = lerp(metal.b, emberColor.b, emberMask * 0.18);

          const crackDark = crack * 0.22;
          metal.r = lerp(metal.r, metalDark.r, crackDark);
          metal.g = lerp(metal.g, metalDark.g, crackDark);
          metal.b = lerp(metal.b, metalDark.b, crackDark);

          const rim = smoothstep(0.55, 1.0, edgeRim) * rimLight;
          metal.r = lerp(metal.r, metalLight.r, rim * 0.68);
          metal.g = lerp(metal.g, metalLight.g, rim * 0.60);
          metal.b = lerp(metal.b, metalLight.b, rim * 0.52);

          out[idx] = clamp(Math.round(metal.r), 0, 255);
          out[idx + 1] = clamp(Math.round(metal.g), 0, 255);
          out[idx + 2] = clamp(Math.round(metal.b), 0, 255);
          out[idx + 3] = alpha;
        }
      }

      renderCtx.putImageData(renderImg, 0, 0);
      renderCtx.globalCompositeOperation = 'destination-in';
      renderCtx.drawImage(maskCanvas, 0, 0);
      renderCtx.globalCompositeOperation = 'source-over';

      const runeLayer = createCanvas(w, h);
      const runeCtx = runeLayer.getContext('2d');
      runeCtx.clearRect(0, 0, w, h);
      runeCtx.textAlign = 'center';
      runeCtx.textBaseline = 'middle';

      const runeChars = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛟ'];

      const placeRuneChain = (x0, y0, x1, y1, count) => {
        for (let i = 0; i < count; i++) {
          const t = (i + 1) / (count + 1);
          const px = lerp(x0, x1, t) + (rnd() - 0.5) * 2;
          const py = lerp(y0, y1, t) + (rnd() - 0.5) * 2;
          const angle = Math.atan2(y1 - y0, x1 - x0);

          runeCtx.save();
          runeCtx.translate(px, py);
          runeCtx.rotate(angle);
          runeCtx.font = `600 ${Math.max(12, Math.round(Math.min(textW, textH) * 0.08))}px serif`;
          runeCtx.fillStyle = 'rgba(255,255,255,0.92)';
          runeCtx.fillText(runeChars[Math.floor(rnd() * runeChars.length)], 0, 0);
          runeCtx.restore();
        }
      };

      const runeGuide = [
        [minX + textW * 0.08, minY + textH * 0.34, minX + textW * 0.14, minY + textH * 0.58, 4],
        [minX + textW * 0.23, minY + textH * 0.23, minX + textW * 0.23, minY + textH * 0.76, 5],
        [minX + textW * 0.43, minY + textH * 0.20, minX + textW * 0.43, minY + textH * 0.72, 4],
        [minX + textW * 0.62, minY + textH * 0.18, minX + textW * 0.62, minY + textH * 0.74, 4],
        [minX + textW * 0.76, minY + textH * 0.20, minX + textW * 0.76, minY + textH * 0.70, 4],
        [minX + textW * 0.90, minY + textH * 0.34, minX + textW * 0.84, minY + textH * 0.58, 4]
      ];

      for (const g of runeGuide) {
        placeRuneChain(g[0], g[1], g[2], g[3], g[4]);
      }

      runeCtx.globalCompositeOperation = 'destination-in';
      runeCtx.drawImage(maskCanvas, 0, 0);
      runeCtx.globalCompositeOperation = 'source-over';

      const runeImg = getImageDataSafe(runeCtx, 0, 0, w, h);
      const runeData = runeImg.data;

      const engravedCanvas = createCanvas(w, h);
      const engravedCtx = engravedCanvas.getContext('2d');
      engravedCtx.drawImage(renderCanvas, 0, 0);

      const engravedImg = getImageDataSafe(engravedCtx, 0, 0, w, h);
      const engravedData = engravedImg.data;

      const runeAlphaAt = (px, py) => {
        px = clamp(px, 0, w - 1);
        py = clamp(py, 0, h - 1);
        return runeData[(py * w + px) * 4 + 3] / 255;
      };

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          const ra = runeData[idx + 3] / 255;
          if (ra <= 0.01) continue;

          const rgx = runeAlphaAt(px + 1, py) - runeAlphaAt(px - 1, py);
          const rgy = runeAlphaAt(px, py + 1) - runeAlphaAt(px, py - 1);

          const engrave = clamp((rgx * -0.9 + rgy * -0.65) * 1.8, -1, 1) * engraveDepth;

          let r = engravedData[idx];
          let g = engravedData[idx + 1];
          let b = engravedData[idx + 2];

          r = lerp(r, metalDark.r, ra * 0.72);
          g = lerp(g, metalDark.g, ra * 0.72);
          b = lerp(b, metalDark.b, ra * 0.72);

          r += engrave * 60;
          g += engrave * 52;
          b += engrave * 42;

          const emberInRune = ra * emberAmount * 0.55;
          r = lerp(r, emberColor.r, emberInRune);
          g = lerp(g, emberColor.g, emberInRune * 0.25);
          b = lerp(b, emberColor.b, emberInRune * 0.12);

          engravedData[idx] = clamp(Math.round(r), 0, 255);
          engravedData[idx + 1] = clamp(Math.round(g), 0, 255);
          engravedData[idx + 2] = clamp(Math.round(b), 0, 255);
        }
      }

      engravedCtx.putImageData(engravedImg, 0, 0);

      const shadowCanvas = createCanvas(w, h);
      const shadowCtx = shadowCanvas.getContext('2d');
      shadowCtx.clearRect(0, 0, w, h);
      shadowCtx.save();
      shadowCtx.shadowColor = 'rgba(0,0,0,0.9)';
      shadowCtx.shadowBlur = 18;
      shadowCtx.shadowOffsetX = 0;
      shadowCtx.shadowOffsetY = 8;
      shadowCtx.drawImage(maskCanvas, 0, 0);
      shadowCtx.restore();

      const redGlowCanvas = createCanvas(w, h);
      const redGlowCtx = redGlowCanvas.getContext('2d');
      redGlowCtx.clearRect(0, 0, w, h);
      redGlowCtx.save();
      redGlowCtx.shadowColor = `rgba(${emberColor.r},${emberColor.g},${emberColor.b},0.9)`;
      redGlowCtx.shadowBlur = 18;
      redGlowCtx.globalAlpha = 0.22 + emberAmount * 0.18;
      redGlowCtx.drawImage(maskCanvas, 0, 0);
      redGlowCtx.restore();

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(shadowCanvas, 0, 0);
      ctx.drawImage(redGlowCanvas, 0, 0);
      ctx.drawImage(engravedCanvas, 0, 0);

      return { canvas, ctx, abortSignal };
    }
  },

  innerShadow: {
    name: 'Inner Shadow',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#000000' },
      { key: 'distance', label: 'Distance', type: 'range', min: 0, max: 80, step: 1, default: 8 },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 135 },
      { key: 'blur', label: 'Blur', type: 'range', min: 0, max: 40, step: 1, default: 10 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const color = params.color ?? '#000000';
      const distance = Math.max(0, params.distance ?? 8);
      const blur = Math.max(0, params.blur ?? 10);
      const opacity = clamp(params.opacity ?? 0.65, 0, 1);
      const angle = ((params.angle ?? 135) * Math.PI) / 180;
      const dx = Math.round(Math.cos(angle) * distance);
      const dy = Math.round(Math.sin(angle) * distance);

      const original = createCanvas(w, h);
      const octx = original.getContext('2d');
      octx.drawImage(canvas, 0, 0);

      const colored = createCanvas(w, h);
      const cctx = colored.getContext('2d');
      cctx.drawImage(original, 0, 0);
      cctx.globalCompositeOperation = 'source-in';
      cctx.fillStyle = color;
      cctx.fillRect(0, 0, w, h);

      const shadow = createCanvas(w, h);
      const sctx = shadow.getContext('2d');
      sctx.filter = `blur(${blur}px)`;
      sctx.globalAlpha = opacity;
      sctx.drawImage(colored, dx, dy);
      sctx.filter = 'none';
      sctx.globalAlpha = 1;

      // keep only the part of the blurred shape that falls INSIDE the original text
      sctx.globalCompositeOperation = 'destination-in';
      sctx.drawImage(original, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(original, 0, 0);
      ctx.drawImage(shadow, 0, 0);

      return { canvas, ctx, abortSignal };
    }
  },

  bevelEmboss: {
    name: 'Bevel Emboss',
    params: [
      { key: 'size', label: 'Size', type: 'range', min: 1, max: 20, step: 1, default: 4 },
      { key: 'softness', label: 'Softness', type: 'range', min: 0, max: 20, step: 1, default: 2 },
      { key: 'angle', label: 'Light Angle', type: 'range', min: 0, max: 360, step: 1, default: 135 },
      { key: 'highlight', label: 'Highlight', type: 'color', default: '#ffffff' },
      { key: 'shadow', label: 'Shadow', type: 'color', default: '#000000' },
      { key: 'strength', label: 'Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.65 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const size = Math.max(1, Math.round(params.size ?? 4));
      const softness = Math.max(0, Math.round(params.softness ?? 2));
      const angle = ((params.angle ?? 135) * Math.PI) / 180;
      const strength = clamp(params.strength ?? 0.65, 0, 1);
      const hi = params.highlight ?? '#ffffff';
      const sh = params.shadow ?? '#000000';

      const dx = Math.round(Math.cos(angle) * size);
      const dy = Math.round(Math.sin(angle) * size);

      const original = createCanvas(w, h);
      const octx = original.getContext('2d');
      octx.drawImage(canvas, 0, 0);

      const makeTint = (color, ox, oy) => {
        const t = createCanvas(w, h);
        const tctx = t.getContext('2d');
        tctx.drawImage(original, ox, oy);
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = color;
        tctx.fillRect(0, 0, w, h);
        if (softness > 0) {
          const b = createCanvas(w, h);
          const bctx = b.getContext('2d');
          bctx.filter = `blur(${softness}px)`;
          bctx.drawImage(t, 0, 0);
          bctx.filter = 'none';
          return b;
        }
        return t;
      };

      const highlightLayer = makeTint(hi, -dx, -dy);
      const shadowLayer = makeTint(sh, dx, dy);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(original, 0, 0);

      ctx.save();
      ctx.globalAlpha = strength;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(highlightLayer, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(shadowLayer, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },

  extrude: {
    name: 'Extrude',
    params: [
      { key: 'depth', label: 'Depth', type: 'range', min: 1, max: 120, step: 1, default: 18 },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 45 },
      { key: 'color', label: 'Side Color', type: 'color', default: '#202020' },
      { key: 'fade', label: 'Fade', type: 'range', min: 0, max: 1, step: 0.01, default: 0.15 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const depth = Math.max(1, Math.round(params.depth ?? 18));
      const angle = ((params.angle ?? 45) * Math.PI) / 180;
      const color = params.color ?? '#202020';
      const fade = clamp(params.fade ?? 0.15, 0, 1);

      const stepX = Math.cos(angle);
      const stepY = Math.sin(angle);

      const original = createCanvas(w, h);
      const octx = original.getContext('2d');
      octx.drawImage(canvas, 0, 0);

      const side = createCanvas(w, h);
      const sctx = side.getContext('2d');
      sctx.drawImage(original, 0, 0);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = color;
      sctx.fillRect(0, 0, w, h);

      const out = createCanvas(w, h);
      const outCtx = out.getContext('2d');

      for (let i = depth; i >= 1; i--) {
        const t = i / depth;
        outCtx.globalAlpha = 1 - (fade * t);
        outCtx.drawImage(side, Math.round(stepX * i), Math.round(stepY * i));
      }

      outCtx.globalAlpha = 1;
      outCtx.drawImage(original, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(out, 0, 0);

      return { canvas, ctx, abortSignal };
    }
  },

  inlineCut: {
    name: 'Inline Cut',
    params: [
      { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 30, step: 1, default: 4 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
      { key: 'color', label: 'Color', type: 'color', default: '#000000' }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const thickness = Math.max(1, Math.round(params.thickness ?? 4));
      const opacity = clamp(params.opacity ?? 0.35, 0, 1);
      const color = params.color ?? '#000000';

      const original = createCanvas(w, h);
      const octx = original.getContext('2d');
      octx.drawImage(canvas, 0, 0);

      const inner = createCanvas(w, h);
      const ictx = inner.getContext('2d');
      ictx.drawImage(original, 0, 0);

      // shrink text inward by drawing many inward copies and intersecting
      const mask = createCanvas(w, h);
      const mctx = mask.getContext('2d');
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, w, h);
      mctx.clearRect(0, 0, w, h);

      let first = true;
      for (let a = 0; a < 360; a += 15) {
        const rad = a * Math.PI / 180;
        const dx = Math.cos(rad) * thickness;
        const dy = Math.sin(rad) * thickness;

        const pass = createCanvas(w, h);
        const pctx = pass.getContext('2d');
        pctx.drawImage(original, dx, dy);

        if (first) {
          mctx.drawImage(pass, 0, 0);
          first = false;
        } else {
          mctx.globalCompositeOperation = 'destination-in';
          mctx.drawImage(pass, 0, 0);
          mctx.globalCompositeOperation = 'source-over';
        }
      }

      const cut = createCanvas(w, h);
      const cctx = cut.getContext('2d');
      cctx.drawImage(original, 0, 0);
      cctx.globalCompositeOperation = 'destination-out';
      cctx.drawImage(mask, 0, 0);

      cctx.globalCompositeOperation = 'source-in';
      cctx.fillStyle = color;
      cctx.globalAlpha = opacity;
      cctx.fillRect(0, 0, w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, 0);
      ctx.drawImage(cut, 0, 0);

      return { canvas, ctx, abortSignal };
    }
  },

  specular: {
    name: 'Specular',
    params: [
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 25 },
      { key: 'width', label: 'Band Width', type: 'range', min: 0.02, max: 1, step: 0.01, default: 0.18 },
      { key: 'strength', label: 'Strength', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },
      { key: 'color', label: 'Color', type: 'color', default: '#ffffff' }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const angle = ((params.angle ?? 25) * Math.PI) / 180;
      const band = clamp(params.width ?? 0.18, 0.02, 1);
      const strength = clamp(params.strength ?? 0.75, 0, 1);
      const color = params.color ?? '#ffffff';

      const sheen = createCanvas(w, h);
      const sctx = sheen.getContext('2d');

      const cx = w / 2, cy = h / 2;
      const r = Math.max(w, h);
      const x1 = cx - Math.cos(angle) * r;
      const y1 = cy - Math.sin(angle) * r;
      const x2 = cx + Math.cos(angle) * r;
      const y2 = cy + Math.sin(angle) * r;

      const g = sctx.createLinearGradient(x1, y1, x2, y2);
      const a = Math.max(0, 0.5 - band / 2);
      const b = Math.min(1, 0.5 + band / 2);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(a, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, color);
      g.addColorStop(b, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0)');

      sctx.fillStyle = g;
      sctx.fillRect(0, 0, w, h);
      sctx.globalCompositeOperation = 'destination-in';
      sctx.drawImage(canvas, 0, 0);

      ctx.save();
      ctx.globalAlpha = strength;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(sheen, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },

  rimLight: {
    name: 'Rim Light',
    params: [
      { key: 'color', label: 'Color', type: 'color', default: '#7fd6ff' },
      { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 20, step: 1, default: 4 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: 'side', label: 'Side', type: 'select', options: ['All', 'Left', 'Right', 'Top', 'Bottom'], default: 'All' }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const thickness = Math.max(1, Math.round(params.thickness ?? 4));
      const opacity = clamp(params.opacity ?? 0.8, 0, 1);
      const color = params.color ?? '#7fd6ff';
      const side = params.side ?? 'All';

      const glow = createCanvas(w, h);
      const gctx = glow.getContext('2d');

      const tinted = createCanvas(w, h);
      const tctx = tinted.getContext('2d');
      tctx.drawImage(canvas, 0, 0);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = color;
      tctx.fillRect(0, 0, w, h);

      for (let a = 0; a < 360; a += 10) {
        const rad = a * Math.PI / 180;
        const dx = Math.cos(rad) * thickness;
        const dy = Math.sin(rad) * thickness;

        if (side === 'Left' && dx > 0) continue;
        if (side === 'Right' && dx < 0) continue;
        if (side === 'Top' && dy > 0) continue;
        if (side === 'Bottom' && dy < 0) continue;

        gctx.drawImage(tinted, dx, dy);
      }

      gctx.globalCompositeOperation = 'destination-out';
      gctx.drawImage(canvas, 0, 0);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(glow, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },

  gradientMap: {
    name: 'Gradient Map',
    params: [
      { key: 'shadowColor', label: 'Shadow Color', type: 'color', default: '#1a1a1a' },
      { key: 'midColor', label: 'Mid Color', type: 'color', default: '#888888' },
      { key: 'highlightColor', label: 'Highlight Color', type: 'color', default: '#ffffff' },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const opacity = clamp(params.opacity ?? 1, 0, 1);

      const tmp = createCanvas(w, h);
      const tctx = tmp.getContext('2d');
      tctx.drawImage(canvas, 0, 0);

      const img = getImageDataSafe(tctx, 0, 0, w, h);
      const d = img.data;

      const hexToRgb = (hex) => {
        const n = hex.replace('#', '');
        const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
        return {
          r: parseInt(full.slice(0, 2), 16),
          g: parseInt(full.slice(2, 4), 16),
          b: parseInt(full.slice(4, 6), 16)
        };
      };

      const c1 = hexToRgb(params.shadowColor ?? '#1a1a1a');
      const c2 = hexToRgb(params.midColor ?? '#888888');
      const c3 = hexToRgb(params.highlightColor ?? '#ffffff');

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;

        const lum = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;

        let a, b, t;
        if (lum < 0.5) {
          a = c1; b = c2; t = lum / 0.5;
        } else {
          a = c2; b = c3; t = (lum - 0.5) / 0.5;
        }

        d[i] = lerp(a.r, b.r, t);
        d[i + 1] = lerp(a.g, b.g, t);
        d[i + 2] = lerp(a.b, b.b, t);
      }

      tctx.putImageData(img, 0, 0);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },

  channelTear: {
    name: 'Channel Tear',
    params: [
      { key: 'maxShift', label: 'Max Shift', type: 'range', min: 1, max: 80, step: 1, default: 16 },
      { key: 'bandHeight', label: 'Band Height', type: 'range', min: 2, max: 80, step: 1, default: 12 },
      { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 9999, step: 1, default: 101 },
      { key: 'alphaLoss', label: 'Alpha Loss', type: 'range', min: 0, max: 1, step: 0.01, default: 0.08 }
    ],
    apply: (ctx, canvas, text, x, y, params = {}, abortSignal) => {
      const w = canvas.width, h = canvas.height;
      const maxShift = Math.max(1, Math.round(params.maxShift ?? 16));
      const bandHeight = Math.max(1, Math.round(params.bandHeight ?? 12));
      const alphaLoss = clamp(params.alphaLoss ?? 0.08, 0, 1);
      const rnd = createSeededRandom(params.seed) ?? Math.random;

      const srcCanvas = createCanvas(w, h);
      const sctx = srcCanvas.getContext('2d');
      sctx.drawImage(canvas, 0, 0);

      const out = createCanvas(w, h);
      const octx = out.getContext('2d');
      octx.globalCompositeOperation = 'screen';

      const drawBand = (channel, tint) => {
        for (let y0 = 0; y0 < h; y0 += bandHeight) {
          const bh = Math.min(bandHeight, h - y0);
          const shift = Math.round((rnd() * 2 - 1) * maxShift);

          const band = createCanvas(w, bh);
          const bctx = band.getContext('2d');
          bctx.drawImage(srcCanvas, 0, y0, w, bh, 0, 0, w, bh);

          const img = bctx.getImageData(0, 0, w, bh);
          const d = img.data;

          for (let i = 0; i < d.length; i += 4) {
            if (channel !== 0) d[i] = 0;
            if (channel !== 1) d[i + 1] = 0;
            if (channel !== 2) d[i + 2] = 0;
            d[i + 3] = d[i + 3] * (1 - alphaLoss);
          }

          bctx.putImageData(img, 0, 0);
          octx.drawImage(band, shift, y0);

          if (tint) {
            octx.save();
            octx.globalCompositeOperation = 'screen';
            octx.fillStyle = tint;
            octx.restore();
          }
        }
      };

      drawBand(0);
      drawBand(1);
      drawBand(2);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(out, 0, 0);

      return { canvas, ctx, abortSignal };
    }
  },
  hologram: {
    name: 'Holographic Foil',
    params: [
      { key: 'scale', label: 'Wave Scale', type: 'range', min: 10, max: 200, step: 1, default: 80 },
      { key: 'complexity', label: 'Complexity', type: 'range', min: 1, max: 5, step: 0.1, default: 2.5 },
      { key: 'lightness', label: 'Lightness', type: 'range', min: 20, max: 80, step: 1, default: 60 },
      { key: 'angle', label: 'Light Angle', type: 'range', min: 0, max: 360, step: 1, default: 45 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const scale = params.scale ?? 80;
      const comp = params.complexity ?? 2.5;
      const lightness = params.lightness ?? 60;
      const angle = (params.angle ?? 45) * (Math.PI / 180);
      const w = canvas.width, h = canvas.height;

      const holoCanvas = document.createElement('canvas');
      holoCanvas.width = w; holoCanvas.height = h;
      const hCtx = holoCanvas.getContext('2d');
      const imgData = hCtx.createImageData(w, h);
      const data = imgData.data;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Função HSL para RGB otimizada
      const hslToRgb = (h, s, l) => {
        let r, g, b;
        if (s === 0) { r = g = b = l; } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          // Rotaciona as coordenadas para o ângulo da luz
          const rx = px * cosA - py * sinA;
          const ry = px * sinA + py * cosA;

          // Cria padrões de interferência
          const v1 = Math.sin(rx / scale);
          const v2 = Math.sin((ry / scale) * comp);
          const v3 = Math.sin((rx + ry) / (scale * 1.5));

          // Mapeia o resultado para o espectro de matiz (Hue 0-1)
          let hue = (v1 + v2 + v3) / 3;
          hue = (hue + 1) / 2; // Normaliza para 0-1

          const [r, g, b] = hslToRgb(hue, 0.85, lightness / 100);

          const idx = (py * w + px) * 4;
          data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
        }
      }
      hCtx.putImageData(imgData, 0, 0);

      // Aplica o foil apenas onde existe texto
      hCtx.globalCompositeOperation = 'destination-in';
      hCtx.drawImage(canvas, 0, 0);

      // Mescla com o texto original para manter sombras e base
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = 0.3; // Base escura original
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'color-dodge'; // Faz o foil brilhar
      ctx.drawImage(holoCanvas, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  topographic: {
    name: 'Topographic Contour',
    params: [
      { key: 'levels', label: 'Line Density', type: 'range', min: 5, max: 50, step: 1, default: 20 },
      { key: 'thickness', label: 'Line Thickness', type: 'range', min: 1, max: 10, step: 0.5, default: 2 },
      { key: 'color', label: 'Line Color', type: 'color', default: '#00ffcc' },
      { key: 'bg', label: 'Fill Background', type: 'checkbox', default: false }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const levels = params.levels ?? 20;
      const thickness = params.thickness ?? 2;
      const color = params.color ?? '#00ffcc';
      const fillBg = params.bg ?? false;
      const w = canvas.width, h = canvas.height;

      // 1. Gera um Distance Field pesado
      const dfCanvas = document.createElement('canvas');
      dfCanvas.width = w; dfCanvas.height = h;
      const dfCtx = dfCanvas.getContext('2d');

      // Múltiplos blurs para criar um gradiente perfeito do centro para fora
      dfCtx.drawImage(canvas, 0, 0);
      for (let i = 0; i < 3; i++) {
        const temp = document.createElement('canvas');
        temp.width = w; temp.height = h;
        const tCtx = temp.getContext('2d');
        tCtx.filter = `blur(${20 + (i * 10)}px)`;
        tCtx.drawImage(dfCanvas, 0, 0);
        dfCtx.clearRect(0, 0, w, h);
        dfCtx.drawImage(temp, 0, 0);
      }

      const dfData = dfCtx.getImageData(0, 0, w, h).data;
      const outImg = ctx.createImageData(w, h);
      const out = outImg.data;
      const rgb = hexToRgb(color);

      // O valor alfa mapeia de 0 (vazio) a 255 (centro do texto)
      const spacing = 255 / levels;

      for (let i = 0; i < dfData.length; i += 4) {
        const val = dfData[i + 3];

        // Operação de módulo para criar os "degraus" do mapa
        if (val > 2 && (val % spacing) < (thickness * (spacing / 10))) {
          out[i] = rgb.r; out[i + 1] = rgb.g; out[i + 2] = rgb.b; out[i + 3] = 255;
        } else if (fillBg && val > 2) {
          // Preenchimento de fundo leve para não vazar a cor original
          out[i] = rgb.r * 0.1; out[i + 1] = rgb.g * 0.1; out[i + 2] = rgb.b * 0.1; out[i + 3] = val;
        }
      }

      ctx.putImageData(outImg, 0, 0);

      // Limpa fora da forma original se não quiser vazamento (opcional)
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(canvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      return { canvas, ctx, abortSignal };
    }
  },
  fluffy: {
    name: 'Flush / Fur',
    params: [
      { key: 'color', label: 'Fur Color', type: 'color', default: '#ff88aa' },
      { key: 'length', label: 'Fur Length', type: 'range', min: 5, max: 60, step: 1, default: 25 },
      { key: 'density', label: 'Density', type: 'range', min: 0.1, max: 1, step: 0.1, default: 0.5 },
      { key: 'gravity', label: 'Gravity/Wind', type: 'range', min: -90, max: 90, step: 1, default: 20 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const color = params.color ?? '#ff88aa';
      const furLength = params.length ?? 25;
      const density = params.density ?? 0.5;
      const gravity = (params.gravity ?? 20) * (Math.PI / 180);
      const seed = params.seed ?? 1;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 543;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const furCanvas = document.createElement('canvas');
      furCanvas.width = w; furCanvas.height = h;
      const fCtx = furCanvas.getContext('2d');

      // Preenche a base sólida
      fCtx.globalCompositeOperation = 'source-over';
      fCtx.drawImage(canvas, 0, 0);
      fCtx.globalCompositeOperation = 'source-in';
      fCtx.fillStyle = color;
      fCtx.fillRect(0, 0, w, h);

      // Pega os dados para saber onde "nasce" o pêlo
      fCtx.globalCompositeOperation = 'source-over';
      const srcData = ctx.getImageData(0, 0, w, h).data;

      fCtx.strokeStyle = color;
      fCtx.lineCap = 'round';

      // Pula pixels para performance, inversamente proporcional à densidade
      const step = Math.max(1, Math.floor(4 - (density * 3)));

      for (let py = 0; py < h; py += step) {
        for (let px = 0; px < w; px += step) {
          const alpha = srcData[(py * w + px) * 4 + 3];

          if (alpha > 50) {
            // Chance de nascer um pêlo neste pixel
            if (rng() > density) continue;

            const len = furLength * (0.5 + rng() * 0.5); // Variação de tamanho
            const angle = gravity + (rng() - 0.5) * 1.5; // Variação de direção

            // Desenha o pêlo usando uma curva Bezier para parecer natural
            fCtx.beginPath();
            fCtx.moveTo(px, py);

            // Ponto de controle para curvar o pêlo
            const cpX = px + Math.cos(angle - 0.5) * (len * 0.5);
            const cpY = py + Math.sin(angle - 0.5) * (len * 0.5);

            const endX = px + Math.cos(angle) * len;
            const endY = py + Math.sin(angle) * len;

            fCtx.quadraticCurveTo(cpX, cpY, endX, endY);

            // Pêlos mais finos nas pontas (simulado via opacidade no canvas 2d)
            fCtx.lineWidth = 1 + rng() * 1.5;
            fCtx.globalAlpha = 0.6 + rng() * 0.4;
            fCtx.stroke();
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(furCanvas, 0, 0);

      // Adiciona uma leve sombra interna para volume
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      return { canvas, ctx, abortSignal };
    }
  },
  balloon: {
    name: '3D Plastic Balloon',
    params: [
      { key: 'color', label: 'Plastic Color', type: 'color', default: '#ff0055' },
      { key: 'inflation', label: 'Inflation Depth', type: 'range', min: 5, max: 40, step: 1, default: 20 },
      { key: 'shininess', label: 'Shininess', type: 'range', min: 10, max: 100, step: 1, default: 80 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const color = hexToRgb(params.color ?? '#ff0055');
      const depth = params.inflation ?? 20;
      const shininess = params.shininess ?? 80;
      const w = canvas.width, h = canvas.height;

      // 1. Gera o Height Map "Gordo"
      const mapCanvas = document.createElement('canvas');
      mapCanvas.width = w; mapCanvas.height = h;
      const mCtx = mapCanvas.getContext('2d');
      mCtx.drawImage(canvas, 0, 0);
      mCtx.globalCompositeOperation = 'source-in';
      mCtx.fillStyle = '#fff';
      mCtx.fillRect(0, 0, w, h);

      mCtx.filter = `blur(${depth}px)`;
      mCtx.globalCompositeOperation = 'source-over';
      mCtx.drawImage(mapCanvas, 0, 0); // Reforça o centro
      mCtx.filter = 'none';

      const mapData = mCtx.getImageData(0, 0, w, h).data;
      const srcData = ctx.getImageData(0, 0, w, h).data;
      const outImg = ctx.createImageData(w, h);
      const out = outImg.data;

      // Vetor de luz vindo do topo esquerdo
      const Lx = -0.6, Ly = -0.6, Lz = 0.52;

      for (let py = 1; py < h - 1; py++) {
        const offset = py * w;
        for (let px = 1; px < w - 1; px++) {
          const idx = (offset + px) * 4;
          const alpha = srcData[idx + 3];
          if (alpha < 5) continue;

          // Perfil Arredondado (Seno/Cosseno simulado)
          const hRaw = mapData[idx + 1] / 255;
          // Curve ease-out para inflar o meio como um balão
          const hVal = Math.sin(hRaw * (Math.PI / 2)) * 255;

          const hL = Math.sin((mapData[(offset + px - 1) * 4 + 1] / 255) * (Math.PI / 2)) * 255;
          const hR = Math.sin((mapData[(offset + px + 1) * 4 + 1] / 255) * (Math.PI / 2)) * 255;
          const hT = Math.sin((mapData[((py - 1) * w + px) * 4 + 1] / 255) * (Math.PI / 2)) * 255;
          const hB = Math.sin((mapData[((py + 1) * w + px) * 4 + 1] / 255) * (Math.PI / 2)) * 255;

          const nx = (hL - hR);
          const ny = (hT - hB);
          const nz = 4000 / depth; // Constante Z suave para balão

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const Nnx = nx / len, Nny = ny / len, Nnz = nz / len;

          let diffuse = Math.max(0, -(Nnx * Lx + Nny * Ly + Nnz * Lz));

          // Efeito de Plástico (Highlight Specular muito afiado)
          let specular = Math.pow(diffuse, shininess);

          // Subsurface scattering falso (Bordas mais saturadas/claras)
          const edgeGlow = (1 - hRaw) * 0.4;

          let r = color.r * (0.3 + diffuse * 0.7 + edgeGlow);
          let g = color.g * (0.3 + diffuse * 0.7 + edgeGlow);
          let b = color.b * (0.3 + diffuse * 0.7 + edgeGlow);

          r += specular * 255;
          g += specular * 255;
          b += specular * 255;

          out[idx] = Math.min(255, r);
          out[idx + 1] = Math.min(255, g);
          out[idx + 2] = Math.min(255, b);
          out[idx + 3] = alpha;
        }
      }

      ctx.putImageData(outImg, 0, 0);
      return { canvas, ctx, abortSignal };
    }
  },
  woodTexture: {
    name: 'Wood Grain',
    params: [
      { key: 'baseColor', label: 'Base Color', type: 'color', default: '#8b5a2b' },
      { key: 'ringColor', label: 'Ring Color', type: 'color', default: '#4a2f14' },
      { key: 'rings', label: 'Ring Density', type: 'range', min: 1, max: 50, step: 1, default: 15 },
      { key: 'distortion', label: 'Knot Distortion', type: 'range', min: 0, max: 10, step: 0.1, default: 3.5 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 42 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const cBase = hexToRgb(params.baseColor ?? '#8b5a2b');
      const cRing = hexToRgb(params.ringColor ?? '#4a2f14');
      const ringDensity = params.rings ?? 15;
      const distortion = params.distortion ?? 3.5;
      const seed = params.seed ?? 42;
      const w = canvas.width, h = canvas.height;

      const outImg = ctx.createImageData(w, h);
      const data = outImg.data;
      const srcData = ctx.getImageData(0, 0, w, h).data;

      // PRNG Simples
      let _s = seed * 1029;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const noiseGrid = new Float32Array(256 * 256);
      for (let i = 0; i < noiseGrid.length; i++) noiseGrid[i] = rng();

      const getNoise = (nx, ny) => {
        const x = Math.floor(nx) % 256;
        const y = Math.floor(ny) % 256;
        return noiseGrid[(y < 0 ? y + 256 : y) * 256 + (x < 0 ? x + 256 : x)];
      };

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          const alpha = srcData[idx + 3];
          if (alpha < 5) continue;

          // Ruído para distorcer a coordenada
          const nx = px * 0.02;
          const ny = py * 0.005; // Esticado verticalmente para simular o veio
          const n = getNoise(nx, ny) + getNoise(nx * 2, ny * 2) * 0.5;

          // Distância do centro distorcida
          const dx = (px - w / 2) * 0.01 + n * distortion;
          const dy = (py - h / 2) * 0.01 + n * distortion;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Função seno para os anéis
          let ringVal = (Math.sin(dist * ringDensity) + 1) / 2;
          // Deixa as bordas dos anéis mais duras
          ringVal = Math.pow(ringVal, 0.6);

          data[idx] = lerp(cRing.r, cBase.r, ringVal);
          data[idx + 1] = lerp(cRing.g, cBase.g, ringVal);
          data[idx + 2] = lerp(cRing.b, cBase.b, ringVal);
          data[idx + 3] = alpha;
        }
      }

      ctx.putImageData(outImg, 0, 0);
      return { canvas, ctx, abortSignal };
    }
  }, concreteTexture: {
    name: 'Concrete / Stone',
    params: [
      { key: 'lightColor', label: 'Light Area', type: 'color', default: '#cccccc' },
      { key: 'darkColor', label: 'Dark Area', type: 'color', default: '#777777' },
      { key: 'roughness', label: 'Surface Noise', type: 'range', min: 0, max: 1, step: 0.1, default: 0.8 },
      { key: 'pores', label: 'Pore Density', type: 'range', min: 0, max: 1, step: 0.05, default: 0.3 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 12 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const cLight = hexToRgb(params.lightColor ?? '#cccccc');
      const cDark = hexToRgb(params.darkColor ?? '#777777');
      const roughness = params.roughness ?? 0.8;
      const pores = params.pores ?? 0.3;
      const seed = params.seed ?? 12;
      const w = canvas.width, h = canvas.height;

      const outImg = ctx.createImageData(w, h);
      const data = outImg.data;
      const srcData = ctx.getImageData(0, 0, w, h).data;

      let _s = seed * 412;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          const alpha = srcData[idx + 3];
          if (alpha < 5) continue;

          // Ruído base (manchas grandes) - aproximação rápida sem FBM completo
          const macroNoise = (Math.sin(px * 0.03 + rng() * 0.1) + Math.cos(py * 0.02 + rng() * 0.1) + 2) / 4;

          // Ruído de grão (areia do concreto)
          const microNoise = rng();

          // Mistura de cor base
          const mix = clamp(macroNoise + (microNoise - 0.5) * roughness, 0, 1);
          let r = lerp(cDark.r, cLight.r, mix);
          let g = lerp(cDark.g, cLight.g, mix);
          let b = lerp(cDark.b, cLight.b, mix);

          // Poros (Buracos profundos)
          if (rng() < (pores * 0.1)) {
            // Escurece drasticamente para simular sombra do buraco
            r *= 0.2; g *= 0.2; b *= 0.2;
          }

          data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = alpha;
        }
      }

      ctx.putImageData(outImg, 0, 0);

      // Adiciona um leve chanfro/bevel para dar volume à pedra
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.shadowColor = 'rgba(255,255,255,0.4)';
      ctx.shadowOffsetX = -2; ctx.shadowOffsetY = -2; ctx.shadowBlur = 2;
      ctx.drawImage(canvas, 0, 0); // Highlight

      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3; ctx.shadowBlur = 4;
      ctx.drawImage(canvas, 0, 0); // Shadow
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  }, leatherTexture: {
    name: 'Leather',
    params: [
      { key: 'baseColor', label: 'Leather Color', type: 'color', default: '#3d1f00' },
      { key: 'creaseColor', label: 'Crease Color', type: 'color', default: '#1a0d00' },
      { key: 'scale', label: 'Wrinkle Scale', type: 'range', min: 0.01, max: 0.2, step: 0.01, default: 0.08 },
      { key: 'depth', label: 'Depth', type: 'range', min: 0, max: 1, step: 0.1, default: 0.7 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 5 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const cBase = hexToRgb(params.baseColor ?? '#3d1f00');
      const cCrease = hexToRgb(params.creaseColor ?? '#1a0d00');
      const scale = params.scale ?? 0.08;
      const depth = params.depth ?? 0.7;
      const seed = params.seed ?? 5;
      const w = canvas.width, h = canvas.height;

      const outImg = ctx.createImageData(w, h);
      const data = outImg.data;
      const srcData = ctx.getImageData(0, 0, w, h).data;

      let _s = seed * 732;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const noiseSize = 256;
      const noise = new Float32Array(noiseSize * noiseSize);
      for (let i = 0; i < noise.length; i++) noise[i] = rng() * 2 - 1; // -1 a 1

      const getNoise = (x, y) => {
        const ix = Math.floor(x) & 255; const iy = Math.floor(y) & 255;
        const fx = x - Math.floor(x); const fy = y - Math.floor(y);
        const i00 = noise[iy * 256 + ix]; const i10 = noise[iy * 256 + ((ix + 1) & 255)];
        const i01 = noise[((iy + 1) & 255) * 256 + ix]; const i11 = noise[((iy + 1) & 255) * 256 + ((ix + 1) & 255)];
        const nx0 = lerp(i00, i10, fx); const nx1 = lerp(i01, i11, fx);
        return lerp(nx0, nx1, fy);
      };

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          const alpha = srcData[idx + 3];
          if (alpha < 5) continue;

          // Turbulence (Abs do ruído cria "vales" afiados)
          let turb = 0;
          turb += Math.abs(getNoise(px * scale, py * scale));
          turb += Math.abs(getNoise(px * scale * 2, py * scale * 2)) * 0.5;
          turb += Math.abs(getNoise(px * scale * 4, py * scale * 4)) * 0.25;

          // Inverte e ajusta para que os vales sejam escuros
          let creaseMask = clamp(1 - (turb * depth * 1.5), 0, 1);

          // Adiciona um microponto de luz (specular do couro) nas partes altas
          const highlight = (creaseMask > 0.8) ? (creaseMask - 0.8) * 2 : 0;

          let r = lerp(cCrease.r, cBase.r, creaseMask) + (highlight * 255);
          let g = lerp(cCrease.g, cBase.g, creaseMask) + (highlight * 255);
          let b = lerp(cCrease.b, cBase.b, creaseMask) + (highlight * 255);

          data[idx] = clamp(r, 0, 255);
          data[idx + 1] = clamp(g, 0, 255);
          data[idx + 2] = clamp(b, 0, 255);
          data[idx + 3] = alpha;
        }
      }

      ctx.putImageData(outImg, 0, 0);
      return { canvas, ctx, abortSignal };
    }
  }, glitterTexture: {
    name: 'Glitter / Sparkle',
    params: [
      { key: 'baseColor', label: 'Glitter Color', type: 'color', default: '#ff0077' },
      { key: 'density', label: 'Flake Density', type: 'range', min: 0.1, max: 1, step: 0.1, default: 0.7 },
      { key: 'rainbow', label: 'Iridescence', type: 'range', min: 0, max: 1, step: 0.1, default: 0.3 },
      { key: 'size', label: 'Flake Size', type: 'range', min: 1, max: 4, step: 1, default: 2 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const cBase = hexToRgb(params.baseColor ?? '#ff0077');
      const density = params.density ?? 0.7;
      const rainbow = params.rainbow ?? 0.3;
      const flakeSize = params.size ?? 2;
      const w = canvas.width, h = canvas.height;

      const glitCanvas = document.createElement('canvas');
      glitCanvas.width = w; glitCanvas.height = h;
      const gCtx = glitCanvas.getContext('2d');

      // Preenche fundo escuro da cor base
      gCtx.fillStyle = `rgb(${cBase.r * 0.4}, ${cBase.g * 0.4}, ${cBase.b * 0.4})`;
      gCtx.fillRect(0, 0, w, h);

      // Prepara o ImageData para injetar os pontos
      const imgData = gCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const rng = () => Math.random();

      for (let py = 0; py < h; py += flakeSize) {
        for (let px = 0; px < w; px += flakeSize) {

          if (rng() < density) {
            // Decide o brilho do floco (alguns pegam luz direta, outros não)
            const brightness = rng();
            let r = cBase.r * brightness * 2;
            let g = cBase.g * brightness * 2;
            let b = cBase.b * brightness * 2;

            // Efeito iridescente (muda levemente a cor)
            if (rng() < rainbow) {
              r += (rng() - 0.5) * 150;
              g += (rng() - 0.5) * 150;
              b += (rng() - 0.5) * 150;
            }

            // Desenha o bloco (simulando size)
            for (let sy = 0; sy < flakeSize; sy++) {
              for (let sx = 0; sx < flakeSize; sx++) {
                if (px + sx < w && py + sy < h) {
                  const idx = ((py + sy) * w + (px + sx)) * 4;
                  data[idx] = clamp(r, 0, 255);
                  data[idx + 1] = clamp(g, 0, 255);
                  data[idx + 2] = clamp(b, 0, 255);
                }
              }
            }
          }
        }
      }
      gCtx.putImageData(imgData, 0, 0);

      // Recorta o glitter no formato do texto original
      gCtx.globalCompositeOperation = 'destination-in';
      gCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(glitCanvas, 0, 0);

      // Bloom/Glow no próprio texto para destacar os brilhos
      ctx.save();
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.filter = 'blur(2px)';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glitCanvas, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  mangaScreentone: {
    name: 'Manga Screentone',
    params: [
      { key: 'dotSize', label: 'Max Dot Size', type: 'range', min: 2, max: 20, step: 1, default: 6 },
      { key: 'spacing', label: 'Grid Spacing', type: 'range', min: 4, max: 30, step: 1, default: 8 },
      { key: 'angle', label: 'Screen Angle', type: 'range', min: 0, max: 90, step: 1, default: 45 },
      { key: 'color', label: 'Ink Color', type: 'color', default: '#111111' },
      { key: 'gradient', label: 'Shading', type: 'range', min: 0, max: 1, step: 0.1, default: 1 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const maxDot = params.dotSize ?? 6;
      const spacing = params.spacing ?? 8;
      const angle = (params.angle ?? 45) * (Math.PI / 180);
      const color = params.color ?? '#111111';
      const gradAmount = params.gradient ?? 1;
      const w = canvas.width, h = canvas.height;

      // 1. Pega a máscara do texto original
      const srcData = ctx.getImageData(0, 0, w, h).data;

      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = w; screenCanvas.height = h;
      const sCtx = screenCanvas.getContext('2d');

      sCtx.fillStyle = color;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Encontra os limites para saber onde aplicar o gradiente de sombreamento
      let minY = h, maxY = 0;
      for (let i = 3; i < srcData.length; i += 4) {
        if (srcData[i] > 10) {
          const py = Math.floor((i / 4) / w);
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
      const textHeight = maxY - minY;

      // 2. Desenha o grid rotacionado
      // Expandimos os limites do loop para cobrir as rotações sem cortar as bordas
      const diag = Math.sqrt(w * w + h * h);
      const limit = Math.ceil(diag / spacing);

      for (let gridY = -limit; gridY <= limit; gridY++) {
        for (let gridX = -limit; gridX <= limit; gridX++) {

          // Coordenadas originais do grid não rotacionado
          const px = gridX * spacing;
          const py = gridY * spacing;

          // Rotaciona as coordenadas para a posição na tela
          const screenX = Math.round(w / 2 + (px * cosA - py * sinA));
          const screenY = Math.round(h / 2 + (px * sinA + py * cosA));

          if (screenX >= 0 && screenX < w && screenY >= 0 && screenY < h) {
            const idx = (screenY * w + screenX) * 4;
            const alpha = srcData[idx + 3];

            if (alpha > 0) {
              // Calcula o tamanho do ponto baseado na posição Y (Sombreamento)
              let intensity = 1;
              if (gradAmount > 0 && textHeight > 0) {
                const relativeY = (screenY - minY) / textHeight; // 0 (topo) a 1 (base)
                // O gradiente faz os pontos serem menores no topo e maiores na base
                intensity = lerp(1, relativeY, gradAmount);
              }

              // Suaviza a borda usando o alpha original do texto
              const edgeSoftness = alpha / 255;
              const radius = (maxDot / 2) * intensity * edgeSoftness;

              if (radius > 0.5) {
                sCtx.beginPath();
                sCtx.arc(screenX, screenY, radius, 0, Math.PI * 2);
                sCtx.fill();
              }
            }
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(screenCanvas, 0, 0);

      // Opcional: Adiciona um contorno sólido sutil para o texto não sumir
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.shadowColor = color;
      ctx.shadowBlur = 2;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  actionSpeedlines: {
    name: 'Anime Speedlines',
    params: [
      { key: 'color', label: 'Line Color', type: 'color', default: '#ffffff' },
      { key: 'density', label: 'Line Density', type: 'range', min: 10, max: 200, step: 1, default: 80 },
      { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 20, step: 1, default: 4 },
      { key: 'centerClear', label: 'Clear Center', type: 'range', min: 0, max: 1, step: 0.1, default: 0.3 },
      { key: 'mode', label: 'Masking', type: 'select', options: ['Behind Text', 'Inside Text'], default: 'Inside Text' },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 99 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const color = params.color ?? '#ffffff';
      const density = params.density ?? 80;
      const thickness = params.thickness ?? 4;
      const centerClear = params.centerClear ?? 0.3;
      const isInside = params.mode === 'Inside Text';
      const seed = params.seed ?? 99;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 852;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const linesCanvas = document.createElement('canvas');
      linesCanvas.width = w; linesCanvas.height = h;
      const lCtx = linesCanvas.getContext('2d');

      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.sqrt(cx * cx + cy * cy);
      const clearRadius = maxRadius * centerClear;

      lCtx.fillStyle = color;

      // Desenha as linhas radiais
      for (let i = 0; i < density; i++) {
        const angle = rng() * Math.PI * 2;

        // Varia onde a linha começa (para não ser um círculo perfeito no meio)
        const startRadius = clearRadius + (rng() * clearRadius);

        // Varia a grossura da linha
        const lineThick = thickness * (0.2 + rng() * 0.8);

        lCtx.save();
        lCtx.translate(cx, cy);
        lCtx.rotate(angle);

        // Desenha um triângulo fino (estilo speedline) que afina em direção ao centro
        lCtx.beginPath();
        lCtx.moveTo(startRadius, -lineThick / 4);
        lCtx.lineTo(maxRadius, -lineThick);
        lCtx.lineTo(maxRadius, lineThick);
        lCtx.lineTo(startRadius, lineThick / 4);
        lCtx.fill();

        lCtx.restore();
      }

      ctx.clearRect(0, 0, w, h);

      if (isInside) {
        // As linhas preenchem o texto
        lCtx.globalCompositeOperation = 'destination-in';
        lCtx.drawImage(canvas, 0, 0);

        // Mantém uma borda ou fundo sutil do texto original para legibilidade
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();

        ctx.drawImage(linesCanvas, 0, 0);
      } else {
        // As linhas ficam no fundo, o texto intacto na frente
        ctx.drawImage(linesCanvas, 0, 0);

        // Borda grossa preta/branca no texto ajuda a separar do fundo caótico
        ctx.save();
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 10;
        ctx.drawImage(canvas, 0, 0);
        ctx.drawImage(canvas, 0, 0); // Desenha duas vezes para endurecer a sombra
        ctx.restore();
      }

      return { canvas, ctx, abortSignal };
    }
  },
  cosmicNebula: {
    name: 'Cosmic / Galaxy',
    params: [
      { key: 'color1', label: 'Nebula A', type: 'color', default: '#ff00aa' },
      { key: 'color2', label: 'Nebula B', type: 'color', default: '#00ccff' },
      { key: 'stars', label: 'Star Density', type: 'range', min: 100, max: 2000, step: 100, default: 800 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 42 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const c1 = hexToRgb(params.color1 ?? '#ff00aa');
      const c2 = hexToRgb(params.color2 ?? '#00ccff');
      const starCount = params.stars ?? 800;
      const seed = params.seed ?? 42;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 1010;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const spaceCanvas = document.createElement('canvas');
      spaceCanvas.width = w; spaceCanvas.height = h;
      const sCtx = spaceCanvas.getContext('2d');
      const imgData = sCtx.createImageData(w, h);
      const data = imgData.data;

      // Noise Helpers
      const noiseGrid = new Float32Array(256 * 256);
      for (let i = 0; i < noiseGrid.length; i++) noiseGrid[i] = rng();
      const getNoise = (nx, ny) => {
        const x = Math.floor(nx) & 255, y = Math.floor(ny) & 255;
        const fx = nx - Math.floor(nx), fy = ny - Math.floor(ny);
        const i00 = noiseGrid[y * 256 + x], i10 = noiseGrid[y * 256 + ((x + 1) & 255)];
        const i01 = noiseGrid[((y + 1) & 255) * 256 + x], i11 = noiseGrid[((y + 1) & 255) * 256 + ((x + 1) & 255)];
        return lerp(lerp(i00, i10, fx), lerp(i01, i11, fx), fy);
      };

      // 1. Gera a Nebulosa (FBM)
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;

          let n = 0;
          n += getNoise(px * 0.01, py * 0.01);
          n += getNoise(px * 0.02, py * 0.02) * 0.5;
          n += getNoise(px * 0.04, py * 0.04) * 0.25;
          n /= 1.75; // Normaliza

          // Mapeia o ruído:
          // Partes baixas = Escuro/Espaço
          // Partes médias = Cor 1
          // Partes altas = Cor 2

          let r = 0, g = 0, b = 0;

          if (n > 0.4) {
            const mix = clamp((n - 0.4) * 2.5, 0, 1);
            r = lerp(c1.r * 0.2, c2.r, mix);
            g = lerp(c1.g * 0.2, c2.g, mix);
            b = lerp(c1.b * 0.2, c2.b, mix);
          } else if (n > 0.2) {
            const mix = clamp((n - 0.2) * 5, 0, 1);
            r = c1.r * mix * 0.5;
            g = c1.g * mix * 0.5;
            b = c1.b * mix * 0.5;
          }

          data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
        }
      }
      sCtx.putImageData(imgData, 0, 0);

      // 2. Adiciona as Estrelas
      sCtx.globalCompositeOperation = 'screen';
      for (let i = 0; i < starCount; i++) {
        const sx = rng() * w;
        const sy = rng() * h;
        const size = rng() * 1.5;
        const brightness = 0.5 + rng() * 0.5;

        sCtx.beginPath();
        sCtx.arc(sx, sy, size, 0, Math.PI * 2);
        sCtx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        sCtx.fill();

        // Algumas estrelas maiores ganham "lens flare" de cruz
        if (size > 1.2 && rng() > 0.8) {
          sCtx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.5})`;
          sCtx.fillRect(sx - size * 4, sy - size / 4, size * 8, size / 2);
          sCtx.fillRect(sx - size / 4, sy - size * 4, size / 2, size * 8);
        }
      }

      // 3. Aplica o Clipping ao Texto
      sCtx.globalCompositeOperation = 'destination-in';
      sCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(spaceCanvas, 0, 0);

      // Leve brilho cósmico ao redor do texto
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(6px)';
      ctx.globalAlpha = 0.4;
      ctx.drawImage(spaceCanvas, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  acidCorrosion: {
    name: 'Acid Corrosion',
    params: [
      { key: 'acidColor', label: 'Acid Color', type: 'color', default: '#aaff00' },
      { key: 'damage', label: 'Damage Level', type: 'range', min: 0.1, max: 0.8, step: 0.05, default: 0.4 },
      { key: 'melt', label: 'Drip Scale', type: 'range', min: 0, max: 50, step: 1, default: 15 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 7 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const acidC = hexToRgb(params.acidColor ?? '#aaff00');
      const damage = params.damage ?? 0.4;
      const melt = params.melt ?? 15;
      const seed = params.seed ?? 7;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 369;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const noiseSize = 256;
      const noise = new Float32Array(noiseSize * noiseSize);
      for (let i = 0; i < noise.length; i++) noise[i] = rng();

      const getNoise = (x, y) => {
        const ix = Math.floor(x) & 255; const iy = Math.floor(y) & 255;
        return noise[iy * 256 + ix];
      };

      const cCanvas = document.createElement('canvas');
      cCanvas.width = w; cCanvas.height = h;
      const cCtx = cCanvas.getContext('2d');

      const srcData = ctx.getImageData(0, 0, w, h).data;
      const imgData = cCtx.createImageData(w, h);
      const data = imgData.data;

      // Processamento pixel a pixel
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          // Deslocamento vertical para simular o derretimento (Drip)
          // Usamos um ruído de baixa frequência no X para criar "colunas" que derretem
          const dripNoise = getNoise(px * 0.05, 0) * melt;

          // O Y real de onde vamos ler a cor original sofre offset para cima
          // Isso faz o pixel original "descer"
          const readY = Math.max(0, Math.floor(py - dripNoise));
          const idxSrc = (readY * w + px) * 4;
          const alphaSrc = srcData[idxSrc + 3];

          if (alphaSrc > 5) {
            const idx = (py * w + px) * 4;

            // Ruído de corrosão (manchas)
            const n = getNoise(px * 0.1, py * 0.1);

            if (n < damage) {
              // Área muito danificada -> vira buraco transparente
              data[idx + 3] = 0;
            } else if (n < damage + 0.15) {
              // Borda do dano -> vira a cor do ácido
              data[idx] = acidC.r;
              data[idx + 1] = acidC.g;
              data[idx + 2] = acidC.b;
              data[idx + 3] = alphaSrc;
            } else {
              // Mantém a cor original do texto 
              // (Para simplificar, copiamos os canais RGB originais)
              data[idx] = srcData[idxSrc];
              data[idx + 1] = srcData[idxSrc + 1];
              data[idx + 2] = srcData[idxSrc + 2];
              data[idx + 3] = alphaSrc;
            }
          }
        }
      }

      cCtx.putImageData(imgData, 0, 0);

      // Suaviza as bordas ácidas
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cCanvas, 0, 0);

      return { canvas, ctx, abortSignal };
    }
  },

  stickerPeel: {
    name: 'Die-cut Sticker Peel',
    params: [
      { key: 'border', label: 'Border Size', type: 'range', min: 2, max: 50, step: 1, default: 15 },
      { key: 'peelSize', label: 'Peel Amount', type: 'range', min: 10, max: 200, step: 1, default: 60 },
      { key: 'shadow', label: 'Shadow Opacity', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const border = params.border ?? 15;
      const peel = params.peelSize ?? 60;
      const shadowAlpha = params.shadow ?? 0.5;
      const w = canvas.width, h = canvas.height;

      // 1. Criar a Borda Branca (Die-cut)
      const borderCanvas = document.createElement('canvas');
      borderCanvas.width = w; borderCanvas.height = h;
      const bCtx = borderCanvas.getContext('2d');

      bCtx.drawImage(canvas, 0, 0);
      bCtx.globalCompositeOperation = 'source-in';
      bCtx.fillStyle = '#ffffff';
      bCtx.fillRect(0, 0, w, h);

      // Expande a borda usando blur e threshold
      bCtx.globalCompositeOperation = 'source-over';
      const passes = Math.ceil(border / 5);
      for (let i = 0; i < passes; i++) {
        bCtx.filter = `blur(${border}px)`;
        bCtx.drawImage(borderCanvas, 0, 0);
      }
      bCtx.filter = 'none';

      // Endurece o blur para fazer uma borda sólida
      const bData = bCtx.getImageData(0, 0, w, h);
      for (let i = 3; i < bData.data.length; i += 4) {
        bData.data[i] = bData.data[i] > 10 ? 255 : 0;
      }
      bCtx.putImageData(bData, 0, 0);

      // 2. Mescla o texto original em cima da borda branca
      bCtx.drawImage(canvas, 0, 0);

      // 3. Encontra o canto inferior direito real do adesivo para fazer o peel
      let maxX = 0, maxY = 0;
      for (let py = 0; py < h; py += 5) {
        for (let px = 0; px < w; px += 5) {
          if (bData.data[(py * w + px) * 4 + 3] > 0) {
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
        }
      }
      if (maxX === 0) return { canvas, ctx };

      // 4. Configura a dobra (Peel)
      const peelX = maxX - peel;
      const peelY = maxY - peel;

      ctx.clearRect(0, 0, w, h);

      // Sombra global do adesivo
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 8;

      // Desenha o adesivo inteiro, MAS recorta a ponta que vai dobrar
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, peelY);
      ctx.lineTo(peelX, maxY);
      ctx.lineTo(0, maxY);
      ctx.lineTo(0, 0);
      ctx.clip();
      ctx.drawImage(borderCanvas, 0, 0);
      ctx.restore();

      // 5. Desenha a aba dobrada (Verso do adesivo)
      ctx.save();
      // O triângulo da ponta dobrada
      ctx.beginPath();
      ctx.moveTo(w, peelY);
      ctx.lineTo(peelX, maxY);
      // Ponto de dobra projetado para cima e esquerda
      ctx.lineTo(peelX - (w - peelX), peelY - (maxY - peelY));
      ctx.closePath();

      // Sombra projetada pela aba sobre o adesivo
      ctx.shadowColor = `rgba(0,0,0,${shadowAlpha + 0.3})`;
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = -5;
      ctx.shadowOffsetY = -5;

      // Preenchimento do verso (acinzentado/fosco)
      ctx.fillStyle = '#e0e0e0';
      ctx.fill();

      // Leve gradiente para dar volume à dobra
      const grad = ctx.createLinearGradient(peelX, maxY, peelX - peel, peelY - peel);
      grad.addColorStop(0, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.shadowColor = 'transparent'; // desativa sombra pro gradiente
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  gummyCandy: {
    name: 'Gummy / Subsurface',
    params: [
      { key: 'color', label: 'Flavor Color', type: 'color', default: '#ff0066' },
      { key: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 50, step: 1, default: 20 },
      { key: 'sugar', label: 'Sugar Coating', type: 'range', min: 0, max: 1, step: 0.1, default: 0.8 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const color = hexToRgb(params.color ?? '#ff0066');
      const thickness = params.thickness ?? 20;
      const sugar = params.sugar ?? 0.8;
      const w = canvas.width, h = canvas.height;

      // Mapa de Profundidade Interna (Blurred Mask)
      const depthCanvas = document.createElement('canvas');
      depthCanvas.width = w; depthCanvas.height = h;
      const dCtx = depthCanvas.getContext('2d');
      dCtx.drawImage(canvas, 0, 0);
      dCtx.globalCompositeOperation = 'source-in';
      dCtx.fillStyle = '#fff';
      dCtx.fillRect(0, 0, w, h);

      dCtx.filter = `blur(${thickness}px)`;
      dCtx.globalCompositeOperation = 'source-over';
      dCtx.drawImage(depthCanvas, 0, 0);
      dCtx.filter = 'none';

      const srcData = ctx.getImageData(0, 0, w, h).data;
      const depthData = dCtx.getImageData(0, 0, w, h).data;
      const outImg = ctx.createImageData(w, h);
      const out = outImg.data;

      const rng = () => Math.random();

      for (let i = 0; i < srcData.length; i += 4) {
        const alpha = srcData[i + 3];
        if (alpha < 5) continue;

        // Profundidade (0 = borda afiada, 255 = centro denso)
        const dVal = depthData[i + 1];
        const normalizedDepth = dVal / 255;

        // Subsurface Scattering Fake:
        // Bordas são mais claras/saturadas porque a luz atravessa mais fácil.
        // Centro é mais escuro.
        const sss = Math.pow(1 - normalizedDepth, 1.5);

        let r = color.r * (0.4 + normalizedDepth * 0.4) + (sss * 255 * 0.5);
        let g = color.g * (0.4 + normalizedDepth * 0.4) + (sss * 255 * 0.5);
        let b = color.b * (0.4 + normalizedDepth * 0.4) + (sss * 255 * 0.5);

        // Highlight direcional simples em cima à esquerda
        const isHighlight = (depthData[i - w * 4 - 4 + 1] < dVal);
        if (isHighlight) {
          r += 40; g += 40; b += 40;
        }

        // Açúcar (Cristais na superfície)
        if (sugar > 0 && rng() > 0.8) {
          const crystal = rng() * 150 * sugar;
          r += crystal; g += crystal; b += crystal;
        }

        out[i] = Math.min(255, r);
        out[i + 1] = Math.min(255, g);
        out[i + 2] = Math.min(255, b);
        out[i + 3] = alpha;
      }

      ctx.putImageData(outImg, 0, 0);

      // Sombra colorida translúcida projetada no fundo
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`;
      ctx.shadowBlur = thickness;
      ctx.shadowOffsetY = thickness / 2;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  pcbCircuit: {
    name: 'Circuit Board (PCB)',
    params: [
      { key: 'board', label: 'Board Color', type: 'color', default: '#003300' },
      { key: 'trace', label: 'Trace Color', type: 'color', default: '#ffcc00' },
      { key: 'density', label: 'Complexity', type: 'range', min: 5, max: 30, step: 1, default: 12 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 999, step: 1, default: 101 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const boardC = params.board ?? '#003300';
      const traceC = params.trace ?? '#ffcc00';
      const gridSize = params.density ?? 12;
      const seed = params.seed ?? 101;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 555;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const pcbCanvas = document.createElement('canvas');
      pcbCanvas.width = w; pcbCanvas.height = h;
      const pCtx = pcbCanvas.getContext('2d');

      // Fundo da Placa
      pCtx.fillStyle = boardC;
      pCtx.fillRect(0, 0, w, h);

      pCtx.strokeStyle = traceC;
      pCtx.fillStyle = traceC;
      pCtx.lineWidth = Math.max(1, gridSize / 4);
      pCtx.lineCap = 'round';
      pCtx.lineJoin = 'bevel'; // Dobras chanfradas clássicas de PCB

      const cols = Math.ceil(w / gridSize);
      const rows = Math.ceil(h / gridSize);

      // Gerador de trilhas
      const drawTrace = (startX, startY, length) => {
        pCtx.beginPath();
        pCtx.moveTo(startX * gridSize, startY * gridSize);

        let cx = startX, cy = startY;
        for (let i = 0; i < length; i++) {
          // Direções: 0=Dir, 1=Baixo, 2=Diag Dir-Baixo, 3=Diag Dir-Cima
          const dir = Math.floor(rng() * 4);
          if (dir === 0) cx++;
          else if (dir === 1) cy++;
          else if (dir === 2) { cx++; cy++; }
          else if (dir === 3) { cx++; cy--; }
          pCtx.lineTo(cx * gridSize, cy * gridSize);
        }
        pCtx.stroke();

        // Solda/Via no final da trilha
        if (rng() > 0.3) {
          pCtx.beginPath();
          pCtx.arc(cx * gridSize, cy * gridSize, gridSize / 2.5, 0, Math.PI * 2);
          pCtx.fill();
          // Furo da via
          pCtx.fillStyle = boardC;
          pCtx.beginPath();
          pCtx.arc(cx * gridSize, cy * gridSize, gridSize / 5, 0, Math.PI * 2);
          pCtx.fill();
          pCtx.fillStyle = traceC;
        }
      };

      // Espalha centenas de componentes e trilhas
      const traceCount = (cols * rows) / 4;
      for (let i = 0; i < traceCount; i++) {
        const sx = Math.floor(rng() * cols);
        const sy = Math.floor(rng() * rows);
        const len = 2 + Math.floor(rng() * 6);
        drawTrace(sx, sy, len);
      }

      // Máscara do circuito para o formato do texto original
      pCtx.globalCompositeOperation = 'destination-in';
      pCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(pcbCanvas, 0, 0);

      // Sombra interna e chanfro da borda da placa
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      // Truque para desenhar a borda chanfrada
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.drawImage(canvas, -2, -2);
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  origamiFold: {
    name: 'Low-Poly / Origami',
    params: [
      { key: 'color', label: 'Paper Color', type: 'color', default: '#ffaa00' },
      { key: 'complexity', label: 'Folds', type: 'range', min: 100, max: 2000, step: 50, default: 500 },
      { key: 'contrast', label: 'Shadow Contrast', type: 'range', min: 0.1, max: 1, step: 0.1, default: 0.6 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 42 }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const baseColor = hexToRgb(params.color ?? '#ffaa00');
      const ptsCount = params.complexity ?? 500;
      const contrast = params.contrast ?? 0.6;
      const seed = params.seed ?? 42;
      const w = canvas.width, h = canvas.height;

      let _s = seed * 1234;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // 1. Gera os vértices das dobras
      const points = [];
      for (let i = 0; i < ptsCount; i++) {
        points.push({
          x: rng() * w,
          y: rng() * h,
          shade: 1 - (rng() * contrast) // Modificador de luz do plano
        });
      }

      const outImg = ctx.createImageData(w, h);
      const data = outImg.data;
      const srcData = ctx.getImageData(0, 0, w, h).data;

      // 2. Renderização de Células de Voronoi (Pixel-perfect low poly fake)
      // Otimização: Escaneia o texto, acha o ponto mais próximo
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const idx = (py * w + px) * 4;
          const alpha = srcData[idx + 3];

          if (alpha > 5) {
            let minDist = Infinity;
            let bestP = points[0];

            for (let i = 0; i < ptsCount; i++) {
              const p = points[i];
              // Math.abs é mais rápido que multiplicar ao quadrado para fake distance (Manhattan)
              // mas para origami o Euclideano forma arestas mais nítidas e naturais
              const d = (px - p.x) * (px - p.x) + (py - p.y) * (py - p.y);
              if (d < minDist) {
                minDist = d;
                bestP = p;
              }
            }

            // Simula um gradiente dentro da faceta (O brilho cai do centro pro canto)
            const distGradient = 1 - (Math.sqrt(minDist) / 50);
            const facetLight = bestP.shade * (0.9 + Math.max(0, distGradient) * 0.1);

            data[idx] = Math.min(255, baseColor.r * facetLight);
            data[idx + 1] = Math.min(255, baseColor.g * facetLight);
            data[idx + 2] = Math.min(255, baseColor.b * facetLight);
            data[idx + 3] = alpha;
          }
        }
      }

      ctx.putImageData(outImg, 0, 0);

      // Adiciona uma fina linha de luz (Highlight) ao redor de todo o texto
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeText(text, x, y); // Fallback caso as arestas fiquem muito perdidas
      ctx.restore();

      return { canvas, ctx, abortSignal };
    }
  },
  voxelIso: {
    name: '3D Voxel / Isometric',
    params: [
      { key: 'size', label: 'Voxel Size', type: 'range', min: 4, max: 40, step: 2, default: 12 },
      { key: 'height', label: 'Extrude Height', type: 'range', min: 1, max: 20, step: 1, default: 4 },
      { key: 'angle', label: 'Rotation', type: 'range', min: 0, max: 360, step: 1, default: 0 },
      { key: 'colorTop', label: 'Top Color', type: 'color', default: '#00d2ff' },
      { key: 'colorLeft', label: 'Left Color', type: 'color', default: '#0088ff' },
      { key: 'colorRight', label: 'Right Color', type: 'color', default: '#0044aa' }
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const size = params.size ?? 12;
      const hExt = params.height ?? 4;
      const angleDeg = params.angle ?? 0;
      const cTop = params.colorTop ?? '#00d2ff';
      const cLeft = params.colorLeft ?? '#0088ff';
      const cRight = params.colorRight ?? '#0044aa';
      const w = canvas.width, h = canvas.height;

      // 1. Amostrar o texto numa grelha
      const gridW = Math.ceil(w / (size / 2));
      const gridH = Math.ceil(h / (size / 2));

      const sampleC = document.createElement('canvas');
      sampleC.width = gridW; sampleC.height = gridH;
      const sCtx = sampleC.getContext('2d');
      sCtx.imageSmoothingEnabled = false;
      sCtx.drawImage(canvas, 0, 0, w, h, 0, 0, gridW, gridH);
      const gridData = sCtx.getImageData(0, 0, gridW, gridH).data;

      // 2. Extrair voxels sólidos
      const voxels = [];
      for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
          if (gridData[(gy * gridW + gx) * 4 + 3] > 128) {
            voxels.push({ x: gx, y: gy });
          }
        }
      }

      if (voxels.length === 0) return { canvas, ctx };

      // Centro da grelha
      let minGx = gridW, maxGx = 0, minGy = gridH, maxGy = 0;
      voxels.forEach(v => {
        if (v.x < minGx) minGx = v.x; if (v.x > maxGx) maxGx = v.x;
        if (v.y < minGy) minGy = v.y; if (v.y > maxGy) maxGy = v.y;
      });
      const gridCenterX = (minGx + maxGx) / 2;
      const gridCenterY = (minGy + maxGy) / 2;

      // 3. Aplicar Rotação e Profundidade (Z-Sort)
      const angleRad = angleDeg * (Math.PI / 180);
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      let minIsoX = Infinity, maxIsoX = -Infinity;
      let minIsoY = Infinity, maxIsoY = -Infinity;

      voxels.forEach(v => {
        const dx = v.x - gridCenterX;
        const dy = v.y - gridCenterY;

        // Rotação na base 2D
        v.rx = dx * cosA - dy * sinA;
        v.ry = dx * sinA + dy * cosA;

        // Profundidade para o Painter's Algorithm (Trás para a Frente)
        v.depth = v.rx + v.ry;

        // Calcular limites da projeção isométrica para conseguir centralizar
        const isoX = (v.rx - v.ry) * (size / 2);
        const isoY = (v.rx + v.ry) * (size / 4);

        if (isoX < minIsoX) minIsoX = isoX;
        if (isoX > maxIsoX) maxIsoX = isoX;
        if (isoY < minIsoY) minIsoY = isoY;
        if (isoY > maxIsoY) maxIsoY = isoY;
      });

      // Ordenar voxels do mais distante para o mais próximo da câmara
      voxels.sort((a, b) => a.depth - b.depth);

      // 4. Calcular Bounding Box do Texto Original
      const origData = ctx.getImageData(0, 0, w, h).data;
      let oMinX = w, oMaxX = 0, oMinY = h, oMaxY = 0;
      for (let i = 3; i < origData.length; i += 4) {
        if (origData[i] > 10) {
          const px = (i / 4) % w, py = Math.floor((i / 4) / w);
          if (px < oMinX) oMinX = px; if (px > oMaxX) oMaxX = px;
          if (py < oMinY) oMinY = py; if (py > oMaxY) oMaxY = py;
        }
      }

      // 5. Calcular Offset de Desenho Perfeito
      const textCenterX = (oMinX + oMaxX) / 2;
      const textCenterY = (oMinY + oMaxY) / 2;
      const drawnIsoCX = (minIsoX + maxIsoX) / 2;
      const drawnIsoCY = (minIsoY + maxIsoY) / 2;

      const drawOffX = textCenterX - drawnIsoCX;
      const drawOffY = textCenterY - drawnIsoCY + (hExt * (size / 4) / 2);

      // 6. Renderizar
      const isoCanvas = document.createElement('canvas');
      isoCanvas.width = w; isoCanvas.height = h;
      const iCtx = isoCanvas.getContext('2d');
      iCtx.lineJoin = 'round';

      const drawCube = (cx, cy) => {
        const half = size / 2, quarter = size / 4;
        const totalHeight = half + (hExt * quarter);

        // Face Esquerda
        iCtx.fillStyle = cLeft;
        iCtx.beginPath(); iCtx.moveTo(cx, cy); iCtx.lineTo(cx - half, cy - quarter); iCtx.lineTo(cx - half, cy - quarter - totalHeight); iCtx.lineTo(cx, cy - totalHeight); iCtx.fill();

        // Face Direita
        iCtx.fillStyle = cRight;
        iCtx.beginPath(); iCtx.moveTo(cx, cy); iCtx.lineTo(cx + half, cy - quarter); iCtx.lineTo(cx + half, cy - quarter - totalHeight); iCtx.lineTo(cx, cy - totalHeight); iCtx.fill();

        // Face Topo
        iCtx.fillStyle = cTop;
        iCtx.beginPath(); iCtx.moveTo(cx, cy - totalHeight); iCtx.lineTo(cx - half, cy - quarter - totalHeight); iCtx.lineTo(cx, cy - half - totalHeight); iCtx.lineTo(cx + half, cy - quarter - totalHeight); iCtx.fill();
      };

      // Desenhar na ordem correta
      voxels.forEach(v => {
        const isoX = drawOffX + (v.rx - v.ry) * (size / 2);
        const isoY = drawOffY + (v.rx + v.ry) * (size / 4);
        drawCube(isoX, isoY);
      });

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(isoCanvas, 0, 0);
      return { canvas, ctx, abortSignal };
    }
  },
  liquidMercury: {
    name: 'Liquid Melt / Mercury',
    params: [
      { key: 'melt', label: 'Melt / Merge', type: 'range', min: 2, max: 40, step: 1, default: 12 },
      { key: 'shininess', label: 'Reflection', type: 'range', min: 1, max: 10, step: 0.1, default: 6 },
    ],
    apply: (ctx, canvas, text, x, y, params, abortSignal) => {
      const melt = params.melt ?? 12;
      const shininess = params.shininess ?? 6;
      const w = canvas.width, h = canvas.height;

      // 1. Criar o blob colorido (Mistura as cores do texto como tinta)
      const colorBlob = document.createElement('canvas');
      colorBlob.width = w; colorBlob.height = h;
      const cbCtx = colorBlob.getContext('2d');
      cbCtx.filter = `blur(${melt}px)`;
      cbCtx.drawImage(canvas, 0, 0);
      cbCtx.filter = 'none';

      const colorData = cbCtx.getImageData(0, 0, w, h);
      const cd = colorData.data;

      // Endurecer as bordas (Threshold) mas MANTER a cor fundida no RGB
      for (let i = 0; i < cd.length; i += 4) {
        cd[i + 3] = cd[i + 3] < 120 ? 0 : 255;
      }
      cbCtx.putImageData(colorData, 0, 0);

      // 2. Criar o mapa de alturas para as sombras/brilho
      const heightBlob = document.createElement('canvas');
      heightBlob.width = w; heightBlob.height = h;
      const hCtx = heightBlob.getContext('2d');

      // Extrair apenas a silhueta branca a partir do blob endurecido
      hCtx.drawImage(colorBlob, 0, 0);
      hCtx.globalCompositeOperation = 'source-in';
      hCtx.fillStyle = '#fff';
      hCtx.fillRect(0, 0, w, h);
      hCtx.globalCompositeOperation = 'source-over';

      // Borrar para criar o domo/declive 3D
      hCtx.filter = `blur(${melt / 1.5}px)`;
      hCtx.drawImage(heightBlob, 0, 0);
      hCtx.filter = 'none';

      const heightData = hCtx.getImageData(0, 0, w, h).data;
      const outImg = ctx.createImageData(w, h);
      const out = outImg.data;

      // Luz vindo de cima/esquerda
      const Lx = -0.5, Ly = -0.7, Lz = 0.8;
      const lLen = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
      const LnX = Lx / lLen, LnY = Ly / lLen, LnZ = Lz / lLen;

      for (let py = 1; py < h - 1; py++) {
        const rowOffset = py * w;
        for (let px = 1; px < w - 1; px++) {
          const idx = (rowOffset + px) * 4;

          if (cd[idx + 3] === 0) continue; // Pula transparente

          // Mapa de Normais 3D
          const hL = heightData[(rowOffset + px - 1) * 4];
          const hR = heightData[(rowOffset + px + 1) * 4];
          const hT = heightData[((py - 1) * w + px) * 4];
          const hB = heightData[((py + 1) * w + px) * 4];

          const nx = (hL - hR);
          const ny = (hT - hB);
          const nz = 600 / melt;

          const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const Nnx = nx / len, Nny = ny / len, Nnz = nz / len;

          let r, g, b;

          // Se usa a cor original, a base vem do colorBlob endurecido
          r = cd[idx]; g = cd[idx + 1]; b = cd[idx + 2];

          // Iluminação simples por cima para dar profundidade (Ambient + Diffuse)
          const light = 0.4 + Math.max(0, Nnx * LnX + Nny * LnY + Nnz * LnZ) * 0.6;
          r *= light; g *= light; b *= light;

          // Efeito Molhado: Specular Point (Luz refletida dura)
          let diffuse = Math.max(0, Nnx * LnX + Nny * LnY + Nnz * LnZ);
          let spec = Math.pow(diffuse, shininess * 5);

          // Borda sombreada (Fresnel/Tensão Superficial)
          const fresnel = 1 - Math.abs(Nnz);
          r *= (1 - fresnel * 0.4);
          g *= (1 - fresnel * 0.4);
          b *= (1 - fresnel * 0.4);

          // Soma o especular no fim
          out[idx] = Math.min(255, r + spec * 255);
          out[idx + 1] = Math.min(255, g + spec * 255);
          out[idx + 2] = Math.min(255, b + spec * 255);
          out[idx + 3] = 255;
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.putImageData(outImg, 0, 0);

      return { canvas, ctx, abortSignal };
    }
  }
}

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