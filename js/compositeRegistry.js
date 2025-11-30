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
      const endColor   = `rgba(${_cE.r}, ${_cE.g}, ${_cE.b}, ${params.endOpacity ?? 0.9})`;

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
    name: 'Pie / Circle',
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
        if(img) {
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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
        ctx.fillRect(-width/2 - borderW, -height/2 - borderW, width + borderW*2, height + borderW*2);

        ctx.shadowColor = 'transparent';
        const ir = img.width / img.height;
        const tr = width / height;
        let sx, sy, sw, sh;
        if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) / 2; }
        
        ctx.drawImage(img, sx, sy, sw, sh, -width/2, -height/2, width, height);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-width/2, -height/2, width, height);
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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
        if(r > cr) { sh = img.height; sw = sh * cr; sx=(img.width-sw)*0.5; sy=0; }
        else { sw = img.width; sh = sw/cr; sx=0; sy=(img.height-sh)*0.5; }
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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

        switch(arrangementMode) {
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
        if(r > cr) { sh = bgImg.height; sw = sh * cr; sx=(bgImg.width-sw)*0.5; sy=0; }
        else { sw = bgImg.width; sh = sw/cr; sx=0; sy=(bgImg.height-sh)*0.5; }
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
};

// Helper para obter lista (para a tua UI)
function getAvailableComposites() {
  // get then sorted
  return Object.entries(COMPOSITE_REGISTRY)
    .map(([id, def]) => ({ id, name: def.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
