const COMPOSITE_REGISTRY = {
  line: {
    name: 'Line',
    params: [
      { key: 'enableReflection', label: 'Use Reflection', type: 'checkbox', default: true, className: 'optioncheckbox' },
      { key: 'baseScale', label: 'Scale', type: 'range', min: 0.1, max: 2, step: 0.05, default: 1.35 },
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 100, step: 1, default: 3 },
      { key: 'salt', label: 'Skew Angle', type: 'range', min: 0, max: 720, step: 0.1, default: 0 },
      { key: 'reflectionDistance', label: 'Refl. Distance', type: 'range', min: 0, max: 1, step: 0.01, default: 0.68 },
      { key: 'reflectionScale', label: 'Refl. Fade', type: 'range', min: 0, max: 1, step: 0.01, default: 0.87 },
      { key: 'blurAmount', label: 'Blur Amount', type: 'range', min: 0, max: 100, step: 0.1, default: 3.5 },
      { key: 'startColor', label: 'Fade Color 1', type: 'color', default: '#000000', group: 'Overlay_Start' },
      { key: 'endColor', label: 'Fade Color 2', type: 'color', default: '#000000', group: 'Overlay_End' },
      { key: 'startOpacity', label: 'Fade Opacity 1', type: 'range', min: 0, max: 1, step: 0.01, default: 0.1, group: 'Overlay_Start' },
      { key: 'endOpacity', label: 'Fade Opacity 2', type: 'range', min: 0, max: 1, step: 0.01, default: 1, group: 'Overlay_End' },
    ],
    apply: (ctx, canvas, images, params) => {
      if (!images.length) return;

      const spacing = params.spacing ?? 0;
      const baseScale = params.baseScale ?? 1;
      const reflectionDistance = params.reflectionDistance ?? 0.5;
      const reflectionScale = params.reflectionScale ?? 1;
      const enableReflection = params.enableReflection ?? true;
      const blurAmount = params.blurAmount ?? 5;

      // Skew
      const skewDegrees = -(((params.salt ?? 340) % 720) - 360);
      const skewAngle = Math.tan((skewDegrees * Math.PI) / 180);

      // Geometry
      const slotTotalHeight = canvas.height / (enableReflection ? 2 : 1);
      const realHeight = slotTotalHeight * baseScale;
      const reflectionHeight = slotTotalHeight * reflectionDistance;
      const totalVisualHeight = realHeight + reflectionHeight;
      const skewOffset = Math.abs(totalVisualHeight * skewAngle);

      const effectiveCanvasWidth = canvas.width + skewOffset * 2;
      const slotWidth = effectiveCanvasWidth / images.length;
      const targetRatio = slotWidth / realHeight;

      // Colors
      const _cS = hexToRgb(params.startColor ?? "#000000");
      const _cE = hexToRgb(params.endColor ?? "#000000");
      const startColor = `rgba(${_cS.r}, ${_cS.g}, ${_cS.b}, ${params.startOpacity ?? 0.4})`;
      const endColor = `rgba(${_cE.r}, ${_cE.g}, ${_cE.b}, ${params.endOpacity ?? 0.9})`;

      const startOffset = -skewOffset;

      images.forEach((img, i) => {
        if (!img) return;

        // --- compute crop ---
        let sx, sy, sWidth, sHeight;
        const imgRatio = img.width / img.height;

        if (imgRatio > targetRatio) {
          sHeight = img.height;
          sWidth = sHeight * targetRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = sWidth / targetRatio;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        sWidth -= spacing * 2;
        sHeight -= spacing * 2;

        const dx = startOffset + i * (slotWidth + spacing) - spacing;

        // ============================================
        // 1. DRAW ORIGINAL IMAGE
        // ============================================
        ctx.save();
        ctx.transform(1, 0, skewAngle, 1, dx, 0);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, slotWidth, realHeight);
        ctx.restore();

        if (!enableReflection) return;

        // ============================================
        // 2. REFLECTION (per-image)
        // ============================================
        const blurredImg = blurImage(img, blurAmount);

        ctx.save();
        ctx.transform(1, 0, skewAngle, 1, dx, 0);

        // --- clip only this image's reflection slot ---
        ctx.beginPath();
        ctx.rect(0, realHeight, slotWidth, reflectionHeight);
        ctx.clip();

        // flip vertically inside this clipped slot
        ctx.translate(0, realHeight * 2);
        ctx.scale(1, -1);

        ctx.drawImage(
          blurredImg,
          sx, sy, sWidth, sHeight,
          0,
          realHeight - reflectionHeight,
          slotWidth,
          reflectionHeight
        );

        ctx.restore();

        // ============================================
        // 3. APPLY GRADIENT FADE
        // ============================================
        ctx.save();
        ctx.transform(1, 0, skewAngle, 1, dx, 0);

        const grad = ctx.createLinearGradient(0, realHeight, 0, realHeight + reflectionHeight);
        grad.addColorStop(0, startColor);
        grad.addColorStop(reflectionScale, endColor);

        ctx.fillStyle = grad;
        ctx.fillRect(0, realHeight, slotWidth, reflectionHeight);

        ctx.restore();
      });

      return { ctx, canvas, images, params }
    }
  },

  grid: {
    name: 'Simple Grid',
    params: [
      { key: 'baseScale', label: 'Scale', type: 'range', min: 0.1, max: 1.5, step: 0.05, default: 1 },
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 50, step: 1, default: 5 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;

      const spacing = params.spacing ?? 5;
      const baseScale = params.baseScale ?? 1;
      const aspectRatio = canvas.width / canvas.height;

      const idealCols = aspectRatio > 1 ? Math.ceil(Math.sqrt(N * aspectRatio)) : Math.ceil(Math.sqrt(N / aspectRatio));
      const idealRows = Math.ceil(N / idealCols);

      const rows = [];
      let remaining = N;
      for (let r = 0; r < idealRows; r++) {
        const remainingRows = idealRows - r;
        const colsInRow = Math.ceil(remaining / remainingRows);
        rows.push(colsInRow);
        remaining -= colsInRow;
      }

      const totalSpacingY = spacing * (rows.length - 1);
      const rowHeight = (canvas.height - totalSpacingY) / rows.length;

      let imgIndex = 0;
      let dy = 0;

      for (let r = 0; r < rows.length; r++) {
        const cols = rows[r];
        const totalSpacingX = spacing * (cols - 1);
        const cellWidth = (canvas.width - totalSpacingX) / cols;
        const realHeight = rowHeight * baseScale;

        for (let c = 0; c < cols && imgIndex < N; c++, imgIndex++) {
          const img = images[imgIndex];
          if (!img) continue;

          const dx = c * (cellWidth + spacing);
          const targetRatio = cellWidth / realHeight;
          const imgRatio = img.width / img.height;

          let sx, sy, sWidth, sHeight;
          if (imgRatio > targetRatio) {
            sHeight = img.height;
            sWidth = sHeight * targetRatio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
          } else {
            sWidth = img.width;
            sHeight = sWidth / targetRatio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
          }
          ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, cellWidth, realHeight);
        }
        dy += rowHeight + spacing;
      }
      return { ctx, canvas, images, params }
    }
  },

  mosaic: {
    name: 'Smart Mosaic',
    params: [
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 20, step: 1, default: 3 },
      { key: 'salt', label: 'Variation', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;

      const spacing = params.spacing ?? 3;
      const salt = params.salt ?? 1;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (N === 1) {
        // Fallback for 1 image (Standard logic duplicated for safety)
        const img = images[0];
        if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return;
      }

      const seededRandom = (index, channel = 0) => {
        const seed = (index + 1) * (salt + 1) * (channel * 17.3 + 1);
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
      };

      let regions = [{ x: 0, y: 0, w: canvas.width, h: canvas.height, filled: false }];

      for (let i = 0; i < N - 1; i++) {
        let largestIdx = -1;
        let maxArea = 0;
        regions.forEach((region, idx) => {
          if (!region.filled) {
            const area = region.w * region.h;
            if (area > maxArea) { maxArea = area; largestIdx = idx; }
          }
        });
        if (largestIdx === -1) break;
        const target = regions[largestIdx];
        const rndDir = seededRandom(i, 50);
        const rndRatio = seededRandom(i, 51);
        const splitRatio = 0.30 + (rndRatio * 0.40);

        let splitVertical;
        if (target.w > target.h * 1.5) splitVertical = true;
        else if (target.h > target.w * 1.5) splitVertical = false;
        else splitVertical = rndDir > 0.5;

        let r1, r2;
        if (splitVertical) {
          const splitW = target.w * splitRatio;
          r1 = { x: target.x, y: target.y, w: splitW, h: target.h, filled: false };
          r2 = { x: target.x + splitW, y: target.y, w: target.w - splitW, h: target.h, filled: false };
        } else {
          const splitH = target.h * splitRatio;
          r1 = { x: target.x, y: target.y, w: target.w, h: splitH, filled: false };
          r2 = { x: target.x, y: target.y + splitH, w: target.w, h: target.h - splitH, filled: false };
        }
        regions.splice(largestIdx, 1, r1, r2);
      }

      regions.sort((a, b) => {
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) > 10) return yDiff;
        return a.x - b.x;
      });

      regions.forEach((region, idx) => {
        const img = images[idx];
        if (!img) return;

        const x = region.x + spacing;
        const y = region.y + spacing;
        const w = region.w - spacing * 2;
        const h = region.h - spacing * 2;

        if (w <= 0 || h <= 0) return;

        const rotationSeed = (region.x + region.y + region.w + region.h) * salt;
        const rotationRand = Math.sin(rotationSeed * 12.9898) * 43758.5453;
        const rotation = ((rotationRand - Math.floor(rotationRand)) - 0.5) * 0.08;

        ctx.save();
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;

        const borderW = Math.max(2, Math.min(w, h) * 0.012);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-w / 2 - borderW, -h / 2 - borderW, w + borderW * 2, h + borderW * 2);

        ctx.shadowColor = 'transparent';
        const imgRatio = img.width / img.height;
        const regionRatio = w / h;
        let sx, sy, sWidth, sHeight;

        if (imgRatio > regionRatio) {
          sHeight = img.height;
          sWidth = sHeight * regionRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = sWidth / regionRatio;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, -w / 2, -h / 2, w, h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      });
      return { ctx, canvas, images, params }
    }
  },

  circle: {
    name: 'Pie',
    params: [
      { key: 'salt', label: 'Rotation Offset', type: 'range', min: 0, max: 360, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height);
      const salt = params.salt ?? 0;
      const normalizedSalt = (salt % 360) / 360;

      if (N === 1) {
        // Logic for single circle
        const img = images[0];
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.clip();
          // Draw image centered logic...
          const imgRatio = img.width / img.height;
          let sx, sy, sWidth, sHeight;
          if (imgRatio > 1) { sHeight = img.height; sWidth = sHeight; sx = (img.width - sWidth) / 2; sy = 0; }
          else { sWidth = img.width; sHeight = sWidth; sx = 0; sy = (img.height - sHeight) / 2; }
          ctx.drawImage(img, sx, sy, sWidth, sHeight, centerX - radius, centerY - radius, radius * 2, radius * 2);
          ctx.restore();
        }
        return;
      }

      const angleStep = (Math.PI * 2) / N;

      images.forEach((img, i) => {
        if (!img) return;
        const startAngle = angleStep * i + (normalizedSalt * Math.PI * 2);
        const endAngle = angleStep * (i + 1) + (normalizedSalt * Math.PI * 2);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.clip();

        const sliceCenterAngle = startAngle + angleStep / 2;
        const sliceWidth = radius * 2;
        const sliceHeight = radius * 2;
        const x = centerX + Math.cos(sliceCenterAngle) * radius * 0.3 - sliceWidth / 2;
        const y = centerY + Math.sin(sliceCenterAngle) * radius * 0.3 - sliceHeight / 2;

        const imgRatio = img.width / img.height;
        let sx, sy, sWidth, sHeight;
        if (imgRatio > 1) { sHeight = img.height; sWidth = sHeight; sx = (img.width - sWidth) / 2; sy = 0; }
        else { sWidth = img.width; sHeight = sWidth; sx = 0; sy = (img.height - sHeight) / 2; }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, sliceWidth, sliceHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      });
      return { ctx, canvas, images, params }
    }
  },

  carousel: {
    name: '3D Carousel',
    params: [
      { key: 'salt', label: 'Rotation', type: 'range', min: 0, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const salt = params.salt ?? 1;

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Background logic (omitted for brevity, assume draw background image 0)
      const bgImg = images[0];
      if (bgImg) {
        // ... (standard cover fit logic)
        const r = bgImg.width / bgImg.height;
        const cr = canvas.width / canvas.height;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (N === 1) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radiusX = canvas.width * 0.45;
      const radiusY = canvas.height * 0.15;
      const baseWidth = canvas.width * 0.28;
      const baseHeight = canvas.height * 0.50;
      const rotationOffset = (salt * 0.3) % (Math.PI * 2);

      const carouselImages = images.slice(1);
      const carouselCount = carouselImages.length;
      if (!carouselCount) return;

      const carouselItems = carouselImages.map((img, i) => {
        const angle = (i / carouselCount) * Math.PI * 2 + rotationOffset;
        const x = centerX + Math.cos(angle) * radiusX;
        const y = centerY + Math.sin(angle) * radiusY;
        const z = Math.cos(angle);
        const depthScale = 0.5 + (z + 1) * 0.35;
        return {
          img, x, y, z,
          width: baseWidth * depthScale,
          height: baseHeight * depthScale,
          opacity: Math.min(1, 0.4 + (z + 1) * 0.35),
          angle
        };
      }).filter(item => item.img);

      carouselItems.sort((a, b) => a.z - b.z);

      carouselItems.forEach(({ img, x, y, z, width, height, opacity, angle }) => {
        if(!img) return;
        ctx.save();
        ctx.globalAlpha = opacity;
        if (z > 0) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 15 * (z + 1);
          ctx.shadowOffsetY = 5 * (z + 1);
        }
        ctx.translate(x, y);
        ctx.rotate(Math.sin(angle) * 0.1);

        const borderW = Math.max(3, width * 0.02);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-width / 2 - borderW, -height / 2 - borderW, width + borderW * 2, height + borderW * 2);

        ctx.shadowColor = 'transparent';
        const ir = img.width / img.height;
        const tr = width / height;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.restore();
      });
      return { ctx, canvas, images, params }
    }
  },

  mondrian: {
    name: 'Mondrian Grid',
    params: [
      { key: 'salt', label: 'Layout Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 },
      { key: 'spacingColor', label: 'Border Color', type: 'color', default: '#ffffff' }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const spacingColor = params.spacingColor ?? '#ffffff';
      const spacing = Math.max(cw, ch) * 0.015;
      const salt = Math.abs(params.salt ?? 1) % 100000;

      const getRandom = (seed) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };

      let blocks = [{ x: 0, y: 0, w: cw, h: ch }];

      for (let i = 0; i < N - 1; i++) {
        let largestIdx = 0;
        let maxArea = 0;
        blocks.forEach((block, index) => {
          const area = block.w * block.h;
          if (area > maxArea) { maxArea = area; largestIdx = index; }
        });

        const target = blocks[largestIdx];
        const rndDir = getRandom((i + 1) * (salt + 1));
        const rndRatio = getRandom((i + 1) * (salt + 1) * 13.37);
        const splitRatio = 0.3 + (rndRatio * 0.4);

        let splitVertical = rndDir > 0.5;
        if (target.w > target.h * 1.5) splitVertical = true;
        else if (target.h > target.w * 1.5) splitVertical = false;

        let b1, b2;
        if (splitVertical) {
          const splitW = target.w * splitRatio;
          b1 = { x: target.x, y: target.y, w: splitW, h: target.h };
          b2 = { x: target.x + splitW, y: target.y, w: target.w - splitW, h: target.h };
        } else {
          const splitH = target.h * splitRatio;
          b1 = { x: target.x, y: target.y, w: target.w, h: splitH };
          b2 = { x: target.x, y: target.y + splitH, w: target.w, h: target.h - splitH };
        }
        blocks.splice(largestIdx, 1, b1, b2);
      }

      ctx.fillStyle = spacingColor;
      ctx.fillRect(0, 0, cw, ch);

      const imageIndices = Array.from({ length: N }, (_, i) => i);
      for (let i = imageIndices.length - 1; i > 0; i--) {
        const r = getRandom(i * salt * 55.5);
        const j = Math.floor(r * (i + 1));
        [imageIndices[i], imageIndices[j]] = [imageIndices[j], imageIndices[i]];
      }

      blocks.forEach((block, i) => {
        const imgIndex = imageIndices[i];
        const img = images[imgIndex];
        if (!img) return;

        const x = block.x + spacing / 2;
        const y = block.y + spacing / 2;
        const w = block.w - spacing;
        const h = block.h - spacing;

        if (w <= 0 || h <= 0) return;

        const imgRatio = img.width / img.height;
        const blockRatio = w / h;
        let sx, sy, sw, sh;
        if (imgRatio > blockRatio) { sh = img.height; sw = sh * blockRatio; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / blockRatio; sx = 0; sy = (img.height - sh) / 2; }

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        ctx.restore();
      });
      return { ctx, canvas, images, params }
    }
  },

  collage: {
    name: 'Dynamic Collage',
    params: [
      { key: 'salt', label: 'Layout Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const salt = params.salt ?? 1;

      // Clear
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (N === 1) {
        const img = images[0];
        if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return;
      }

      const seededRandom = (index, channel = 0) => {
        const seed = (index + 1) * (salt + 1) * (channel * 23.7 + 1);
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
      };

      const cw = canvas.width;
      const ch = canvas.height;

      // Background
      const bgImg = images[0];
      if (bgImg) {
        const iw = bgImg.width; const ih = bgImg.height;
        const r = iw / ih; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = ih; sw = ih * cr; sx = (iw - sw) * 0.5; sy = 0; }
        else { sw = iw; sh = iw / cr; sx = 0; sy = (ih - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, cw, ch);

      const remainingImages = images.slice(1);
      const numRemaining = remainingImages.length;
      if (!numRemaining) return;

      const cols = Math.min(Math.ceil(Math.sqrt(numRemaining * 1.5)), 4);
      const rows = Math.ceil(numRemaining / cols);
      const cellW = cw / cols;
      const cellH = ch / rows;

      remainingImages.forEach((img, i) => {
        if (!img) return;
        const imgIndex = i + 1;
        const row = Math.floor(i / cols);
        const col = i % cols;
        const baseCellX = col * cellW;
        const baseCellY = row * cellH;

        const sizeRand = seededRandom(imgIndex, 1);
        let sizeFactor;
        if (sizeRand < 0.25) sizeFactor = 0.85 + seededRandom(imgIndex, 2) * 0.20;
        else if (sizeRand < 0.65) sizeFactor = 0.65 + seededRandom(imgIndex, 3) * 0.18;
        else sizeFactor = 0.50 + seededRandom(imgIndex, 4) * 0.13;

        const aspectRand = seededRandom(imgIndex, 5);
        let aspectRatio;
        if (aspectRand < 0.35) aspectRatio = 0.65 + seededRandom(imgIndex, 6) * 0.3;
        else if (aspectRand < 0.70) aspectRatio = 0.90 + seededRandom(imgIndex, 7) * 0.25;
        else aspectRatio = 1.20 + seededRandom(imgIndex, 8) * 0.5;

        const baseSize = Math.max(cellW, cellH) * 1.2;
        const width = baseSize * sizeFactor;
        const height = width / aspectRatio;

        const offsetX = (seededRandom(imgIndex, 10) - 0.5) * (cellW - width) * 0.6;
        const offsetY = (seededRandom(imgIndex, 11) - 0.5) * (cellH - height) * 0.6;
        const x = baseCellX + (cellW - width) / 2 + offsetX;
        const y = baseCellY + (cellH - height) / 2 + offsetY;

        const rotation = (seededRandom(imgIndex, 12) - 0.5) * 0.25;
        const zOffset = seededRandom(imgIndex, 13);

        ctx.save();
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 15 + zOffset * 15;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6 + zOffset * 8;

        const borderWidth = Math.max(6, width * 0.025);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-width / 2 - borderWidth, -height / 2 - borderWidth, width + borderWidth * 2, height + borderWidth * 2);

        ctx.shadowColor = 'transparent';
        const imgRatio = img.width / img.height;
        const targetRatio = width / height;
        let sx, sy, sWidth, sHeight;

        if (imgRatio > targetRatio) { sHeight = img.height; sWidth = sHeight * targetRatio; sx = (img.width - sWidth) / 2; sy = 0; }
        else { sWidth = img.width; sHeight = sWidth / targetRatio; sx = 0; sy = (img.height - sHeight) / 2; }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, -width / 2, -height / 2, width, height);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.restore();
      });
      return { ctx, canvas, images, params }
    }
  },

  shrink: {
    name: 'Shrink Tunnel',
    params: [
      { key: 'scaleStep', label: 'Shrink Factor', type: 'range', min: 0.5, max: 0.95, step: 0.01, default: 0.85 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const scaleStep = params.scaleStep ?? 0.85;
      const cw = canvas.width;
      const ch = canvas.height;
      const cx = cw / 2;
      const cy = ch / 2;

      for (let i = 0; i < N; i++) {
        const img = images[i];
        if (!img) continue;

        const currentScale = Math.pow(scaleStep, i);
        const w = cw * currentScale;
        const h = ch * currentScale;
        const x = cx - (w / 2);
        const y = cy - (h / 2);

        ctx.save();
        if (i > 0) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 20 * currentScale;
          ctx.shadowOffsetY = 5 * currentScale;
          ctx.fillStyle = 'white';
          ctx.fillRect(x - (2 * currentScale), y - (2 * currentScale), w + (4 * currentScale), h + (4 * currentScale));
        }

        const imgRatio = img.width / img.height;
        const layerRatio = w / h;
        let sx, sy, sWidth, sHeight;

        if (imgRatio > layerRatio) { sHeight = img.height; sWidth = sHeight * layerRatio; sx = (img.width - sWidth) / 2; sy = 0; }
        else { sWidth = img.width; sHeight = sWidth / layerRatio; sx = 0; sy = (img.height - sHeight) / 2; }

        ctx.shadowColor = 'transparent';
        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
        ctx.restore();
      }
      return { ctx, canvas, images, params }
    }
  },

  fanSpread: {
    name: 'Fan Spread',
    params: [
      { key: 'salt', label: 'Variation', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const salt = params.salt ?? 1;
      const W = canvas.width;
      const H = canvas.height;

      // Background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = W / H;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, H);

      if (N === 1) return;

      const centerX = W / 2;
      const centerY = H / 2;
      const fanCards = images.slice(1);
      const fanCount = fanCards.length;
      if (!fanCount) return;

      const baseSpreaDeg = 20 + (fanCount * 1.2);
      const maxSpreadDeg = Math.min(50, baseSpreaDeg + (Math.sin(salt) * 10));
      const maxSpreadRad = maxSpreadDeg * Math.PI / 180;

      const cardBaseW = W * 0.65;
      const cardBaseH = H * 0.70;

      const testAngle = maxSpreadRad;
      const rotW = Math.abs(cardBaseW * Math.cos(testAngle)) + Math.abs(cardBaseH * Math.sin(testAngle));
      const rotH = Math.abs(cardBaseW * Math.sin(testAngle)) + Math.abs(cardBaseH * Math.cos(testAngle));
      const scale = Math.min(W / rotW, H / rotH) * 0.90;
      const cardW = cardBaseW * scale;
      const cardH = cardBaseH * scale;

      const dx = cardW * 0.04;
      const dyBase = Math.sin(salt * 0.7) * H * 0.08;
      const half = (fanCount - 1) / 2;
      const anglePerCard = fanCount === 1 ? 0 : (maxSpreadRad * 2) / (fanCount - 1);

      for (let i = 0; i < fanCount; i++) {
        const img = fanCards[i];
        if (!img) continue;
        const t = i - half;
        const angle = t * anglePerCard;
        const x = centerX + t * dx;
        const y = centerY + dyBase + Math.sin(i * 0.5 + salt) * H * 0.02;

        ctx.save();
        ctx.globalAlpha = 0.65 + (i / fanCount) * 0.35;
        ctx.shadowColor = `rgba(0, 0, 0, ${0.3 + (i / fanCount) * 0.3})`;
        ctx.shadowBlur = 15 + (i / fanCount) * 15;
        ctx.shadowOffsetX = 4 + t * 2;
        ctx.shadowOffsetY = 6 + (i / fanCount) * 8;

        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = 'white';
        ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

        const padding = Math.max(8 * scale, 5);
        const innerW = cardW - padding * 2;
        const innerH = cardH - padding * 2;

        const ir = img.width / img.height;
        const tr = innerW / innerH;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, -innerW / 2, -innerH / 2, innerW, innerH);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);
        ctx.restore();
      }
      return { ctx, canvas, images, params }
    }
  },

  scatteredStack: {
    name: 'Scattered Stack',
    params: [
      { key: 'salt', label: 'Scatter Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const salt = params.salt ?? 1;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseWidth = canvas.width;
      const baseHeight = canvas.height;

      // Background
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = baseWidth / baseHeight;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) / 2; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) / 2; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, baseWidth, baseHeight);
      }
      if (N === 1) return;

      const maxVisible = N - 1;
      const getDeterministicNoise = (index, channel) => {
        const seed = (index + 1) * (salt + 1) * (channel * 12.9898);
        return Math.sin(seed);
      };

      const maxOffsetX = canvas.width * 0.25;
      const maxOffsetY = canvas.height * 0.20;
      const maxRotationRad = 0.5;
      const sizeReduction = 0.03;

      for (let i = 0; i < maxVisible; i++) {
        const imgIndex = i + 1;
        const img = images[imgIndex];
        if (!img) continue;

        const scale = 1 - (i * sizeReduction);
        const width = baseWidth * scale;
        const height = baseHeight * scale;

        const rotation = getDeterministicNoise(i, 1) * maxRotationRad;
        const offsetX = getDeterministicNoise(i, 2) * maxOffsetX;
        const offsetY = getDeterministicNoise(i, 3) * maxOffsetY;

        const x = centerX - width / 2 + offsetX;
        const y = centerY - height / 2 + offsetY;
        const opacity = 0.7 + (i / maxVisible) * 0.3;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(centerX + offsetX, centerY + offsetY);
        ctx.rotate(rotation);
        ctx.translate(-centerX - offsetX, -centerY - offsetY);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, width, height);

        const padding = 10 * scale;
        const imgWidth = width - padding * 2;
        const imgHeight = height - padding * 2;
        const ir = img.width / img.height;
        const tr = imgWidth / imgHeight;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, x + padding, y + padding, imgWidth, imgHeight);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        ctx.restore();
      }
      return { ctx, canvas, images, params }
    }
  },

  spiral: {
    name: 'Spiral',
    params: [
      { key: 'salt', label: 'Pattern', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const salt = params.salt ?? 1;
      const cw = canvas.width;
      const ch = canvas.height;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, cw, ch);

      // Background
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const spiralImages = images.slice(1);
      const spiralCount = spiralImages.length;
      if (!spiralCount) return;

      const centerX = cw / 2;
      const centerY = ch / 2;
      const minScale = 0.25;
      const maxScale = 1.0;
      const initialSize = Math.min(cw, ch) * 0.70;

      const spiralTightness = 0.15 + (Math.abs(Math.sin(salt * 0.5)) * 0.15);
      const rotationSpeed = 2.5 + (Math.abs(Math.cos(salt * 0.7)) * 2);
      const startAngle = (salt * 0.8) % (Math.PI * 2);

      spiralImages.forEach((img, i) => {
        if (!img) return;
        const progress = i / Math.max(spiralCount - 1, 1);
        const scale = maxScale - (progress * (maxScale - minScale));
        const width = initialSize * scale;
        const height = initialSize * scale;

        const angle = startAngle + (progress * Math.PI * 2 * rotationSpeed);
        const radius = progress * Math.min(cw, ch) * spiralTightness;
        const x = centerX - width / 2 + Math.cos(angle) * radius;
        const y = centerY - height / 2 + Math.sin(angle) * radius;
        const rotation = angle * 0.15 + (Math.sin(salt + i) * 0.12);
        const opacity = 0.85 + (progress * 0.15);

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(rotation);
        ctx.translate(-x - width / 2, -y - height / 2);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 12 + progress * 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 5;

        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, width, height);

        const padding = Math.max(5, width * 0.025);
        const imgWidth = width - padding * 2;
        const imgHeight = height - padding * 2;
        const ir = img.width / img.height;
        const tr = imgWidth / imgHeight;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, x + padding, y + padding, imgWidth, imgHeight);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        ctx.restore();
      });
      return { ctx, canvas, images, params }
    }
  },

  waves: {
    name: 'Waves',
    params: [
      { key: 'salt', label: 'Variation', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const salt = params.salt ?? 1;
      const cw = canvas.width;
      const ch = canvas.height;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, cw, ch);

      // Background
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      const gradient = ctx.createLinearGradient(0, 0, 0, ch);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const waveImages = images.slice(1);
      const waveCount = waveImages.length;
      if (!waveCount) return;

      const waveFrequency = 1.5 + (Math.abs(Math.sin(salt * 0.6)) * 1.5);
      const waveAmplitude = cw * (0.08 + Math.abs(Math.cos(salt * 0.8)) * 0.12);
      const verticalSpacing = ch / (waveCount + 1);
      const cardWidth = cw * 0.22;
      const cardHeight = ch * 0.28;

      waveImages.forEach((img, i) => {
        if (!img) return;
        const baseY = verticalSpacing * (i + 1) - cardHeight / 2;
        const progress = i / Math.max(waveCount - 1, 1);
        const wavePhase = (progress * Math.PI * 2 * waveFrequency) + (salt * 0.5);
        const waveOffset = Math.sin(wavePhase) * waveAmplitude;

        const baseX = (i % 2 === 0) ? cw * 0.15 + waveOffset : cw * 0.65 + waveOffset;
        const x = baseX;
        const y = baseY;
        const rotation = Math.sin(wavePhase) * 0.12;
        const scaleVariation = 0.85 + Math.abs(Math.sin(wavePhase + salt)) * 0.3;
        const width = cardWidth * scaleVariation;
        const height = cardHeight * scaleVariation;

        ctx.save();
        ctx.globalAlpha = 0.90 + Math.abs(Math.cos(wavePhase)) * 0.10;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 15 + scaleVariation * 10;
        ctx.shadowOffsetX = Math.sin(wavePhase) * 5;
        ctx.shadowOffsetY = 8;

        ctx.translate(x, y);
        ctx.rotate(rotation);

        const borderW = Math.max(4, width * 0.02);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-width / 2 - borderW, -height / 2 - borderW, width + borderW * 2, height + borderW * 2);

        ctx.shadowColor = 'transparent';
        const ir = img.width / img.height;
        const tr = width / height;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.restore();
      });
      return { ctx, canvas, images, params }
    }
  },

  bookStack: {
    name: 'Book Stack',
    params: [
      { key: 'salt', label: 'Variation', type: 'range', min: 1, max: 100, step: 1, default: 1 },
      { key: 'overlap', label: 'Overlap', type: 'range', min: 0.5, max: 0.9, step: 0.05, default: 0.7 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const salt = params.salt ?? 1;
      const overlapFactor = params.overlap ?? 0.7;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, cw, ch);

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const stackImages = images.slice(1);
      const stackCount = stackImages.length;
      if (!stackCount) return;

      const posterAspect = 0.70;
      const canvasRatio = cw / ch;
      let idealCols, rows;

      if (canvasRatio > 1.2) {
        idealCols = Math.ceil(Math.sqrt(stackCount * canvasRatio * 1.5));
        rows = Math.ceil(stackCount / idealCols);
      } else if (canvasRatio < 0.8) {
        rows = Math.ceil(Math.sqrt(stackCount / canvasRatio * 1.5));
        idealCols = Math.ceil(stackCount / rows);
      } else {
        const sqrtCount = Math.sqrt(stackCount);
        idealCols = Math.ceil(sqrtCount * Math.sqrt(canvasRatio));
        rows = Math.ceil(stackCount / idealCols);
      }

      const maxPosterHeight = ch / (1 + (rows - 1) * overlapFactor);
      const maxPosterWidth = cw / (1 + (idealCols - 1) * overlapFactor);
      let finalPosterWidth, finalPosterHeight;
      const posterHeightFromWidth = maxPosterWidth / posterAspect;
      const posterWidthFromHeight = maxPosterHeight * posterAspect;

      if (posterHeightFromWidth <= ch / (1 + (rows - 1) * overlapFactor)) {
        finalPosterWidth = maxPosterWidth;
        finalPosterHeight = posterHeightFromWidth;
      } else {
        finalPosterHeight = maxPosterHeight;
        finalPosterWidth = posterWidthFromHeight;
      }

      const stepX = finalPosterWidth * overlapFactor;
      const stepY = finalPosterHeight * overlapFactor;
      const totalWidth = finalPosterWidth + (idealCols - 1) * stepX;
      const totalHeight = finalPosterHeight + (rows - 1) * stepY;
      const startX = (cw - totalWidth) / 2;
      const startY = (ch - totalHeight) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < idealCols; col++) {
          const index = row * idealCols + col;
          if (index >= stackCount) break;
          const img = stackImages[index];
          if (!img) continue;

          const x = startX + col * stepX;
          const y = startY + row * stepY;
          ctx.save();

          const depthFactor = (row * idealCols + col) / stackCount;
          ctx.shadowColor = `rgba(0, 0, 0, ${0.3 + depthFactor * 0.3})`;
          ctx.shadowBlur = 15 + depthFactor * 15;
          ctx.shadowOffsetX = 5;
          ctx.shadowOffsetY = 8 + depthFactor * 8;

          const rotationSeed = (index + 1) * (salt + 1) * 17.3;
          const rotation = Math.sin(rotationSeed) * 0.04;
          const centerX = x + finalPosterWidth / 2;
          const centerY = y + finalPosterHeight / 2;

          ctx.translate(centerX, centerY);
          ctx.rotate(rotation);
          ctx.translate(-centerX, -centerY);

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(x, y, finalPosterWidth, finalPosterHeight, 6);
          ctx.fill();

          ctx.shadowColor = 'transparent';
          const padding = Math.max(8, finalPosterWidth * 0.04);
          const contentX = x + padding;
          const contentY = y + padding;
          const contentW = finalPosterWidth - padding * 2;
          const contentH = finalPosterHeight - padding * 2;

          const ir = img.width / img.height;
          const tr = contentW / contentH;
          let sx, sy, sw, sh;
          if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
          else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(contentX, contentY, contentW, contentH, 4);
          ctx.clip();
          ctx.drawImage(img, sx, sy, sw, sh, contentX, contentY, contentW, contentH);
          ctx.restore();

          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(x, y, finalPosterWidth, finalPosterHeight, 6);
          ctx.stroke();
          ctx.restore();
        }
      }
      return { ctx, canvas, images, params }
    }
  },

  polaroidWall: {
    name: 'Polaroid Wall',
    params: [
      { key: 'salt', label: 'Scatter Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const salt = params.salt ?? 1;

      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(0, 0, cw, ch);

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const polaroidImages = images.slice(1);
      const count = polaroidImages.length;
      if (!count) return;

      const polaroidWidth = Math.min(cw * 0.28, ch * 0.35);
      const polaroidHeight = polaroidWidth * 1.18;
      const photoHeight = polaroidWidth * 0.95;

      const cols = Math.ceil(Math.sqrt(count * (cw / ch)));
      const rows = Math.ceil(count / cols);
      const spacingX = cw / (cols + 1);
      const spacingY = ch / (rows + 1);

      for (let i = 0; i < count; i++) {
        const img = polaroidImages[i];
        if (!img) continue;

        const row = Math.floor(i / cols);
        const col = i % cols;
        const gridX = spacingX * (col + 1);
        const gridY = spacingY * (row + 1);

        const scatterSeed = (i + 1) * salt * 23.456;
        const scatterX = (Math.sin(scatterSeed) - 0.5) * spacingX * 0.4;
        const scatterY = (Math.cos(scatterSeed * 1.234) - 0.5) * spacingY * 0.4;

        const x = gridX + scatterX - polaroidWidth / 2;
        const y = gridY + scatterY - polaroidHeight / 2;

        ctx.save();
        const rotationSeed = (i + 1) * salt * 31.415;
        const rotation = Math.sin(rotationSeed) * 0.15;
        const centerX = x + polaroidWidth / 2;
        const centerY = y + polaroidHeight / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(x, y, polaroidWidth, polaroidHeight);

        ctx.shadowColor = 'transparent';
        const photoMargin = polaroidWidth * 0.06;
        const photoX = x + photoMargin;
        const photoY = y + photoMargin;
        const photoW = polaroidWidth - photoMargin * 2;

        const ir = img.width / img.height;
        const tr = photoW / photoHeight;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoHeight);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(photoX, photoY, photoW, photoHeight);

        const tapeChoice = Math.abs(Math.sin(rotationSeed * 2)) > 0.5;
        const tapeWidth = polaroidWidth * 0.5;
        const tapeHeight = polaroidWidth * 0.08;
        const tapeX = x + (polaroidWidth - tapeWidth) / 2;
        const tapeY = y - tapeHeight * 0.4;

        ctx.fillStyle = 'rgba(255, 255, 220, 0.7)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;

        if (tapeChoice) {
          ctx.fillRect(tapeX, tapeY, tapeWidth, tapeHeight);
        } else {
          ctx.save();
          ctx.translate(x + polaroidWidth * 0.85, y + polaroidHeight * 0.15);
          ctx.rotate(0.785);
          ctx.fillRect(-tapeWidth * 0.3, -tapeHeight / 2, tapeWidth * 0.6, tapeHeight);
          ctx.restore();
        }
        ctx.restore();
      }
      return { ctx, canvas, images, params }
    }
  },

  scatteredPhotos: {
    name: 'Scattered Photos',
    params: [
      { key: 'salt', label: 'Scatter Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const cx = cw / 2;
      const cy = ch / 2;
      const salt = params.salt ?? 1;

      const img = images[0];
      if (img) {
        const r = img.width / img.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) * 0.5; sy = 0; }
        else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) * 0.5; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      if (N === 1) return;

      const baseSize = Math.min(cw, ch);
      for (let i = 1; i < N; i++) {
        const pImg = images[i];
        if (!pImg) continue;

        const uniqueSalt = (i + 1) * (N + 13) * (cw + ch) * salt;
        const rndX = Math.sin(uniqueSalt * 12.9898);
        const rndY = Math.sin(uniqueSalt * 78.233);
        const rndR = Math.cos(uniqueSalt * 53.539);
        const rndS = Math.sin(uniqueSalt * 99.111);

        const scale = 0.4 + (rndS * 0.1);
        const ir = pImg.width / pImg.height;
        let w, h;
        if (ir > 1) { w = baseSize * scale; h = w / ir; }
        else { h = baseSize * scale; w = h * ir; }

        const maxScatterX = cw * 0.5;
        const maxScatterY = ch * 0.35;
        const x = cx + (rndX * maxScatterX);
        const y = cy + (rndY * maxScatterY);
        const rotation = rndR * 20 * (Math.PI / 180);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        const padding = Math.max(10, w * 0.06);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((-w / 2) - padding, (-h / 2) - padding, w + (padding * 2), h + (padding * 2));
        ctx.shadowColor = 'transparent';
        ctx.drawImage(pImg, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      return { ctx, canvas, images, params }
    }
  },

  cardFan: {
    name: 'Card Fan',
    params: [
      { key: 'salt', label: 'Pattern Variation', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const baseWidth = canvas.width;
      const baseHeight = canvas.height;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const salt = params.salt ?? 1;

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = baseWidth / baseHeight;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, baseWidth, baseHeight);
      }

      if (N === 1) return;

      const maxVisible = N - 1;
      const saltAngle = (salt * 137.5) % 360;
      const maxRotation = 0.2 + (Math.abs(Math.sin(salt * 0.5)) * 0.3);
      const maxOffsetX = canvas.width * (0.1 + (Math.abs(Math.cos(salt * 0.7)) * 0.15));
      const maxOffsetY = canvas.height * (0.05 + (Math.abs(Math.sin(salt * 0.9)) * 0.15));
      const sizeReduction = 0.02 + (Math.abs(Math.sin(salt * 1.3)) * 0.04);
      const arrangementMode = Math.floor(Math.abs(salt * 3.7)) % 4;

      for (let i = 0; i < maxVisible; i++) {
        const imgIndex = i + 1;
        const img = images[imgIndex];
        if (!img) continue;

        const scale = 1 - (i * sizeReduction);
        const width = baseWidth * scale;
        const height = baseHeight * scale;
        const progress = i / (maxVisible - 1);
        let rotation, offsetX, offsetY;

        switch (arrangementMode) {
          case 0: // Symmetric fan
            rotation = (progress - 0.5) * maxRotation * 2;
            offsetX = (progress - 0.5) * maxOffsetX * 2;
            offsetY = (progress - 0.5) * maxOffsetY;
            break;
          case 1: // Circular
            const angle = (saltAngle + (360 / maxVisible * i * salt)) * Math.PI / 180;
            rotation = angle % (Math.PI * 0.4) - (Math.PI * 0.2);
            offsetX = Math.cos(angle % (Math.PI * 2)) * maxOffsetX;
            offsetY = Math.sin(angle % (Math.PI * 2)) * maxOffsetY;
            break;
          case 2: // Wave
            const wavePhase = (i / maxVisible * Math.PI * 2 * salt) % (Math.PI * 2);
            rotation = Math.sin(wavePhase) * maxRotation;
            offsetX = Math.cos(wavePhase) * maxOffsetX;
            offsetY = Math.sin(wavePhase * 2) * maxOffsetY;
            break;
          case 3: // Spiral
            const spiralAngle = (i * salt * 0.5) % (Math.PI * 2);
            const spiralRadius = progress;
            rotation = (spiralAngle - Math.PI) % (Math.PI * 0.6) - (Math.PI * 0.3);
            offsetX = Math.cos(spiralAngle) * maxOffsetX * spiralRadius;
            offsetY = Math.sin(spiralAngle) * maxOffsetY * spiralRadius;
            break;
        }

        const x = centerX - width / 2 + offsetX;
        const y = centerY - height / 2 + offsetY;
        const baseOpacity = 0.6 + (Math.abs(Math.cos(salt * 0.3)) * 0.2);
        const opacity = baseOpacity + (i / maxVisible) * (1 - baseOpacity);

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(centerX + offsetX, centerY + offsetY);
        ctx.rotate(rotation);
        ctx.translate(-centerX - offsetX, -centerY - offsetY);

        const shadowIntensity = 0.2 + (Math.abs(Math.sin(salt * 1.1)) * 0.3);
        ctx.shadowColor = `rgba(0, 0, 0, ${shadowIntensity})`;
        ctx.shadowBlur = 10 + (Math.abs(Math.cos(salt * 0.8)) * 15);
        ctx.shadowOffsetX = 3 + Math.cos(salt) * 5;
        ctx.shadowOffsetY = 3 + Math.sin(salt) * 5;

        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, width, height);

        const padding = (8 + (Math.abs(Math.sin(salt * 1.7)) * 8)) * scale;
        const imgWidth = width - padding * 2;
        const imgHeight = height - padding * 2;
        const ir = img.width / img.height;
        const tr = imgWidth / imgHeight;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, x + padding, y + padding, imgWidth, imgHeight);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1 + (Math.abs(Math.cos(salt * 2.1)) * 2);
        ctx.strokeRect(x, y, width, height);
        ctx.restore();
      }
      return { ctx, canvas, images, params }
    }
  },

  framedGrid: {
    name: 'Framed Grid',
    params: [
      { key: 'salt', label: 'Layout Variation', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const salt = params.salt ?? 1;

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      if (N === 1) return;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, cw, ch);

      const gridImages = images.slice(1);
      const numImages = gridImages.length;
      if (!numImages) return;

      let cols, rows;
      if (numImages <= 2) { cols = 2; rows = 1; }
      else if (numImages <= 4) { cols = 2; rows = 2; }
      else if (numImages <= 6) { cols = 3; rows = 2; }
      else if (numImages <= 9) { cols = 3; rows = 3; }
      else { cols = 4; rows = Math.ceil(numImages / 4); }

      const gapSize = Math.max(8, Math.min(cw, ch) * 0.02);
      const gridMargin = Math.min(cw, ch) * 0.05;
      const availableWidth = cw - (gridMargin * 2);
      const availableHeight = ch - (gridMargin * 2);
      const cellWidth = (availableWidth - (gapSize * (cols - 1))) / cols;
      const cellHeight = (availableHeight - (gapSize * (rows - 1))) / rows;

      for (let i = 0; i < numImages; i++) {
        const img = gridImages[i];
        if (!img) continue;

        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellX = gridMargin + (col * (cellWidth + gapSize));
        const cellY = gridMargin + (row * (cellHeight + gapSize));

        const uniqueSalt = (i + 1) * (N + 13) * (cw + ch) * salt;
        const rndRotation = Math.sin(uniqueSalt * 53.539) * 5;
        const rndScale = 0.95 + (Math.abs(Math.sin(uniqueSalt * 99.111)) * 0.1);

        ctx.save();
        const cellCenterX = cellX + cellWidth / 2;
        const cellCenterY = cellY + cellHeight / 2;
        ctx.translate(cellCenterX, cellCenterY);
        ctx.rotate(rndRotation * Math.PI / 180);

        const borderWidth = Math.max(6, cellWidth * 0.04);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        ctx.fillStyle = '#ffffff';
        const frameWidth = cellWidth * rndScale;
        const frameHeight = cellHeight * rndScale;
        ctx.fillRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);

        ctx.shadowColor = 'transparent';
        const imgWidth = frameWidth - (borderWidth * 2);
        const imgHeight = frameHeight - (borderWidth * 2);
        const ir = img.width / img.height;
        const fr = imgWidth / imgHeight;
        let sx, sy, sw, sh;
        if (ir > fr) { sh = img.height; sw = sh * fr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / fr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
        ctx.restore();
      }
      return { ctx, canvas, images, params }
    }
  },

  filmStrip: {
    name: 'Film Strip',
    params: [
      { key: 'orientation', label: 'Orientation', type: 'select', options: ['Horizontal', 'Vertical'], default: 'Horizontal' },
      { key: 'spacing', label: 'Frame Spacing', type: 'range', min: 0, max: 50, step: 1, default: 10 },
      { key: 'color', label: 'Strip Color', type: 'color', default: '#111111' }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw Background (Image 0)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cw, ch);

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      // Overlay to make the film strip pop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return; // Only BG

      // 2. Setup Film Strip with Remaining Images
      const stripImages = images.slice(1);
      const count = stripImages.length;
      if (!count) return;

      const vertical = params.orientation === 'Vertical';
      const spacing = params.spacing ?? 10;
      const stripColor = params.color ?? '#111111';

      // Calculate Frame Geometry
      const holeSize = vertical ? cw * 0.05 : ch * 0.05;
      const holeMargin = holeSize * 0.8;
      const stripPadding = holeSize + holeMargin * 2;

      let frameW, frameH;
      if (vertical) {
        frameW = cw - stripPadding * 2;
        const totalSpacing = spacing * (count + 1);
        frameH = (ch - totalSpacing) / count;
      } else {
        frameH = ch - stripPadding * 2;
        const totalSpacing = spacing * (count + 1);
        frameW = (cw - totalSpacing) / count;
      }

      // Draw Strip Background
      ctx.fillStyle = stripColor;
      if (vertical) ctx.fillRect(0, 0, cw, ch); // Full fill looks better than a thin strip in center
      else ctx.fillRect(0, 0, cw, ch);

      // Draw Sprocket Holes
      const drawHoles = () => {
        ctx.fillStyle = '#ffffff';
        ctx.globalCompositeOperation = 'destination-out';

        const holeW = vertical ? holeSize : holeSize * 0.7;
        const holeH = vertical ? holeSize * 0.7 : holeSize;
        const holeStep = holeSize * 2;

        if (vertical) {
          for (let y = 0; y < ch; y += holeStep) {
            ctx.beginPath(); ctx.roundRect(holeMargin, y, holeW, holeH, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(cw - holeMargin - holeW, y, holeW, holeH, 2); ctx.fill();
          }
        } else {
          for (let x = 0; x < cw; x += holeStep) {
            ctx.beginPath(); ctx.roundRect(x, holeMargin, holeW, holeH, 2); ctx.fill();
            ctx.beginPath(); ctx.roundRect(x, ch - holeMargin - holeH, holeW, holeH, 2); ctx.fill();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      };

      drawHoles();

      // Draw Images
      stripImages.forEach((img, i) => {
        if (!img) return;

        const x = vertical ? stripPadding : spacing + i * (frameW + spacing);
        const y = vertical ? spacing + i * (frameH + spacing) : stripPadding;

        // Crop fit
        const imgRatio = img.width / img.height;
        const frameRatio = frameW / frameH;
        let sx, sy, sWidth, sHeight;
        if (imgRatio > frameRatio) {
          sHeight = img.height;
          sWidth = sHeight * frameRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = sWidth / frameRatio;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, frameW, frameH);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, frameW, frameH);
        ctx.restore();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, frameW, frameH);
      });

      return { ctx, canvas, images, params };
    }
  },

  honeycomb: {
    name: 'Honeycomb',
    params: [
      { key: 'spacing', label: 'Gap Size', type: 'range', min: 0, max: 20, step: 1, default: 5 },
      { key: 'scale', label: 'Hex Size', type: 'range', min: 0.5, max: 1.5, step: 0.1, default: 1.0 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;

      const gap = params.spacing ?? 5;
      const userScale = params.scale ?? 1.0;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw Background (Image 0)
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, cw, ch);

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Darker overlay for honeycomb contrast
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      // 2. Setup Honeycomb with Remaining Images
      const hexImages = images.slice(1);
      const count = hexImages.length;
      if (!count) return;

      const approxR = Math.sqrt((cw * ch) / (count * 2.5)) * userScale;
      const r = Math.min(approxR, Math.min(cw, ch) * 0.4);

      const hexH = r * 2;
      const hexW = Math.sqrt(3) * r;

      const cols = Math.ceil(cw / hexW) + 2;
      const rows = Math.ceil(ch / (hexH * 0.75)) + 2;

      const totalGridW = cols * hexW;
      const totalGridH = rows * (hexH * 0.75);
      const startX = (cw - totalGridW) / 2 + hexW / 2;
      const startY = (ch - totalGridH) / 2 + hexH / 2;

      let imgIndex = 0;

      const drawHex = (cx, cy, radius) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 180) * (30 + 60 * i);
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      let hexPositions = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const xOffset = (row % 2) * (hexW / 2);
          const cx = startX + col * hexW + xOffset;
          const cy = startY + row * (hexH * 0.75);
          const dist = Math.sqrt(Math.pow(cx - cw / 2, 2) + Math.pow(cy - ch / 2, 2));
          hexPositions.push({ cx, cy, dist });
        }
      }

      hexPositions.sort((a, b) => a.dist - b.dist);

      hexPositions.forEach((pos) => {
        if (imgIndex >= count) return;
        const img = hexImages[imgIndex];
        imgIndex++;
        if (!img) return;

        const { cx, cy } = pos;

        ctx.save();
        drawHex(cx, cy, r - gap / 2);
        ctx.clip();

        const hexRectW = hexW;
        const hexRectH = hexH;

        const imgRatio = img.width / img.height;
        const targetRatio = hexRectW / hexRectH;
        let sx, sy, sWidth, sHeight;

        if (imgRatio > targetRatio) {
          sHeight = img.height;
          sWidth = sHeight * targetRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = img.width;
          sHeight = sWidth / targetRatio;
          sx = 0;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, cx - hexRectW / 2, cy - hexRectH / 2, hexRectW, hexRectH);

        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();

        ctx.restore();
      });

      return { ctx, canvas, images, params };
    }
  },

  perspectiveWall: {
    name: 'Perspective Wall',
    params: [
      { key: 'direction', label: 'Vanishing Point', type: 'select', options: ['Left', 'Right'], default: 'Right' },
      { key: 'depth', label: 'Depth Intensity', type: 'range', min: 0.1, max: 0.9, step: 0.1, default: 0.6 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw Background (Image 0)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cw, ch);

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      // 2. Setup Wall with Remaining Images
      const wallImages = images.slice(1);
      const count = wallImages.length;
      if (!count) return;

      const toRight = params.direction === 'Right';
      const depth = params.depth ?? 0.6;
      const margin = 10;

      let widths = [];
      let totalUnitWidth = 0;

      for (let i = 0; i < count; i++) {
        const factor = 1 - (i / count) * depth;
        widths.push(factor);
        totalUnitWidth += factor;
      }

      if (!toRight) widths.reverse();

      const scaleUnit = (cw - (margin * (count + 1))) / totalUnitWidth;

      let currentX = margin;

      for (let i = 0; i < count; i++) {
        const slotWidth = widths[i] * scaleUnit;
        const img = wallImages[i];

        if (!img) continue;

        const hScale = widths[i];
        const slotH = ch * 0.8 * hScale;
        const slotY = (ch - slotH) / 2;

        // Reflection
        ctx.save();
        ctx.globalAlpha = 0.3 * hScale;

        const imgRatio = img.width / img.height;
        const targetRatio = slotWidth / slotH;
        let sx, sy, sWidth, sHeight;
        if (imgRatio > targetRatio) { sHeight = img.height; sWidth = sHeight * targetRatio; sx = (img.width - sWidth) / 2; sy = 0; }
        else { sWidth = img.width; sHeight = sWidth / targetRatio; sx = 0; sy = (img.height - sHeight) / 2; }

        ctx.translate(currentX, slotY + slotH);
        ctx.scale(1, -1);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, -10, slotWidth, slotH);
        ctx.restore();

        // Main Image
        ctx.save();
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 20 * hScale;
        ctx.shadowOffsetX = 10 * (toRight ? -1 : 1);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, currentX, slotY, slotWidth, slotH);

        // Shading
        const darkness = toRight ? (i / count) : (1 - i / count);
        ctx.fillStyle = `rgba(0,0,0,${darkness * 0.5})`;
        ctx.fillRect(currentX, slotY, slotWidth, slotH);

        ctx.restore();

        currentX += slotWidth + margin;
      }

      return { ctx, canvas, images, params };
    }
  },

  pyramid: {
    name: 'Pyramid Stack',
    params: [
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 20, step: 1, default: 5 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw Background (Image 0)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, cw, ch);

      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      // 2. Setup Pyramid with Remaining Images
      const stackImages = images.slice(1);
      const count = stackImages.length;
      if (!count) return;

      const spacing = params.spacing ?? 5;

      let rows = [];
      let used = 0;
      let r = 1;
      while (used < count) {
        let c = Math.min(r, count - used);
        rows.push(c);
        used += c;
        r++;
      }

      const numRows = rows.length;
      const rowH = (ch - (spacing * (numRows + 1))) / numRows;

      let imgIdx = 0;
      for (let i = 0; i < numRows; i++) {
        const countInRow = rows[i];
        const maxCols = rows[rows.length - 1];
        const cellW = (cw - (spacing * (maxCols + 1))) / maxCols;

        const rowY = spacing + i * (rowH + spacing);
        const rowTotalW = countInRow * cellW + (countInRow - 1) * spacing;
        const startX = (cw - rowTotalW) / 2;

        for (let k = 0; k < countInRow; k++) {
          const img = stackImages[imgIdx];
          if (!img) continue;

          const x = startX + k * (cellW + spacing);
          const y = rowY;

          const imgRatio = img.width / img.height;
          const targetRatio = cellW / rowH;
          let sx, sy, sWidth, sHeight;
          if (imgRatio > targetRatio) { sHeight = img.height; sWidth = sHeight * targetRatio; sx = (img.width - sWidth) / 2; sy = 0; }
          else { sWidth = img.width; sHeight = sWidth / targetRatio; sx = 0; sy = (img.height - sHeight) / 2; }

          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 5;

          ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, cellW, rowH);

          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellW, rowH);
          ctx.restore();

          imgIdx++;
        }
      }

      return { ctx, canvas, images, params };
    }
  },

  diagonalSlash: {
    name: 'Diagonal Slash',
    params: [
      { key: 'angle', label: 'Slash Angle', type: 'range', min: -45, max: 45, step: 1, default: -15 },
      { key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 30, step: 1, default: 10 },
      { key: 'borderColor', label: 'Line Color', type: 'color', default: '#ffffff' }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw BG (Image 0)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const slashImages = images.slice(1);
      const count = slashImages.length;
      if (!count) return;

      const angleDeg = params.angle ?? -15;
      const spacing = params.spacing ?? 10;
      const borderColor = params.borderColor ?? '#ffffff';

      const angleRad = angleDeg * Math.PI / 180;

      // We calculate the geometry based on a "rotated" width
      // Simple approach: Divide the width into N slots, but apply a skew transform or clip path.

      // Let's use clipping paths. 
      // We divide the X axis.
      // To handle the angle, we need to overshoot the canvas bounds.
      const offset = Math.abs(ch * Math.tan(angleRad));
      const totalW = cw + offset;
      const sliceW = (totalW - (spacing * (count - 1))) / count;

      // Starting X position needs to account for the tilt
      // If angle is negative (top leans left), we start further right?
      // Let's anchor center.

      const startX = angleDeg < 0 ? 0 : -offset;

      for (let i = 0; i < count; i++) {
        const img = slashImages[i];
        if (!img) continue;

        // Calculate polygon points for this slice
        // x1,y0 -> x2,y0 -> x2+skew,y1 -> x1+skew,y1

        const sx1 = startX + i * (sliceW + spacing);
        const sx2 = sx1 + sliceW;

        // Top points (y=0)
        // Bottom points (y=ch), shifted by angle
        const shift = ch * Math.tan(angleRad);

        const p1 = { x: sx1, y: 0 };
        const p2 = { x: sx2, y: 0 };
        const p3 = { x: sx2 - shift, y: ch };
        const p4 = { x: sx1 - shift, y: ch };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.clip();

        // Draw Image (Centered in the bounding box of the slice)
        const minX = Math.min(p1.x, p4.x);
        const maxX = Math.max(p2.x, p3.x);
        const sliceWidth = maxX - minX;

        const imgRatio = img.width / img.height;
        const targetRatio = sliceWidth / ch;
        let isx, isy, isWidth, isHeight;

        if (imgRatio > targetRatio) {
          isHeight = img.height;
          isWidth = isHeight * targetRatio;
          isx = (img.width - isWidth) / 2;
          isy = 0;
        } else {
          isWidth = img.width;
          isHeight = isWidth / targetRatio;
          isx = 0;
          isy = (img.height - isHeight) / 2;
        }

        // We draw the image covering the full rect of the slice bounds
        ctx.drawImage(img, isx, isy, isWidth, isHeight, minX, 0, sliceWidth, ch);

        // Inner shadow for depth
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();

        ctx.restore();

        // Draw Divider Line
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw right border of last item
        if (i === count - 1) {
          ctx.beginPath();
          ctx.moveTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      return { ctx, canvas, images, params };
    }
  },

  editorial: {
    name: 'Editorial',
    params: [
      { key: 'layout', label: 'Layout', type: 'select', options: ['Left Hero', 'Right Hero', 'Top Hero'], default: 'Left Hero' },
      { key: 'split', label: 'Hero Size %', type: 'range', min: 30, max: 80, step: 5, default: 60 },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 20, step: 1, default: 5 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw BG (Image 0)
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const contentImages = images.slice(1);
      const count = contentImages.length;
      if (!count) return;

      const layout = params.layout ?? 'Left Hero';
      const split = (params.split ?? 60) / 100;
      const gap = params.gap ?? 5;

      // Image 1 is Hero. Image 2..N are Grid.
      const heroImg = contentImages[0];
      const gridImages = contentImages.slice(1);
      const gridCount = gridImages.length;

      let heroRect, gridRect;

      if (layout === 'Left Hero') {
        const splitX = (cw * split) - (gap / 2);
        heroRect = { x: 0, y: 0, w: splitX, h: ch };
        gridRect = { x: splitX + gap, y: 0, w: cw - (splitX + gap), h: ch };
      } else if (layout === 'Right Hero') {
        const splitX = (cw * (1 - split)) - (gap / 2);
        gridRect = { x: 0, y: 0, w: splitX, h: ch };
        heroRect = { x: splitX + gap, y: 0, w: cw - (splitX + gap), h: ch };
      } else { // Top Hero
        const splitY = (ch * split) - (gap / 2);
        heroRect = { x: 0, y: 0, w: cw, h: splitY };
        gridRect = { x: 0, y: splitY + gap, w: cw, h: ch - (splitY + gap) };
      }

      const drawImgInRect = (img, r) => {
        if (!img) return;
        ctx.save();
        ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();

        const imgR = img.width / img.height;
        const rectR = r.w / r.h;
        let sx, sy, sw, sh;
        if (imgR > rectR) { sh = img.height; sw = sh * rectR; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / rectR; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, r.x, r.y, r.w, r.h);

        // Inner Border
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.restore();
      };

      // Draw Hero
      drawImgInRect(heroImg, heroRect);

      // Draw Grid
      if (gridCount > 0) {
        let cols, rows;
        const isVerticalGrid = (layout === 'Left Hero' || layout === 'Right Hero');

        // Basic logic to fill the strip
        if (isVerticalGrid) {
          cols = 1;
          rows = gridCount;
          // If too many, maybe 2 cols?
          if (gridCount > 3) cols = 2;
          rows = Math.ceil(gridCount / cols);
        } else {
          rows = 1;
          cols = gridCount;
          if (gridCount > 3) rows = 2;
          cols = Math.ceil(gridCount / rows);
        }

        const cellW = (gridRect.w - (gap * (cols - 1))) / cols;
        const cellH = (gridRect.h - (gap * (rows - 1))) / rows;

        gridImages.forEach((img, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const r = {
            x: gridRect.x + col * (cellW + gap),
            y: gridRect.y + row * (cellH + gap),
            w: cellW,
            h: cellH
          };
          drawImgInRect(img, r);
        });
      }

      return { ctx, canvas, images, params };
    }
  },

  cctv: {
    name: 'CCTV / Security',
    params: [
      { key: 'columns', label: 'Columns', type: 'range', min: 2, max: 5, step: 1, default: 2 },
      { key: 'noise', label: 'Static Noise', type: 'range', min: 0, max: 100, step: 10, default: 20 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw BG (Image 0) - Desaturated/Darkened
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        ctx.save();
        ctx.filter = 'grayscale(100%) brightness(30%)'; // CCTV look
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const screens = images.slice(1);
      const count = screens.length;
      if (!count) return;

      const cols = params.columns ?? 2;
      const rows = Math.ceil(count / cols);
      const gap = 10;
      const margin = 20;

      const availW = cw - (margin * 2);
      const availH = ch - (margin * 2);
      const cellW = (availW - (gap * (cols - 1))) / cols;
      const cellH = (availH - (gap * (rows - 1))) / rows;

      // --- NOISE GENERATION ---
      const noiseLevel = params.noise ?? 20;
      let noisePattern = null;

      if (noiseLevel > 0) {
        // Create a small temp canvas for noise pattern (performance optimization)
        // Instead of generating millions of pixels per frame, we tile a 128x128 texture
        const patCanvas = document.createElement('canvas');
        patCanvas.width = 128;
        patCanvas.height = 128;
        const pCtx = patCanvas.getContext('2d');
        
        const iData = pCtx.createImageData(128, 128);
        const buffer = new Uint32Array(iData.data.buffer);
        
        for (let i = 0; i < buffer.length; i++) {
           // Random gray value
           const gray = (Math.random() * 255) | 0;
           // Alpha based on noiseLevel (max ~255)
           const alpha = (Math.random() * (noiseLevel * 2.55)) | 0; 
           
           // Little-endian (ABGR)
           buffer[i] = (alpha << 24) | (gray << 16) | (gray << 8) | gray;
        }
        
        pCtx.putImageData(iData, 0, 0);
        noisePattern = patCanvas;
      }

      screens.forEach((img, i) => {
        if (!img) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = margin + col * (cellW + gap);
        const y = margin + row * (cellH + gap);

        // Draw Screen
        ctx.save();

        // 1. Image
        const imgR = img.width / img.height;
        const cellR = cellW / cellH;
        let sx, sy, sw, sh;
        if (imgR > cellR) { sh = img.height; sw = sh * cellR; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / cellR; sx = 0; sy = (img.height - sh) / 2; }

        ctx.filter = 'grayscale(20%) contrast(120%)'; // Mild CCTV filter
        ctx.drawImage(img, sx, sy, sw, sh, x, y, cellW, cellH);
        ctx.filter = 'none';

        // 2. Apply Noise Overlay
        if (noisePattern) {
            ctx.save();
            ctx.globalCompositeOperation = 'overlay'; // Blends nicely with the image
            const pattern = ctx.createPattern(noisePattern, 'repeat');
            ctx.fillStyle = pattern;
            ctx.fillRect(x, y, cellW, cellH);
            ctx.restore();
        }

        // 3. Scanlines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let ly = y; ly < y + cellH; ly += 4) {
          ctx.fillRect(x, ly, cellW, 1);
        }

        // 4. UI Overlays
        // Red REC dot
        if (Math.floor(Date.now() / 1000) % 2 === 0 || true) { // Always show for static export
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(x + cellW - 20, y + 20, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Text
        ctx.fillStyle = '#00ff00';
        ctx.font = '14px monospace';
        ctx.fillText(`CAM ${i + 1}`, x + 10, y + 25);

        // Date
        const date = new Date();
        const timeStr = date.toLocaleTimeString();
        ctx.fillText(timeStr, x + 10, y + cellH - 10);

        // Border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, cellW, cellH);

        ctx.restore();
      });

      return { ctx, canvas, images, params };
    }
  },

  bubbles: {
    name: 'Bubbles',
    params: [
      { key: 'minSize', label: 'Min Size', type: 'range', min: 50, max: 200, step: 10, default: 80 },
      { key: 'maxSize', label: 'Max Size', type: 'range', min: 150, max: 400, step: 10, default: 250 },
      { key: 'salt', label: 'Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw BG
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        ctx.save();
        ctx.filter = 'blur(8px) brightness(60%)'; // Blurred BG for bubbles
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const bubbleImages = images.slice(1);
      const count = bubbleImages.length;
      const salt = params.salt ?? 1;
      const minSize = params.minSize ?? 80;
      const maxSize = params.maxSize ?? 250;

      // Deterministic Random
      const seededRandom = (idx, channel) => {
        const s = (idx + 1) * (salt + 1) * (channel * 17.3);
        const x = Math.sin(s) * 43758.5453;
        return x - Math.floor(x);
      };

      // Simple packing logic: Random positions, try not to overlap too much?
      // For simplicity in a canvas effect, we'll place them in a rough grid but with heavy jitter.

      bubbleImages.forEach((img, i) => {
        if (!img) return;

        // Random size
        const rRand = seededRandom(i, 1);
        const diameter = minSize + rRand * (maxSize - minSize);
        const radius = diameter / 2;

        // Position
        const xRand = seededRandom(i, 2);
        const yRand = seededRandom(i, 3);

        // Keep somewhat centered
        const x = (cw * 0.1) + xRand * (cw * 0.8);
        const y = (ch * 0.1) + yRand * (ch * 0.8);

        ctx.save();

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.closePath();
        // Fill for shadow
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Clip
        ctx.shadowColor = 'transparent';
        ctx.clip();

        // Draw Image Centered in Circle
        const ir = img.width / img.height;
        // We want to cover the circle (aspect ratio 1)
        let sx, sy, sw, sh;
        if (ir > 1) { sh = img.height; sw = sh; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, x - radius, y - radius, diameter, diameter);

        // Shine / Gloss
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        const grad = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
        grad.addColorStop(0, 'rgba(255,255,255,0.4)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Border Ring
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
      });

      return { ctx, canvas, images, params };
    }
  },




































  shattered: {
    name: 'Shattered Glass',
    params: [
      { key: 'shards', label: 'Complexity', type: 'range', min: 5, max: 50, step: 1, default: 15 },
      { key: 'gap', label: 'Crack Width', type: 'range', min: 0, max: 20, step: 1, default: 2 },
      { key: 'glassOpacity', label: 'Glass Opacity', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.9 },
      { key: 'seed', label: 'Scatter Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw BG (Image 0)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }

        ctx.save();
        // Slightly darken BG so the glass shards on top pop out
        ctx.filter = 'brightness(50%) blur(2px)';
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const shardImages = images.slice(1);
      const count = shardImages.length;
      if (!count) return;

      const numShards = params.shards ?? 15;
      const gap = params.gap ?? 2;
      const glassOpacity = params.glassOpacity ?? 0.9;
      const seed = params.seed ?? 1;

      // Deterministic Random Generator (LCG)
      // This ensures the same seed always produces the same sequence of numbers
      let _seedState = seed * 12345;
      const rng = () => {
        _seedState = (_seedState * 9301 + 49297) % 233280;
        return _seedState / 233280;
      };

      // Robust Triangle Generation
      const cols = Math.ceil(Math.sqrt(numShards));
      const rows = Math.ceil(numShards / cols);
      const cellW = cw / cols;
      const cellH = ch / rows;

      let vertices = [];
      // Create grid of perturbed vertices
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          // Edges are fixed to canvas, inner points are random
          let x = c * cellW;
          let y = r * cellH;

          if (c > 0 && c < cols && r > 0 && r < rows) {
            x += (rng() - 0.5) * cellW * 0.8;
            y += (rng() - 0.5) * cellH * 0.8;
          }
          vertices.push({ x, y });
        }
      }

      let triangles = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i1 = r * (cols + 1) + c;
          const i2 = i1 + 1;
          const i3 = (r + 1) * (cols + 1) + c;
          const i4 = i3 + 1;

          // Randomly flip the diagonal split for variety using seeded rng
          if (rng() > 0.5) {
            triangles.push([vertices[i1], vertices[i2], vertices[i4]]);
            triangles.push([vertices[i1], vertices[i4], vertices[i3]]);
          } else {
            triangles.push([vertices[i1], vertices[i2], vertices[i3]]);
            triangles.push([vertices[i2], vertices[i4], vertices[i3]]);
          }
        }
      }

      // Shuffle triangles deterministically
      // We assign a random score to each and sort by that score
      triangles.forEach(t => t._sortScore = rng());
      triangles.sort((a, b) => a._sortScore - b._sortScore);

      triangles.forEach((tri, i) => {
        const img = shardImages[i % count];
        if (!img) return;

        ctx.save();

        // Define Triangle Path
        ctx.beginPath();
        ctx.moveTo(tri[0].x, tri[0].y);
        ctx.lineTo(tri[1].x, tri[1].y);
        ctx.lineTo(tri[2].x, tri[2].y);
        ctx.closePath();

        // Clip to this triangle
        ctx.clip();

        // Calculate Bounding Box of triangle for Image Mapping
        const minX = Math.min(tri[0].x, tri[1].x, tri[2].x);
        const maxX = Math.max(tri[0].x, tri[1].x, tri[2].x);
        const minY = Math.min(tri[0].y, tri[1].y, tri[2].y);
        const maxY = Math.max(tri[0].y, tri[1].y, tri[2].y);
        const bw = maxX - minX;
        const bh = maxY - minY;

        const imgR = img.width / img.height;
        const targetR = bw / bh;
        let sx, sy, sw, sh;
        if (imgR > targetR) { sh = img.height; sw = sh * targetR; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / targetR; sx = 0; sy = (img.height - sh) / 2; }

        // Draw the Shard Image
        // Apply transparency here
        ctx.globalAlpha = glassOpacity;
        ctx.drawImage(img, sx, sy, sw, sh, minX, minY, bw, bh);

        // Add a "Glass Sheen" gradient over the shard
        // This makes it look reflective even if opacity is low
        if (glassOpacity < 1.0) {
          const grad = ctx.createLinearGradient(minX, minY, maxX, maxY);
          grad.addColorStop(0, 'rgba(255,255,255,0.2)');
          grad.addColorStop(0.5, 'rgba(255,255,255,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.1)');
          ctx.fillStyle = grad;
          ctx.globalCompositeOperation = 'source-atop'; // Only draw on top of the image we just drew
          ctx.fill();
        }

        ctx.restore();

        // Draw Cracks (on top of everything, fully opaque)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tri[0].x, tri[0].y);
        ctx.lineTo(tri[1].x, tri[1].y);
        ctx.lineTo(tri[2].x, tri[2].y);
        ctx.closePath();

        ctx.lineWidth = gap;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; // Dark inner crack
        ctx.stroke();

        // Highlight edge for depth (thin white line)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.stroke();
        ctx.restore();
      });

      return { ctx, canvas, images, params };
    }
  },

  comicLayout: {
    name: 'Comic Page',
    params: [
      { key: 'gutter', label: 'Gutter Size', type: 'range', min: 0, max: 20, step: 1, default: 8 },
      { key: 'border', label: 'Border Width', type: 'range', min: 0, max: 10, step: 1, default: 3 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0) - usually white/black for comic, but we use Img 0 dimmed
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.save();
        ctx.globalAlpha = 0.2; // Very faint bg for comic style
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const panels = images.slice(1);
      const count = panels.length;
      if (!count) return;

      const gutter = params.gutter ?? 8;
      const border = params.border ?? 3;
      const margin = 20;

      // Layout Generation Logic
      // Distribute N images into rows.
      // Rules: 1 to 3 images per row.
      let rows = [];
      let used = 0;
      while (used < count) {
        // Randomly decide col count for this row (1, 2, or 3)
        let remaining = count - used;
        let cols = 1 + Math.floor(Math.random() * 3); // 1-3
        if (cols > remaining) cols = remaining;

        // Don't leave 1 orphan at the end if we can help it
        if (remaining - cols === 1 && cols < 3) {
          cols++; // Grab the orphan
        } else if (remaining - cols === 1) {
          cols--; // Leave 2 for next row
        }

        rows.push(cols);
        used += cols;
      }

      const availH = ch - (margin * 2) - ((rows.length - 1) * gutter);
      // Vary row heights? Let's make them mostly even for stability, or varying.
      // Simple: Even height
      const rowH = availH / rows.length;

      let imgIdx = 0;
      let y = margin;

      rows.forEach((cols) => {
        const availW = cw - (margin * 2) - ((cols - 1) * gutter);
        // Vary col widths? 
        // Let's create varying widths for dynamic look
        let widths = [];
        let totalRatio = 0;
        for (let c = 0; c < cols; c++) {
          let r = 1 + Math.random() * 0.5; // 1.0 to 1.5 variation
          widths.push(r);
          totalRatio += r;
        }

        let x = margin;
        for (let c = 0; c < cols; c++) {
          const w = (widths[c] / totalRatio) * availW;
          const h = rowH;
          const img = panels[imgIdx];
          imgIdx++;

          if (img) {
            ctx.save();
            // Draw Panel BG (White)
            ctx.fillStyle = '#fff';
            ctx.fillRect(x, y, w, h);

            // Clip
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();

            // Draw Image
            const ir = img.width / img.height;
            const tr = w / h;
            let sx, sy, sw, sh;
            if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
            else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
            ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);

            // Inner Shadow/Gradients for drama?

            ctx.restore();

            // Border
            ctx.strokeStyle = '#000';
            ctx.lineWidth = border;
            ctx.strokeRect(x, y, w, h);
          }

          x += w + gutter;
        }
        y += rowH + gutter;
      });

      return { ctx, canvas, images, params };
    }
  },

  isometricGrid: {
    name: 'Isometric Grid',
    params: [
      { key: 'size', label: 'Tile Size', type: 'range', min: 50, max: 300, step: 10, default: 150 },
      { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 20, step: 1, default: 5 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const tileImages = images.slice(1);
      const count = tileImages.length;
      if (!count) return;

      const tileSize = params.size ?? 150; // Side length of the diamond
      const gap = params.gap ?? 5;

      // Isometric Math:
      // Diamond width = sqrt(3) * size? Or simple 2:1 ratio diamonds.
      // Standard Iso: Width = 2 * size, Height = size.
      const isoW = tileSize * 1.732; // sqrt(3)
      const isoH = tileSize; // flattened

      const originX = cw / 2;
      const originY = ch * 0.2; // Start higher up

      // Grid Loop
      // We need to map grid (i, j) to screen (x, y)
      // x = (i - j) * width / 2
      // y = (i + j) * height / 2

      // Arrange images in a rough diamond shape or rectangular iso grid
      const gridSize = Math.ceil(Math.sqrt(count));

      let imgIdx = 0;
      // Centering logic approx
      const startOffset = gridSize / 2;

      // Iterate diagonally to fill from back to front order?
      // Z-ordering: y increases down.
      for (let row = 0; row < gridSize * 2; row++) {
        for (let col = 0; col < gridSize * 2; col++) {
          // Simple mapping: just place N images in a spiral or grid
          if (imgIdx >= count) break;

          // Convert linear idx to grid (r, c)
          // Let's simpler: fixed grid scan
        }
      }

      // Simpler loop: linear placement with Iso offset
      // Columns and rows
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (imgIdx >= count) break;
          const img = tileImages[imgIdx];
          if(!img) return;
          imgIdx++;

          // Iso Transform
          // Center the grid: 
          const gridCX = (cols - 1) / 2;
          const gridCY = (rows - 1) / 2;

          const ii = c - gridCX;
          const jj = r - gridCY;

          const x = originX + (ii - jj) * ((isoW + gap) / 2);
          const y = (ch / 2) + (ii + jj) * ((isoH + gap) / 2); // Center vertically

          // Draw Diamond
          ctx.save();
          ctx.translate(x, y);

          // Draw path
          ctx.beginPath();
          ctx.moveTo(0, -isoH / 2);
          ctx.lineTo(isoW / 2, 0);
          ctx.lineTo(0, isoH / 2);
          ctx.lineTo(-isoW / 2, 0);
          ctx.closePath();

          // Shadow
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 10;
          ctx.fillStyle = '#000';
          ctx.fill();

          ctx.shadowColor = 'transparent';
          ctx.clip();

          // Draw Image (Cover)
          // Need to map rect to diamond? Or just draw rect centered and clip.
          // Rect clip is easiest.
          const imgR = img.width / img.height;
          const targetR = isoW / isoH;
          let sx, sy, sw, sh;
          // Map to bounding box of diamond (isoW x isoH)
          if (imgR > targetR) { sh = img.height; sw = sh * targetR; sx = (img.width - sw) / 2; sy = 0; }
          else { sw = img.width; sh = sw / targetR; sx = 0; sy = (img.height - sh) / 2; }

          ctx.drawImage(img, sx, sy, sw, sh, -isoW / 2, -isoH / 2, isoW, isoH);

          // Highlight edges (Top Left brighter)
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();
        }
      }

      return { ctx, canvas, images, params };
    }
  },

  radialBurst: {
    name: 'Radial Burst',
    params: [
      { key: 'centerGap', label: 'Center Gap', type: 'range', min: 0, max: 200, step: 10, default: 50 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.save();
        // Zoom blur effect for background?
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Light overlay
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const sliceImages = images.slice(1);
      const count = sliceImages.length;
      if (!count) return;

      const centerGap = params.centerGap ?? 50;
      const cx = cw / 2;
      const cy = ch / 2;
      const maxRadius = Math.sqrt(cx * cx + cy * cy) + 50; // Cover corners

      const anglePerSlice = (Math.PI * 2) / count;

      sliceImages.forEach((img, i) => {
        if (!img) return;

        const startAngle = (i * anglePerSlice) - (Math.PI / 2); // Start at top
        const endAngle = startAngle + anglePerSlice;

        ctx.save();

        // Create Wedge Path
        ctx.beginPath();
        // Inner arc
        ctx.arc(cx, cy, centerGap, startAngle, endAngle);
        // Outer arc
        ctx.arc(cx, cy, maxRadius, endAngle, startAngle, true); // draw backward
        ctx.closePath();

        // Shadow/Glow behind slice
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.fill(); // Fill shadow

        ctx.clip(); // Clip to wedge

        // Map Image
        // Calculate center of wedge to map image center
        const midAngle = startAngle + (anglePerSlice / 2);
        const midDist = (centerGap + maxRadius) / 2;
        const wx = cx + Math.cos(midAngle) * midDist;
        const wy = cy + Math.sin(midAngle) * midDist;

        // We essentially want to fill the wedge.
        // Easiest is to draw image covering the bounding box of the wedge, centered on wedge center
        // Or rotate context to align with wedge

        ctx.translate(cx, cy);
        ctx.rotate(midAngle + Math.PI / 2); // Align vertical

        // Now draw image centered at y = -midDist?
        // Image should be upright relative to screen or relative to wedge?
        // Relative to wedge (spinning) is standard for burst.

        const wedgeH = maxRadius - centerGap;
        const wedgeW_Inner = 2 * centerGap * Math.tan(anglePerSlice / 2);
        const wedgeW_Outer = 2 * maxRadius * Math.tan(anglePerSlice / 2);
        const wedgeMaxW = wedgeW_Outer;

        const ir = img.width / img.height;
        const tr = wedgeMaxW / wedgeH;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        // Draw at offset
        ctx.drawImage(img, sx, sy, sw, sh, -wedgeMaxW / 2, -maxRadius, wedgeMaxW, maxRadius * 2);
        // Note: Y positioning is tricky, just covering the area is enough

        ctx.restore();

        // Separator Lines
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(startAngle) * centerGap, cy + Math.sin(startAngle) * centerGap);
        ctx.lineTo(cx + Math.cos(startAngle) * maxRadius, cy + Math.sin(startAngle) * maxRadius);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      return { ctx, canvas, images, params };
    }
  },

  glitchMosaic: {
    name: 'Glitch Mosaic',
    params: [
      { key: 'intensity', label: 'Chaos', type: 'range', min: 1, max: 20, step: 1, default: 5 },
      { key: 'scale', label: 'Block Size', type: 'range', min: 10, max: 100, step: 5, default: 40 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        // Draw normal
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      if (N === 1) return;
      const glitchImages = images.slice(1);
      const count = glitchImages.length;

      const intensity = params.intensity ?? 5; // Number of passes/density
      const blockSize = params.scale ?? 40;

      // Randomly copy blocks from source images onto the canvas
      const numBlocks = (cw / blockSize) * (ch / blockSize) * (intensity / 10);

      for (let i = 0; i < numBlocks; i++) {
        const img = glitchImages[Math.floor(Math.random() * count)];
        if (!img) continue;

        // Dest rect
        const dx = Math.floor(Math.random() * (cw / blockSize)) * blockSize;
        const dy = Math.floor(Math.random() * (ch / blockSize)) * blockSize;
        const w = blockSize * (1 + Math.floor(Math.random() * 3)); // 1-3 blocks wide
        const h = blockSize * (1 + Math.floor(Math.random() * 2)); // 1-2 blocks high

        // Source rect (random part of image)
        const sx = Math.random() * (img.width - w);
        const sy = Math.random() * (img.height - h);

        ctx.save();
        // Random blend mode for glitch feel
        const blendModes = ['source-over', 'overlay', 'hard-light', 'screen', 'difference'];
        ctx.globalCompositeOperation = blendModes[Math.floor(Math.random() * blendModes.length)];
        ctx.globalAlpha = 0.7 + Math.random() * 0.3;

        ctx.drawImage(img, sx, sy, w, h, dx, dy, w, h);

        // Occasional Color Shift border
        if (Math.random() > 0.8) {
          ctx.strokeStyle = Math.random() > 0.5 ? '#0ff' : '#f0f';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx, dy, w, h);
        }
        ctx.restore();
      }

      // Add scanlines over top
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 0; y < ch; y += 4) {
        ctx.fillRect(0, y, cw, 2);
      }

      return { ctx, canvas, images, params };
    }
  },

  versus: {
    name: 'Versus',
    params: [
      { key: 'angle', label: 'Split Angle', type: 'range', min: -45, max: 45, step: 1, default: 15 },
      { key: 'gap', label: 'Divider Width', type: 'range', min: 0, max: 50, step: 1, default: 10 },
      { key: 'color', label: 'Divider Color', type: 'color', default: '#ff0000' }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.save();
        ctx.filter = 'grayscale(100%) brightness(30%)'; // Dark dramatic BG
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const fighters = images.slice(1);
      const count = fighters.length; // Ideally 2, but we can cycle
      if (!count) return;

      const angle = (params.angle ?? 15) * Math.PI / 180;
      const gap = params.gap ?? 10;
      const color = params.color ?? '#ff0000';

      // Calculate the split line
      // y = mx + b. We want the line to pass through center (cw/2, ch/2)
      // The x-offset at top (y=0) and bottom (y=ch) due to angle
      const offsetX = (ch / 2) * Math.tan(angle);

      // Points for Left Side Polygon
      // Top Left, Top Middle-ish, Bottom Middle-ish, Bottom Left
      const p1 = { x: 0, y: 0 };
      const p2 = { x: (cw / 2) + offsetX - (gap / 2), y: 0 };
      const p3 = { x: (cw / 2) - offsetX - (gap / 2), y: ch };
      const p4 = { x: 0, y: ch };

      // Points for Right Side Polygon
      const p5 = { x: (cw / 2) + offsetX + (gap / 2), y: 0 };
      const p6 = { x: cw, y: 0 };
      const p7 = { x: cw, y: ch };
      const p8 = { x: (cw / 2) - offsetX + (gap / 2), y: ch };

      // Helper to draw image in poly
      const drawSide = (img, points, alignLeft) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.clip();

        // Draw Image
        // For Versus, we usually want the character centered in their half
        // Simple cover logic over the bounding box of the poly
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const w = maxX - minX;

        const r = img.width / img.height;
        const cr = w / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }

        // If alignLeft (Player 1), maybe bias crop to right? If alignRight (Player 2), bias to left?
        // Let's stick to center crop for safety.
        ctx.drawImage(img, sx, sy, sw, sh, minX, 0, w, ch);

        // Inner shadow
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = alignLeft ? -10 : 10;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.stroke(); // Trigger shadow

        ctx.restore();
      };

      // Player 1 (Left)
      if (fighters[0]) drawSide(fighters[0], [p1, p2, p3, p4], true);

      // Player 2 (Right) - If missing, use Player 1 again? Or empty?
      if (fighters[1]) drawSide(fighters[1], [p5, p6, p7, p8], false);
      else if (fighters[0]) drawSide(fighters[0], [p5, p6, p7, p8], false); // Mirror match fallback

      // Draw Divider Line
      ctx.save();
      ctx.beginPath();
      // Line down the middle gap
      ctx.moveTo((cw / 2) + offsetX, 0);
      ctx.lineTo((cw / 2) - offsetX, ch);
      ctx.lineWidth = gap;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.stroke();

      // White core for energy feel
      ctx.lineWidth = gap / 3;
      ctx.strokeStyle = '#fff';
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.restore();

      return { ctx, canvas, images, params };
    }
  },

  barcode: {
    name: 'Barcode',
    params: [
      { key: 'strips', label: 'Strip Count', type: 'range', min: 10, max: 100, step: 2, default: 40 },
      { key: 'mode', label: 'Direction', type: 'select', options: ['Vertical', 'Horizontal'], default: 'Vertical' }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      if (N === 1) return;

      const slices = images.slice(1);
      const count = slices.length;
      if (!count) return;

      const numStrips = params.strips ?? 40;
      const isVert = params.mode === 'Vertical';

      const stripSize = isVert ? cw / numStrips : ch / numStrips;

      for (let i = 0; i < numStrips; i++) {
        // Cycle through available content images
        const img = slices[i % count];
        if (!img) continue;

        const x = isVert ? i * stripSize : 0;
        const y = isVert ? 0 : i * stripSize;
        const w = isVert ? stripSize : cw;
        const h = isVert ? ch : stripSize;

        // Smart Crop:
        // We want to sample the part of the image that corresponds to this strip's position
        // so the final result looks like a composite image, not just repeated strips.
        // Or do we want distinct slices? 
        // "Barcode" usually implies distinct slices.
        // Let's do distinct slices from center of images.

        const imgR = img.width / img.height;
        const stripR = w / h;
        let sx, sy, sw, sh;

        // Center crop the strip area from the image
        if (imgR > stripR) {
          sh = img.height;
          sw = sh * stripR;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          sw = img.width;
          sh = sw / stripR;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        // Optional: If we want "DNA" look, we might randomly offset the sample x/y
        // But strict center crop is cleaner.

        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);

        // Thin black separator line
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        if (isVert) ctx.fillRect(x + w - 1, y, 1, h);
        else ctx.fillRect(x, y + h - 1, w, 1);
      }

      return { ctx, canvas, images, params };
    }
  },

  triptych: {
    name: 'Triptych',
    params: [
      { key: 'gap', label: 'Gap Size', type: 'range', min: 0, max: 50, step: 1, default: 20 },
      { key: 'border', label: 'Border', type: 'range', min: 0, max: 20, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.save();
        ctx.filter = 'blur(10px) brightness(40%)'; // Heavy blur for background gallery feel
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const panels = images.slice(1);
      const count = panels.length;
      if (!count) return;

      const gap = params.gap ?? 20;
      const border = params.border ?? 0;

      // Calculate layout
      // We want to center the group of panels
      // Width of one panel?
      // Available width = cw - (gap * (count - 1)) - (margin * 2)
      const margin = 40;
      const totalGap = gap * (count - 1);
      const availableW = cw - (margin * 2) - totalGap;
      const panelW = availableW / count;
      const panelH = ch - (margin * 2);

      panels.forEach((img, i) => {
        if (!img) return;
        const x = margin + i * (panelW + gap);
        const y = margin;

        ctx.save();

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;

        // Draw Panel BG
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, panelW, panelH);

        // Clip inner
        const contentX = x + border;
        const contentY = y + border;
        const contentW = panelW - (border * 2);
        const contentH = panelH - (border * 2);

        ctx.beginPath();
        ctx.rect(contentX, contentY, contentW, contentH);
        ctx.clip();

        // Draw Image
        const ir = img.width / img.height;
        const tr = contentW / contentH;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.shadowColor = 'transparent'; // clear shadow for image
        ctx.drawImage(img, sx, sy, sw, sh, contentX, contentY, contentW, contentH);

        ctx.restore();
      });

      return { ctx, canvas, images, params };
    }
  },

  chessboard: {
    name: 'Chessboard',
    params: [
      { key: 'size', label: 'Grid Size', type: 'range', min: 2, max: 10, step: 1, default: 4 },
      { key: 'opacity', label: 'Check Opacity', type: 'range', min: 0, max: 1, step: 0.1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0) - This will be visible in the "empty" squares
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      if (N === 1) return;

      const pieces = images.slice(1);
      const count = pieces.length;
      if (!count) return;

      const gridSize = params.size ?? 4;
      const opacity = params.opacity ?? 1;

      const cellW = cw / gridSize;
      const cellH = ch / gridSize;

      let imgIdx = 0;

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          // Checker pattern: (row + col) is even vs odd
          // We place images on one parity, leave the other transparent (showing BG)
          // Or we cycle images through all?
          // "Chessboard" implies alternating.

          if ((r + c) % 2 === 0) {
            const img = pieces[imgIdx % count];
            if (!img) continue;

            // Increment imgIdx only if we used one, or cycle logic?
            // Let's increment.
            imgIdx++;

            const x = c * cellW;
            const y = r * cellH;

            ctx.save();
            ctx.globalAlpha = opacity;

            const ir = img.width / img.height;
            const tr = cellW / cellH;
            let sx, sy, sw, sh;
            if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
            else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

            ctx.drawImage(img, sx, sy, sw, sh, x, y, cellW, cellH);

            // Subtle border
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.strokeRect(x, y, cellW, cellH);

            ctx.restore();
          } else {
            // The "Empty" square. 
            // We could draw a semi-transparent black overlay here to distinguish it from the BG image
            const x = c * cellW;
            const y = r * cellH;
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x, y, cellW, cellH);
          }
        }
      }

      return { ctx, canvas, images, params };
    }
  },


  doubleExposure: {
    name: 'Double Exposure',
    params: [
      { key: 'blendMode', label: 'Blend Mode', type: 'select', options: ['Screen', 'Multiply', 'Source In', 'Lighter'], default: 'Screen' },
      { key: 'intensity', label: 'Texture Opacity', type: 'range', min: 0, max: 1, step: 0.1, default: 0.8 },
      { key: 'zoom', label: 'Texture Zoom', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Draw BG (Image 0)
      ctx.fillStyle = '#fff'; // White usually looks best for Double Exp, but we accept dark
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        // Draw BG normally
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      if (N < 2) return; // Need at least Subject + Texture

      const subject = images[1];
      const texture = images[2] || images[1]; // Fallback to self if no texture provided

      const mode = params.blendMode ?? 'Screen';
      const alpha = params.intensity ?? 0.8;
      const zoom = params.zoom ?? 1;

      // Create a temporary canvas for the composite
      const tmp = document.createElement('canvas');
      tmp.width = cw;
      tmp.height = ch;
      const tCtx = tmp.getContext('2d');

      // A. Draw Subject (Silhouette base)
      {
        const r = subject.width / subject.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = subject.height; sw = sh * cr; sx = (subject.width - sw) * 0.5; sy = 0; }
        else { sw = subject.width; sh = sw / cr; sx = 0; sy = (subject.height - sh) * 0.5; }
        tCtx.drawImage(subject, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      // B. Composite Texture
      // "Source In" keeps the texture ONLY where the subject exists (alpha masking)
      tCtx.globalCompositeOperation = 'source-in';

      {
        const r = texture.width / texture.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        // Apply Zoom to texture cropping
        // To zoom in, we reduce the source area size
        if (r > cr) {
          sh = texture.height / zoom;
          sw = sh * cr;
          sx = (texture.width - sw) * 0.5;
          sy = (texture.height - sh) * 0.5;
        } else {
          sw = texture.width / zoom;
          sh = sw / cr;
          sx = (texture.width - sw) * 0.5;
          sy = (texture.height - sh) * 0.5;
        }

        tCtx.globalAlpha = alpha;
        tCtx.drawImage(texture, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      // C. Blend Result onto Main Canvas
      // If the user chose "Screen", we overlay the masked texture onto the BG
      // But usually, Double Exposure involves the subject's original features showing too.

      // 1. Draw original subject faintly to establish features (eyes, etc.)
      ctx.save();
      ctx.globalAlpha = 0.3; // Low opacity for base features
      ctx.drawImage(tmp, 0, 0); // No, tmp has texture now. We need pure subject.
      // Re-draw subject on main
      {
        const r = subject.width / subject.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = subject.height; sw = sh * cr; sx = (subject.width - sw) * 0.5; sy = 0; }
        else { sw = subject.width; sh = sw / cr; sx = 0; sy = (subject.height - sh) * 0.5; }
        ctx.drawImage(subject, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      ctx.restore();

      // 2. Draw the Masked Texture
      ctx.save();
      if (mode === 'Screen') ctx.globalCompositeOperation = 'screen';
      else if (mode === 'Multiply') ctx.globalCompositeOperation = 'multiply';
      else if (mode === 'Lighter') ctx.globalCompositeOperation = 'lighter';
      // 'Source In' was already done in temp, here we just overlay

      ctx.drawImage(tmp, 0, 0);
      ctx.restore();

      return { ctx, canvas, images, params };
    }
  },

  filmRoll3D: {
    name: '3D Film Roll',
    params: [
      { key: 'seed', label: 'Curve Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 },
      { key: 'zoom', label: 'Camera Zoom', type: 'range', min: 0.1, max: 14, step: 0.1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.save();
        ctx.filter = 'blur(5px) brightness(50%)';
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const filmImages = images.slice(1);
      const count = filmImages.length;

      const seed = params.seed ?? 1;
      const zoom = params.zoom ?? 1;

      // Deterministic Random
      let _s = seed * 1234;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // Curve Parameters derived from seed
      // S-Curve: x goes left to right, y oscillates, z oscillates
      const freq = 1 + rng();
      const ampY = ch * 0.3;
      const ampZ = 200; // Depth amplitude

      // We calculate positions for all images first to sort by Z (Painter's Algorithm)
      let frames = [];
      const step = cw / Math.max(count, 1);

      for (let i = 0; i < count; i++) {
        // Normalized position t from 0 to 1
        const t = i / Math.max(count - 1, 1);

        // 3D Point
        // X: Linear spread across screen width, centered
        const wx = (t - 0.5) * cw * 1.2;
        // Y: Sine wave
        const wy = Math.sin(t * Math.PI * freq + (seed * 0.5)) * ampY;
        // Z: Cosine wave (spiraling effect)
        const wz = Math.cos(t * Math.PI * freq + (seed * 0.5)) * ampZ;

        // Project to 2D
        // Perspective projection
        const fov = 800 * zoom;
        const scale = fov / (fov + wz + 400); // +400 pushes scene back so we don't clip z<0

        const x2d = (cw / 2) + wx * scale;
        const y2d = (ch / 2) + wy * scale;

        // Calc Rotation (derivative of curve roughly)
        // dy/dx approx
        const t_next = t + 0.01;
        const wy_next = Math.sin(t_next * Math.PI * freq + (seed * 0.5)) * ampY;
        const dy = wy_next - wy;
        const rot = Math.atan2(dy, 20); // 20 is approx dx step

        frames.push({
          img: filmImages[i],
          x: x2d,
          y: y2d,
          scale,
          z: wz,
          rot
        });
      }

      // Sort: Draw Furthest Z first
      frames.sort((a, b) => b.z - a.z);

      frames.forEach(f => {
        if(!f.img) return;
        const size = 200 * f.scale;
        const w = size;
        const h = size * 0.75; // 4:3 frame

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);

        // Shadow based on depth
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20 * f.scale;
        ctx.shadowOffsetY = 10 * f.scale;

        // Film Frame Border
        ctx.fillStyle = '#111';
        const pad = 10 * f.scale;
        ctx.fillRect(-w / 2 - pad, -h / 2 - pad * 1.5, w + pad * 2, h + pad * 3);

        // Sprocket holes
        ctx.fillStyle = '#fff';
        const holeS = 6 * f.scale;
        for (let k = -w / 2; k < w / 2; k += 20 * f.scale) {
          ctx.fillRect(k, -h / 2 - pad - 2, holeS, holeS);
          ctx.fillRect(k, h / 2 + pad - 4, holeS, holeS);
        }

        // Draw Image
        ctx.shadowColor = 'transparent';
        const img = f.img;
        const r = img.width / img.height;
        const tr = w / h;
        let sx, sy, sw, sh;
        if (r > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }

        ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);

        // Gloss
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(-w / 2, -h / 2, w, h / 2);

        ctx.restore();
      });

      return { ctx, canvas, images, params };
    }
  },

  jigsawPuzzle: {
    name: 'Jigsaw Puzzle',
    params: [
      { key: 'pieces', label: 'Piece Count', type: 'range', min: 4, max: 64, step: 1, default: 16 },
      { key: 'seed', label: 'Puzzle Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if (r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) * 0.5; sy = 0; }
        else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) * 0.5; }
        ctx.save();
        ctx.filter = 'brightness(40%)';
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();
      }

      if (N === 1) return;

      const puzzleImages = images.slice(1);
      const pCount = puzzleImages.length;

      const numPieces = params.pieces ?? 16;
      const seed = params.seed ?? 1;

      // Deterministic Random
      let _s = seed * 5678;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      const cols = Math.ceil(Math.sqrt(numPieces));
      const rows = Math.ceil(numPieces / cols);
      const pieceW = cw / cols;
      const pieceH = ch / rows;

      // Jigsaw Logic:
      // Each piece has 4 sides: Top, Right, Bottom, Left.
      // 0 = flat (edge), 1 = tab out, -1 = tab in.
      // We store vertical edges and horizontal edges grids.

      // Vertical edges (between cols): size rows x (cols-1)
      let vEdges = [];
      for (let r = 0; r < rows; r++) {
        let rowEdges = [];
        for (let c = 0; c < cols - 1; c++) rowEdges.push(rng() > 0.5 ? 1 : -1);
        vEdges.push(rowEdges);
      }

      // Horizontal edges (between rows): size (rows-1) x cols
      let hEdges = [];
      for (let r = 0; r < rows - 1; r++) {
        let rowEdges = [];
        for (let c = 0; c < cols; c++) rowEdges.push(rng() > 0.5 ? 1 : -1);
        hEdges.push(rowEdges);
      }

      const tabSize = Math.min(pieceW, pieceH) * 0.25;

      // Helper to trace a puzzle path
      const tracePiece = (ctx, r, c, startX, startY, w, h) => {
        const top = r === 0 ? 0 : hEdges[r - 1][c]; // 1 or -1. Note: if -1 from above, it's +1 for us (tab in vs tab out is relative)
        // Actually, let's standardize: 
        // Edge matrix value 1 means "Protrudes Right/Bottom". -1 means "Protrudes Left/Top".

        const right = c === cols - 1 ? 0 : vEdges[r][c];
        const bottom = r === rows - 1 ? 0 : hEdges[r][c];
        const left = c === 0 ? 0 : vEdges[r][c - 1];

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        // Top Edge
        if (r === 0) {
          ctx.lineTo(startX + w, startY);
        } else {
          // Previous row's bottom edge. If it was 1 (down), it comes IN to us (-1).
          // hEdges[r-1][c] == 1 => Tab goes DOWN into current piece.
          // So we draw a tab pointing IN (down).
          // Curve logic is complex, simplified cubic bezier:
          const dir = hEdges[r - 1][c]; // 1 = down (in), -1 = up (out)
          curveEdge(ctx, startX, startY, startX + w, startY, dir, false);
        }

        // Right Edge
        if (c === cols - 1) {
          ctx.lineTo(startX + w, startY + h);
        } else {
          const dir = vEdges[r][c]; // 1 = right (out), -1 = left (in)
          curveEdge(ctx, startX + w, startY, startX + w, startY + h, dir, true);
        }

        // Bottom Edge
        if (r === rows - 1) {
          ctx.lineTo(startX, startY + h);
        } else {
          const dir = hEdges[r][c]; // 1 = down (out), -1 = up (in)
          // We draw right to left
          curveEdge(ctx, startX + w, startY + h, startX, startY + h, dir, false);
        }

        // Left Edge
        if (c === 0) {
          ctx.lineTo(startX, startY);
        } else {
          const dir = vEdges[r][c - 1]; // 1 = right (into us, so in), -1 = left (out)
          // Drawing bottom to top
          // Prev col edge was 1 (right). So it comes INTO us.
          // We need to invert logic slightly for tracing direction?
          // Actually, simplest is to define shape relative to line.
          // dir=1 means points Right. 
          curveEdge(ctx, startX, startY + h, startX, startY, dir, true);
        }

        ctx.closePath();
      };

      // Bezier curve helper
      const curveEdge = (ctx, x1, y1, x2, y2, dir, isVertical) => {
        // Dir: 1 or -1. 
        // For horizontal line (top/bottom), 1 means Down, -1 means Up.
        // For vertical line (left/right), 1 means Right, -1 means Left.

        // But we are traversing the perimeter. 
        // Top: L->R. Bottom: R->L. Right: T->B. Left: B->T.
        // This flips the meaning of "out/in" relative to the line normal.
        // Let's rely on visual "neck" size.

        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;

        if (dir === 0) { ctx.lineTo(x2, y2); return; }

        // Tab geometry
        const neck = 0.2;
        const head = 0.5; // offset magnitude

        // Vector along line
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);

        // Normal vector (rotated 90 deg)
        // (dy, -dx)
        let nx = dy;
        let ny = -dx;

        // Normalize
        nx /= len; ny /= len;

        // Apply magnitude
        // If we are Top Edge (L->R), Normal points UP (-y). 
        // If dir is 1 (Down/In), we want opposite of Normal.

        // Simplified: Just calculate 3 points for the tab.
        // Base1, Tip, Base2.

        // We'll use bezier for smooth puzzle look.
        //   p1-------p2   p5-------p6
        //            |   |
        //            p3--p4

        const s = tabSize * dir; // flip based on tab direction

        // This part is tricky to get perfect 0-gap deterministically without a library,
        // but simple cubic to a point works.

        // Midpoint
        const mx = x1 + dx * 0.5;
        const my = y1 + dy * 0.5;

        // Tab Tip
        const tx = mx + nx * s;
        const ty = my + ny * s;

        ctx.quadraticCurveTo(x1 + dx * 0.4, y1 + dy * 0.4, tx, ty);
        ctx.quadraticCurveTo(x1 + dx * 0.6, y1 + dy * 0.6, x2, y2);
      };

      let imgIdx = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Cycle images or use just one? "Jigsaw" implies 1 image broken up.
          // But we support multiple. If multiple, we change image per piece?
          // That looks like a collage. 
          // If only 1 content image (Img 1), we use that for ALL pieces.

          let img = puzzleImages[0];
          if (pCount > 1) {
            img = puzzleImages[imgIdx % pCount];
            imgIdx++;
          }
          if (!img) continue;

          const x = c * pieceW;
          const y = r * pieceH;

          ctx.save();
          tracePiece(ctx, r, c, x, y, pieceW, pieceH);
          ctx.clip();

          // Draw Image
          // If we are using 1 image, map it relative to canvas
          if (pCount === 1) {
            const ir = img.width / img.height; const cr = cw / ch;
            let sx, sy, sw, sh;
            if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) * 0.5; sy = 0; }
            else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) * 0.5; }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
          } else {
            // Collage mode: Map image to piece bounds
            // Expand slightly for tabs
            const bX = x - tabSize;
            const bY = y - tabSize;
            const bW = pieceW + tabSize * 2;
            const bH = pieceH + tabSize * 2;

            const ir = img.width / img.height;
            const tr = bW / bH;
            let sx, sy, sw, sh;
            if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
            else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
            ctx.drawImage(img, sx, sy, sw, sh, bX, bY, bW, bH);
          }

          // Stroke/Bevel
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();
        }
      }

      return { ctx, canvas, images, params };
    }
  },

  kaleidoscope: {
    name: 'Kaleidoscope',
    params: [
      { key: 'segments', label: 'Segments', type: 'range', min: 4, max: 24, step: 2, default: 8 },
      { key: 'seed', label: 'Pattern Seed', type: 'range', min: 1, max: 100, step: 1, default: 1 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      // 1. BG (Image 0)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, cw, ch);
      }
      // Dark overlay to blend seams
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, cw, ch);

      if (N === 1) return;

      const source = images[1]; // Use Image 1 as the source jewel
      if (!source) return;

      const segments = params.segments ?? 8;
      const seed = params.seed ?? 1;

      // Deterministic Random
      let _s = seed * 999;
      const rng = () => { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; };

      // Calculate wedge angle
      const angle = (Math.PI * 2) / segments;
      const cx = cw / 2;
      const cy = ch / 2;
      const radius = Math.sqrt(cx * cx + cy * cy) + 2;

      // Randomize source crop based on seed
      // We pick a random point in the source image and random rotation
      const srcCenterX = (rng() * 0.6 + 0.2) * source.width;
      const srcCenterY = (rng() * 0.6 + 0.2) * source.height;
      const srcRot = rng() * Math.PI * 2;
      const zoom = 0.5 + rng() * 1.5;

      for (let i = 0; i < segments; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i * angle);

        // Mirror every other segment for true kaleidoscope effect
        if (i % 2 !== 0) {
          ctx.scale(1, -1);
        }

        // Create Wedge Path
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, -angle / 2 - 0.01, angle / 2 + 0.01); // slight overlap
        ctx.closePath();
        ctx.clip();

        // Draw Source
        // We align the "virtual" slice of the source image here
        ctx.rotate(srcRot);
        ctx.scale(zoom, zoom);

        // Center source at 0,0
        ctx.drawImage(source, -srcCenterX, -srcCenterY);

        ctx.restore();
      }

      // Vignette
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      return { ctx, canvas, images, params };
    }
  },

  cinematicBars: {
    name: 'Letterbox',
    params: [
      { key: 'ratio', label: 'Aspect Ratio', type: 'select', options: ['2.35:1 (Cinema)', '16:9 (TV)', '4:3 (Classic)', '1:1 (Square)'], default: '2.35:1 (Cinema)' },
      { key: 'color', label: 'Bar Color', type: 'color', default: '#000000' },
      { key: 'blur', label: 'Blur Background', type: 'range', min: 0, max: 20, step: 1, default: 0 }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;
      
      const color = params.color ?? '#000000';
      const blur = params.blur ?? 0;
      const ratioStr = params.ratio ?? '2.35:1 (Cinema)';
      
      // Parse Ratio
      let targetRatio = 2.35;
      if (ratioStr.includes('16:9')) targetRatio = 16/9;
      else if (ratioStr.includes('4:3')) targetRatio = 4/3;
      else if (ratioStr.includes('1:1')) targetRatio = 1;
      
      // 1. Draw BG (Image 0)
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      
      if (bgImg) {
        const r = bgImg.width / bgImg.height; 
        const cr = cw / ch; // Canvas ratio
        
        // Calculate "Safe Area" height/width based on target ratio
        // We want the safe area to span the full width (usually)
        let safeW = cw;
        let safeH = cw / targetRatio;
        
        // If calculated height is taller than canvas, we conform to height instead
        if (safeH > ch) {
            safeH = ch;
            safeW = ch * targetRatio;
        }
        
        const barH = (ch - safeH) / 2;
        const barW = (cw - safeW) / 2;
        
        // A. Draw Blurred BG (Optional) to fill the bars if user wants
        if (blur > 0) {
            ctx.save();
            ctx.filter = `blur(${blur}px)`;
            let sx, sy, sw, sh;
            if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
            else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
            ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
            ctx.restore();
        }

        // B. Draw Main Image inside the Safe Area
        const tr = safeW / safeH;
        let sx, sy, sw, sh;
        if(r > tr) { sh = bgImg.height; sw = sh * tr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/tr; sx=0; sy=(bgImg.height-sh)*0.5; }
        
        ctx.drawImage(bgImg, sx, sy, sw, sh, barW, barH, safeW, safeH);
        
        // C. Draw Bars (to ensure crisp edges over the blur/bg)
        ctx.fillStyle = color;
        // Top
        if (barH > 0) ctx.fillRect(0, 0, cw, barH);
        // Bottom
        if (barH > 0) ctx.fillRect(0, ch - barH, cw, barH);
        // Left
        if (barW > 0) ctx.fillRect(0, 0, barW, ch);
        // Right
        if (barW > 0) ctx.fillRect(cw - barW, 0, barW, ch);
      }

      return { ctx, canvas, images, params };
    }
  },

  textSpace: {
    name: 'Fade',
    params: [
      { key: 'direction', label: 'Fade Side', type: 'select', options: ['Bottom', 'Top', 'Left', 'Right'], default: 'Bottom' },
      { key: 'size', label: 'Fade Size %', type: 'range', min: 10, max: 100, step: 5, default: 40 },
      { key: 'color', label: 'Color', type: 'color', default: '#000000' }
    ],
    apply: (ctx, canvas, images, params) => {
      const N = images.length;
      if (!N) return;
      const cw = canvas.width;
      const ch = canvas.height;

      const direction = params.direction ?? 'Bottom';
      const sizePerc = (params.size ?? 40) / 100;
      const color = params.color ?? '#000000';

      // 1. Draw BG (Image 0)
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, cw, ch);
      const bgImg = images[0];
      if (bgImg) {
        const r = bgImg.width / bgImg.height; const cr = cw / ch;
        let sx, sy, sw, sh;
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, cw, ch);
      }
      
      // 2. Draw Gradient
      ctx.save();
      const gradSize = (direction === 'Top' || direction === 'Bottom') ? ch * sizePerc : cw * sizePerc;
      
      let x0, y0, x1, y1;
      let rectX=0, rectY=0, rectW=cw, rectH=ch;

      // Hex to RGB for gradient transparency
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0,2), 16);
      const g = parseInt(hex.substring(2,4), 16);
      const b = parseInt(hex.substring(4,6), 16);
      const cSolid = `rgba(${r},${g},${b}, 1)`;
      const cTrans = `rgba(${r},${g},${b}, 0)`;

      if (direction === 'Bottom') {
         x0 = 0; y0 = ch - gradSize; x1 = 0; y1 = ch;
         rectY = ch - gradSize; rectH = gradSize;
      } else if (direction === 'Top') {
         x0 = 0; y0 = gradSize; x1 = 0; y1 = 0;
         rectY = 0; rectH = gradSize;
      } else if (direction === 'Right') {
         x0 = cw - gradSize; y0 = 0; x1 = cw; y1 = 0;
         rectX = cw - gradSize; rectW = gradSize;
      } else { // Left
         x0 = gradSize; y0 = 0; x1 = 0; y1 = 0;
         rectX = 0; rectW = gradSize;
      }

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, cTrans);
      grad.addColorStop(0.4, cSolid); // Reach solid color a bit earlier so text is safe
      grad.addColorStop(1, cSolid);

      ctx.fillStyle = grad;
      ctx.fillRect(rectX, rectY, rectW, rectH);
      
      ctx.restore();

      return { ctx, canvas, images, params };
    }
  }
};

// Helper para obter lista (para a tua UI)
function getAvailableComposites() {
  // get then sorted
  return Object.entries(COMPOSITE_REGISTRY)
    .map(([id, def]) => ({ id, name: def.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
}
