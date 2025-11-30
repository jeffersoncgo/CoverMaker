// Effect Registry - All available effect types and their params
// Use this to populate the select and to render the effect subgroups

const EFFECTS_REGISTRY = {
  blur: {
    name: 'Blur',
    params: [
      // Expanded blur range for more intense effect where desired
      { key: 'amount', label: 'Blur Amount', type: 'range', min: 0, max: 100, step: 1, default: 5 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `blur(${params.amount ?? 0}px)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx}
    }
  },
  grayscale: {
    name: 'Grayscale',
    params: [
      { key: 'amount', label: 'Grayscale', type: 'range', min: 0, max: 1, step: 0.05, default: 1 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `grayscale(${params.amount ?? 0})`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx}
    }
  },
  invert: {
    name: 'Invert',
    params: [
      { key: 'amount', label: 'Invert', type: 'range', min: 0, max: 1, step: 0.05, default: 1 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `invert(${params.amount ?? 0})`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  brightness: {
    name: 'Brightness',
    params: [
      // Expanded brightness range for stronger adjustments
      { key: 'amount', label: 'Brightness', type: 'range', min: 0, max: 4, step: 0.1, default: 1 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `brightness(${params.amount ?? 1})`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  contrast: {
    name: 'Contrast',
    params: [
      { key: 'amount', label: 'Contrast', type: 'range', min: 0, max: 3, step: 0.05, default: 1 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `contrast(${params.amount ?? 1})`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  saturate: {
    name: 'Saturate',
    params: [
      { key: 'amount', label: 'Saturate', type: 'range', min: 0, max: 3, step: 0.05, default: 1 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `saturate(${params.amount ?? 1})`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  sepia: {
    name: 'Sepia',
    params: [
      { key: 'amount', label: 'Sepia', type: 'range', min: 0, max: 1, step: 0.05, default: 0 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `sepia(${params.amount ?? 0})`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  hueRotate: {
    name: 'Hue Rotate',
    params: [
      { key: 'angle', label: 'Hue Angle', type: 'range', min: 0, max: 360, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, params) => {
      ctx.save();
      ctx.filter = `hue-rotate(${params.angle ?? 0}deg)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  vignette: {
    name: 'Vignette',
    params: [
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 }
    ],
    apply: (ctx, canvas, params) => {
      const { intensity = 0.5 } = params;
      // Draw vignette on top using radial gradient
      const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.8);
      grad.addColorStop(0, `rgba(0,0,0,0)`);
      grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, Math.max(0, intensity))})`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  overlay: {
    name: 'Overlay',
    params: [
      { key: 'startColor', label: 'Color', type: 'color', default: '#000000', group: 'Start' },
      { key: 'startOpacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5, group: 'Start' },
      { key: 'endColor', label: 'Color', type: 'color', default: '#000000', group: 'End' },
      { key: 'endOpacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9, group: 'End' }
    ],
    apply: (ctx, canvas, params) => {
      const startColor = params.startColor ?? '#000000';
      const endColor = params.endColor ?? '#000000';
      const startOpacity = parseFloat(params.startOpacity ?? 0.5);
      const endOpacity = parseFloat(params.endOpacity ?? 0.9);
      const startRGB = hexToRgb(startColor);
      const endRGB = hexToRgb(endColor);
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, `rgba(${startRGB.r}, ${startRGB.g}, ${startRGB.b}, ${startOpacity})`);
      gradient.addColorStop(1, `rgba(${endRGB.r}, ${endRGB.g}, ${endRGB.b}, ${endOpacity})`);
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  scale: {
    name: 'Scale',
    params: [
      { key: 'scaleX', label: 'Scale X', type: 'range', min: 0.01, max: 2, step: 0.01, default: 0.95 },
      { key: 'scaleY', label: 'Scale Y', type: 'range', min: 0.01, max: 2, step: 0.01, default: 0.95 },
      { key: 'offsetX', label: 'Offset X', type: 'range', min: -2000, max: 2000, step: 1, default: 0 },
      { key: 'offsetY', label: 'Offset Y', type: 'range', min: -2000, max: 2000, step: 1, default: 0 },
      { key: 'backgroundColor', label: 'Background Color', type: 'color', default: '#000000', group: 'Background' },
      { key: 'backgroundOpacity', label: 'Background Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 1, group: 'Background' }
    ],
    apply: (ctx, canvas, params) => {
      const fullW = canvas.width;
      const fullH = canvas.height;
      const scaleX = Math.max(0.01, Math.min(2, parseFloat(params.scaleX ?? 0.95)));
      const scaleY = Math.max(0.01, Math.min(2, parseFloat(params.scaleY ?? 0.95)));
      const offsetX = params.offsetX ?? 0;
      const offsetY = params.offsetY ?? 0;
      const bgColor = params.backgroundColor ?? '#000000';
      const bgOpacity = parseFloat(params.backgroundOpacity ?? 0);

      // Create a temporary canvas holding the current content
      const temp = document.createElement('canvas');
      temp.width = fullW;
      temp.height = fullH;
      const tctx = temp.getContext('2d');
      tctx.drawImage(canvas, 0, 0);

      // Destination size
      const dw = Math.round(fullW * scaleX);
      const dh = Math.round(fullH * scaleY);

      // Destination position (centered plus optional offsets)
      const dx = Math.round((fullW - dw) / 2 + offsetX);
      const dy = Math.round((fullH - dh) / 2 + offsetY);

      ctx.save();
      // Optionally paint background first
      if (bgOpacity > 0) {
        ctx.fillStyle = `rgba(${hexToRgb(bgColor).r}, ${hexToRgb(bgColor).g}, ${hexToRgb(bgColor).b}, ${Math.max(0, Math.min(1, bgOpacity))})`;
        ctx.fillRect(0, 0, fullW, fullH);
      } else {
        // Clear existing content to avoid layering (keep alpha) before drawing scaled content
        ctx.clearRect(0, 0, fullW, fullH);
      }

      // Use smoothing for better visual result when scaling down
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(temp, 0, 0, temp.width, temp.height, dx, dy, dw, dh);
      ctx.restore();
      return { canvas, ctx }
    }
  },
  sharpen: {
    name: 'Sharpen',
    params: [
      { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 2, step: 0.01, default: 1 }
    ],
    apply: (ctx, canvas, params) => {
      // Convolution sharpen kernel, scaled by amount
      const amount = params.amount ?? 1;
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const copy = new Uint8ClampedArray(data);

      // Base sharpen kernel
      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

      // Blends kernel effect with original based on amount
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let r = 0, g = 0, b = 0;
          let k = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ix = x + kx;
              const iy = y + ky;
              const idx = (iy * w + ix) * 4;
              const kval = kernel[k++] || 0;
              r += copy[idx + 0] * kval;
              g += copy[idx + 1] * kval;
              b += copy[idx + 2] * kval;
            }
          }
          const idx = (y * w + x) * 4;
          // Mix original and sharpened based on amount
          data[idx + 0] = Math.max(0, Math.min(255, (copy[idx + 0] * (1 - amount)) + (r * amount)));
          data[idx + 1] = Math.max(0, Math.min(255, (copy[idx + 1] * (1 - amount)) + (g * amount)));
          data[idx + 2] = Math.max(0, Math.min(255, (copy[idx + 2] * (1 - amount)) + (b * amount)));
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return { canvas, ctx }
    }
  },
  reflection: {
    name: 'Reflection',
    params: [
      // GEOMETRY / PERSPECTIVE
      { key: 'scaleY', label: 'Scale', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.75, group: 'Perspective' },
      { key: 'skewX', label: 'Skew X', type: 'range', min: -2, max: 2, step: 0.01, default: 0, group: 'Perspective' },

      // POSITIONING
      { key: 'trim', label: 'Trim Bottom', type: 'range', min: 0, max: 0.5, step: 0.001, default: 0 },
      { key: 'size', label: 'Size', type: 'range', min: 0.05, max: 1, step: 0.01, default: 0.5 },

      // OFFSETS
      { key: 'offsetX', label: 'Offset X', type: 'range', min: -2000, max: 2000, step: 1, default: 0 },
      { key: 'offset', label: 'Offset Y', type: 'range', min: -2000, max: 2000, step: 1, default: -327 },

      // STYLE
      { key: 'opacity', label: 'Start Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'blur', label: 'Blur', type: 'range', min: 0, max: 20, step: 1, default: 2 },
      { key: 'fadeStart', label: 'Fade Start', type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
      { key: 'fadeEnd', label: 'Fade End', type: 'range', min: 0, max: 1, step: 0.01, default: 1 },
    ],

    apply: (ctx, canvas, params) => {
      // 1. Get Parameters
      const fullW = canvas.width;
      const fullH = canvas.height;

      const trimRatio = params.trim ?? 0;
      const sizeRatio = params.size ?? 0.5;

      const offsetY = params.offset ?? -327;
      const offsetX = params.offsetX ?? 0;

      const opacity = params.opacity ?? 0.5;
      const blur = params.blur ?? 2;
      const fadeStart = params.fadeStart ?? 0;
      const fadeEnd = params.fadeEnd ?? 1;

      const scaleY = params.scaleY ?? 0.75;
      const skewX = params.skewX ?? 0;

      // 2. Calculate Geometry
      const reflectionH = Math.round(fullH * sizeRatio);
      const trimPixels = Math.round(fullH * trimRatio);

      // --- NEW LOGIC: Calculate Skew Bounding Box ---
      // How many pixels will the bottom shift horizontally?
      // (Height * Skew Factor) gives the displacement.
      const skewDisplacement = reflectionH * (skewX * 2);

      // We need extra canvas width to hold this displacement
      const extraWidth = Math.abs(skewDisplacement);

      // If we skew Left (negative), we need to start drawing further to the Right
      // to prevent pixels from falling into x < 0.
      const originShiftX = skewX < 0 ? extraWidth : 0;
      // ---------------------------------------------

      const sourceHeightNeeded = reflectionH / scaleY;
      let sy = (fullH - trimPixels) - sourceHeightNeeded;
      let sh = sourceHeightNeeded;
      let dyAdjustment = 0;

      if (sy < 0) {
        const overflow = Math.abs(sy);
        dyAdjustment = overflow * scaleY;
        sh = sh + sy;
        sy = 0;
      }

      if (reflectionH <= 0 || sh <= 0) return;

      // 3. Create the "Stamp" (Now Wider!)
      const temp = document.createElement('canvas');
      temp.width = fullW + extraWidth; // EXPANDED WIDTH
      temp.height = reflectionH;
      const tctx = temp.getContext('2d');

      // 4. Draw Distorted Reflection
      tctx.save();

      // Shift the Origin so the skewed image sits safely inside our expanded canvas
      tctx.translate(originShiftX, 0);

      // Apply Transforms
      tctx.translate(0, reflectionH);
      tctx.scale(1, -1);
      tctx.scale(1, scaleY);
      tctx.transform(1, 0, skewX, 1, 0, 0);

      tctx.drawImage(
        canvas,
        0, sy, fullW, sh,
        0, dyAdjustment, fullW, sh
      );
      tctx.restore();

      // 5. Apply Gradient Mask
      tctx.save();
      tctx.globalCompositeOperation = 'destination-in';
      const grad = tctx.createLinearGradient(0, 0, 0, reflectionH);

      grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
      if (fadeStart > 0) grad.addColorStop(Math.min(1, fadeStart), `rgba(0,0,0,${opacity})`);
      grad.addColorStop(Math.min(1, Math.max(fadeStart, fadeEnd)), `rgba(0,0,0,0)`);

      tctx.fillStyle = grad;
      // Fill the ENTIRE new width
      tctx.fillRect(0, 0, temp.width, reflectionH);
      tctx.restore();

      // 6. Final Draw to Main Canvas
      ctx.save();
      if (blur > 0) ctx.filter = `blur(${blur}px)`;

      // We must SUBTRACT the originShiftX from the destination X.
      // Why? If we skewed left, we shifted the image +100px inside the temp canvas to save it.
      // To align it back with the original image, we draw the temp canvas at -100px.
      ctx.drawImage(temp, offsetX - originShiftX, fullH + offsetY);

      ctx.restore();
      return { canvas, ctx };
    }
  },
  flip: {
    name: 'Flip',
    params: [
      { key: 'horizontal', label: 'Horizontal', type: 'checkbox', default: true },
      { key: 'vertical', label: 'Vertical', type: 'checkbox', default: false }
    ],
    apply: (ctx, canvas, params) => {
      const horizontal = params.horizontal ?? true;
      const vertical = params.vertical ?? false;
      ctx.save();
      ctx.translate(horizontal ? canvas.width : 0, vertical ? canvas.height : 0);
      ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      return { canvas, ctx };
    }
  },
  // 1. Pixelate Filter
  pixelate: {
    name: 'Pixelate',
    params: [
      { key: 'pixelSize', label: 'Size', type: 'range', min: 1, max: 64, step: 1, default: 8 }
    ],
    apply: (ctx, canvas, params) => {
      const psize = Math.max(1, Math.round(params.pixelSize ?? 8));
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      // Calculate scaled dimensions (Downscaling)
      const sw = Math.ceil(w / psize);
      const sh = Math.ceil(h / psize);

      // Create a small buffer
      const tmp = document.createElement('canvas');
      tmp.width = sw;
      tmp.height = sh;
      const tctx = tmp.getContext('2d');

      // Draw source to small buffer (Pixelation happens here)
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sw, sh);

      // Draw small buffer back to main context (Upscaling)
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0, sw, sh, 0, 0, w, h);
      ctx.restore();
      return { canvas, ctx };
    }
  },

  // 2. Scanlines Filter
  scanLines: {
    name: 'Scanlines',
    params: [
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.2 },
      { key: 'density', label: 'Density', type: 'range', min: 1, max: 10, step: 1, default: 8 }
    ],
    apply: (ctx, canvas, params) => {
      // Ensure clamp exists or use Math fallback
      const val = params.opacity ?? 0.2;
      const opacity = Math.min(Math.max(val, 0), 1);

      // Invert density logic: 
      // Higher density input (e.g. 10) -> Smaller spacing (e.g. 2) -> More lines
      const rawDensity = Math.max(1, Math.round(params.density ?? 8));
      const spacing = Math.max(2, 12 - rawDensity);

      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      if (opacity <= 0) return;

      ctx.save();
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

function getAvailableEffects() {
  // get then sorted list of effect IDs and names
  return Object.entries(EFFECTS_REGISTRY)
    .map(([id, def]) => ({ id, name: def.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
