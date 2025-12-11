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