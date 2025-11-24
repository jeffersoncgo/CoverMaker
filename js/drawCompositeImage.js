function drawCompositeImageLine() {
  // Define overall dimensions for each slot
  const slotWidth = canvas.width / slotsImages.length;
  const slotTotalHeight = canvas.height / 2;
  const realHeight = slotTotalHeight * Setup.Settings.canvas.baseScale;
  const reflectionHeight = slotTotalHeight * Setup.Settings.canvas.reflectionDistance;
  const targetRatio = slotWidth / realHeight;
  const _cS = Setup.Settings.canvas.overlayColorStartRGB;
  const _cSo = Setup.Settings.canvas.overlayOpacityStart;

  const _cE = Setup.Settings.canvas.overlayColorEndRGB;
  const _cEo = Setup.Settings.canvas.overlayOpacityEnd;
  const startColor = `rgba(${_cS.r}, ${_cS.g}, ${_cS.b}, ${_cSo})`;
  const endColor = `rgba(${_cE.r}, ${_cE.g}, ${_cE.b}, ${_cEo})`;

  slotsImages.forEach((img, i) => {
    if (img) {
      let sx, sy, sWidth, sHeight;
      const imgRatio = img.width / img.height;
      
      // Crop the image to match the target aspect ratio
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
      
      const dx = i * (slotWidth + Setup.Settings.canvas.spacing) - Setup.Settings.canvas.spacing;
      const dy = 0;
      
      sWidth -= Setup.Settings.canvas.spacing * 2;
      sHeight -= Setup.Settings.canvas.spacing * 2;
      
      // Draw the "real" image
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, slotWidth, realHeight);
      
      // Draw the Reflection
      const blurredImg = blurImage(img, Setup.Settings.canvas.blurAmount);
      composite.ctx.save();
      composite.ctx.translate(dx, realHeight + reflectionHeight);
      composite.ctx.scale(1, -1);
      composite.ctx.drawImage(blurredImg, sx, sy, sWidth, sHeight, 0, 0, slotWidth, reflectionHeight);
      composite.ctx.restore();
      
      // Apply Reflection Fade Effect
      const gradient = composite.ctx.createLinearGradient(0, realHeight, 0, realHeight + reflectionHeight);
      gradient.addColorStop(0, startColor);
      gradient.addColorStop(Setup.Settings.canvas.reflectionScale, endColor);
      composite.ctx.fillStyle = gradient;
      composite.ctx.fillRect(dx, realHeight, slotWidth, reflectionHeight);
    }
  });
}

function drawCompositeImageGrid() {
  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 0, baseScale = 1 } = Setup.Settings.canvas;
  const aspectRatio = canvas.width / canvas.height;

  // 🔹 Step 1: Estimate grid layout
  // Landscape canvas → more columns, Portrait → more rows
  const idealCols = aspectRatio > 1 ? Math.ceil(Math.sqrt(N * aspectRatio)) : Math.ceil(Math.sqrt(N / aspectRatio));
  const idealRows = Math.ceil(N / idealCols);

  // 🔹 Step 2: Distribute images into rows
  const rows = [];
  let remaining = N;
  for (let r = 0; r < idealRows; r++) {
    const remainingRows = idealRows - r;
    const colsInRow = Math.ceil(remaining / remainingRows);
    rows.push(colsInRow);
    remaining -= colsInRow;
  }

  // 🔹 Step 3: Compute base row height
  const totalSpacingY = spacing * (rows.length - 1);
  const rowHeight = (canvas.height - totalSpacingY) / rows.length;

  // 🔹 Step 4: Draw each image per row
  let imgIndex = 0;
  let dy = 0;

  for (let r = 0; r < rows.length; r++) {
    const cols = rows[r];
    const totalSpacingX = spacing * (cols - 1);
    const cellWidth = (canvas.width - totalSpacingX) / cols;
    const realHeight = rowHeight * baseScale;

    for (let c = 0; c < cols && imgIndex < N; c++, imgIndex++) {
      const img = slotsImages[imgIndex];
      if (!img) continue;

      const dx = c * (cellWidth + spacing);
      const targetRatio = cellWidth / realHeight;
      const imgRatio = img.width / img.height;

      // Crop image to fit target cell ratio
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

      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, cellWidth, realHeight);
    }

    dy += rowHeight + spacing;
  }
}

function drawCompositeImageMosaic() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const { spacing = 3 } = Setup.Settings.canvas;
  const salt = Setup.Settings.canvas.salt || 1;
  
  // Clear background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Single image: fill canvas
  if (N === 1) {
    const img = slotsImages[0];
    if (img) {
      const imgRatio = img.width / img.height;
      const canvasRatio = canvas.width / canvas.height;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > canvasRatio) {
        sHeight = img.height;
        sWidth = sHeight * canvasRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.width;
        sHeight = sWidth / canvasRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
      }
      
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    }
    return;
  }
  
  // Deterministic random generator using salt
  const seededRandom = (index, channel = 0) => {
    const seed = (index + 1) * (salt + 1) * (channel * 17.3 + 1);
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  
  // Binary Space Partitioning to guarantee 100% coverage
  const cw = canvas.width;
  const ch = canvas.height;
  
  // Create initial regions (rectangles to be filled)
  let regions = [{ x: 0, y: 0, w: cw, h: ch, filled: false }];
  
  // Split regions N times to create N areas
  for (let i = 0; i < N - 1; i++) {
    // Find unfilled region with largest area
    let largestIdx = -1;
    let maxArea = 0;
    
    regions.forEach((region, idx) => {
      if (!region.filled) {
        const area = region.w * region.h;
        if (area > maxArea) {
          maxArea = area;
          largestIdx = idx;
        }
      }
    });
    
    if (largestIdx === -1) break;
    
    const target = regions[largestIdx];
    
    // Determine split direction and ratio using salt
    const rndDir = seededRandom(i, 50);
    const rndRatio = seededRandom(i, 51);
    
    // Split ratio between 30% and 70%
    const splitRatio = 0.30 + (rndRatio * 0.40);
    
    // Choose split direction based on region shape and randomness
    let splitVertical;
    if (target.w > target.h * 1.5) {
      splitVertical = true; // Wide region -> split vertically
    } else if (target.h > target.w * 1.5) {
      splitVertical = false; // Tall region -> split horizontally
    } else {
      splitVertical = rndDir > 0.5; // Square-ish -> use random
    }
    
    // Create two new regions
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
    
    // Replace the split region with two new ones
    regions.splice(largestIdx, 1, r1, r2);
  }
  
  // Now we have exactly N regions that perfectly fill the canvas
  // Sort regions by position (top-to-bottom, left-to-right) to maintain image order
  regions.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 10) return yDiff; // Different rows
    return a.x - b.x; // Same row, sort by x
  });
  
  // Draw each image in its region with subtle rotation and border
  // Images maintain their original slot order
  regions.forEach((region, idx) => {
    const img = slotsImages[idx];
    if (!img) return;
    
    // Add spacing inset
    const x = region.x + spacing;
    const y = region.y + spacing;
    const w = region.w - spacing * 2;
    const h = region.h - spacing * 2;
    
    if (w <= 0 || h <= 0) return;
    
    // Subtle rotation for visual interest (using region position for determinism)
    const rotationSeed = (region.x + region.y + region.w + region.h) * salt;
    const rotationRand = Math.sin(rotationSeed * 12.9898) * 43758.5453;
    const rotation = ((rotationRand - Math.floor(rotationRand)) - 0.5) * 0.08; // ±2.3 degrees
    
    ctx.save();
    
    // Rotate around center of region
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    
    // Draw subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    
    // White border for photo effect
    const borderW = Math.max(2, Math.min(w, h) * 0.012);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2 - borderW, -h / 2 - borderW, w + borderW * 2, h + borderW * 2);
    
    // Draw image (crop to fill region)
    ctx.shadowColor = 'transparent';
    
    const imgRatio = img.width / img.height;
    const regionRatio = w / h;
    let sx, sy, sWidth, sHeight;
    
    if (imgRatio > regionRatio) {
      // Image wider -> crop sides
      sHeight = img.height;
      sWidth = sHeight * regionRatio;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      // Image taller -> crop top/bottom
      sWidth = img.width;
      sHeight = sWidth / regionRatio;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }
    
    ctx.drawImage(img, sx, sy, sWidth, sHeight, -w / 2, -h / 2, w, h);
    
    // Subtle inner border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    
    ctx.restore();
  });
}

function drawCompositeImageCircle() {
  const N = slotsImages.length;
  if (!N) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height);
  
  // Single image in center as circle
  if (N === 1) {
    const img = slotsImages[0];
    if (img) {
      composite.ctx.save();
      composite.ctx.beginPath();
      composite.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      composite.ctx.clip();
      
      const imgRatio = img.width / img.height;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > 1) {
        sHeight = img.height;
        sWidth = sHeight;
        sx = (img.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.width;
        sHeight = sWidth;
        sx = 0;
        sy = (img.height - sHeight) / 2;
      }
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 
        centerX - radius, centerY - radius, radius * 2, radius * 2);
      composite.ctx.restore();
    }
    return;
  }
  
  // Pie chart style for multiple images
  const angleStep = (Math.PI * 2) / N;

  // use salt so we can have different arrangements of angles, looping at 360
  const salt = Setup.Settings.canvas.salt || 1;
  const normalizedSalt = (salt % 360) / 360;

  slotsImages.forEach((img, i) => {
    if (!img) return;
    
    const startAngle = angleStep * i + (normalizedSalt * Math.PI * 2);
    const endAngle = angleStep * (i + 1) + (normalizedSalt * Math.PI * 2);
    
    composite.ctx.save();
    
    // Create pie slice path
    composite.ctx.beginPath();
    composite.ctx.moveTo(centerX, centerY);
    composite.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    composite.ctx.closePath();
    composite.ctx.clip();
    
    // Calculate position and size to fill the slice
    const sliceCenterAngle = startAngle + angleStep / 2;
    const sliceWidth = radius * 2;
    const sliceHeight = radius * 2;
    
    // Position image in the slice
    const x = centerX + Math.cos(sliceCenterAngle) * radius * 0.3 - sliceWidth / 2;
    const y = centerY + Math.sin(sliceCenterAngle) * radius * 0.3 - sliceHeight / 2;
    
    const imgRatio = img.width / img.height;
    let sx, sy, sWidth, sHeight;
    
    // Scale image to fill slice while maintaining aspect ratio
    if (imgRatio > 1) {
      sHeight = img.height;
      sWidth = sHeight;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = img.width;
      sHeight = sWidth;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }
    
    composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, sliceWidth, sliceHeight);
    
    // Draw slice border
    composite.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    composite.ctx.lineWidth = 2;
    composite.ctx.beginPath();
    composite.ctx.moveTo(centerX, centerY);
    composite.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    composite.ctx.closePath();
    composite.ctx.stroke();
    
    composite.ctx.restore();
  });
}

function drawCompositeImageCollage() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const salt = Setup.Settings.canvas.salt || 1;
  
  // Clear background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Single image: fill canvas
  if (N === 1) {
    const img = slotsImages[0];
    if (img) {
      const imgRatio = img.width / img.height;
      const canvasRatio = canvas.width / canvas.height;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > canvasRatio) {
        sHeight = img.height;
        sWidth = sHeight * canvasRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.width;
        sHeight = sWidth / canvasRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
      }
      
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    }
    return;
  }
  
  // Deterministic random generator using salt
  const seededRandom = (index, channel = 0) => {
    const seed = (index + 1) * (salt + 1) * (channel * 23.7 + 1);
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  
  const cw = canvas.width;
  const ch = canvas.height;
  
  // Draw first image as full background
  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;
    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, cw, ch);
  }
  
  // Dark overlay for contrast
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, cw, ch);
  
  // If only one image, we're done
  if (N === 1) return;
  
  // Remaining images arranged in scattered layout with BSP-like coverage
  const remainingImages = slotsImages.slice(1);
  const numRemaining = remainingImages.length;
  
  if (!numRemaining) return;
  
  // Create grid regions for proper coverage
  const cols = Math.min(Math.ceil(Math.sqrt(numRemaining * 1.5)), 4);
  const rows = Math.ceil(numRemaining / cols);
  
  const cellW = cw / cols;
  const cellH = ch / rows;
  
  // Gap between photos
  const gapSize = Math.max(15, Math.min(cw, ch) * 0.025);
  
  remainingImages.forEach((img, i) => {
    if (!img) return;
    
    const imgIndex = i + 1; // Offset by 1 since first image is background
    
    // Determine base cell position
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    // Base position in grid
    const baseCellX = col * cellW;
    const baseCellY = row * cellH;
    
    // Size variation based on salt - MUCH LARGER NOW
    const sizeRand = seededRandom(imgIndex, 1);
    let sizeFactor;
    
    if (sizeRand < 0.25) {
      sizeFactor = 0.85 + seededRandom(imgIndex, 2) * 0.20; // Large: 85-105%
    } else if (sizeRand < 0.65) {
      sizeFactor = 0.65 + seededRandom(imgIndex, 3) * 0.18; // Medium: 65-83%
    } else {
      sizeFactor = 0.50 + seededRandom(imgIndex, 4) * 0.13; // Small: 50-63%
    }
    
    // Aspect ratio variation
    const aspectRand = seededRandom(imgIndex, 5);
    let aspectRatio;
    
    if (aspectRand < 0.35) {
      aspectRatio = 0.65 + seededRandom(imgIndex, 6) * 0.3; // Portrait
    } else if (aspectRand < 0.70) {
      aspectRatio = 0.90 + seededRandom(imgIndex, 7) * 0.25; // Square-ish
    } else {
      aspectRatio = 1.20 + seededRandom(imgIndex, 8) * 0.5; // Landscape
    }
    
    const baseSize = Math.max(cellW, cellH) * 1.2; // Use max instead of min, with 20% boost
    const width = baseSize * sizeFactor;
    const height = width / aspectRatio;
    
    // Position within cell with offset for variety
    const offsetX = (seededRandom(imgIndex, 10) - 0.5) * (cellW - width) * 0.6;
    const offsetY = (seededRandom(imgIndex, 11) - 0.5) * (cellH - height) * 0.6;
    
    const x = baseCellX + (cellW - width) / 2 + offsetX;
    const y = baseCellY + (cellH - height) / 2 + offsetY;
    
    // Rotation for dynamic look
    const rotation = (seededRandom(imgIndex, 12) - 0.5) * 0.25; // ±7 degrees
    
    // Layering with depth
    const zOffset = seededRandom(imgIndex, 13);
    
    ctx.save();
    
    // Translate to center for rotation
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    
    // Shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 15 + zOffset * 15;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6 + zOffset * 8;
    
    // White polaroid border
    const borderWidth = Math.max(6, width * 0.025);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-width / 2 - borderWidth, -height / 2 - borderWidth, 
                 width + borderWidth * 2, height + borderWidth * 2);
    
    // Draw image
    ctx.shadowColor = 'transparent';
    
    const imgRatio = img.width / img.height;
    const targetRatio = width / height;
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
    
    ctx.drawImage(img, sx, sy, sWidth, sHeight, -width / 2, -height / 2, width, height);
    
    // Subtle border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    
    ctx.restore();
  });
}

function drawCompositeImageItalicLine() {
  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 0, baseScale = 1, reflectionDistance = 0.5, reflectionScale = 0.5} = Setup.Settings.canvas;

  // 1. Calculate Skew Angle
  const skewDegrees = -(((Setup.Settings.canvas.salt || 0) % 720) - 360);
  const skewAngle = Math.tan((skewDegrees * Math.PI) / 180);

  const slotTotalHeight = canvas.height / 2;
  const realHeight = slotTotalHeight * baseScale;
  
  // This defines the PHYSICAL height of the reflection area
  const reflectionHeight = slotTotalHeight * reflectionDistance; 

  // 2. "Out of Frame" / Buffer Logic
  // We calculate the maximum skew displacement based on the full height (Main + Reflection)
  const totalVisualHeight = realHeight + reflectionHeight;
  const skewOffset = Math.abs(totalVisualHeight * skewAngle);

  // Expand canvas width so edges are pushed out, but skew fills the gaps
  const effectiveCanvasWidth = canvas.width + (skewOffset * 2);
  const slotWidth = effectiveCanvasWidth / N;
  
  const targetRatio = slotWidth / realHeight;

  // 3. Colors
  const _cS = Setup.Settings.canvas.overlayColorStartRGB;
  const _cSo = Setup.Settings.canvas.overlayOpacityStart;
  const _cE = Setup.Settings.canvas.overlayColorEndRGB;
  const _cEo = Setup.Settings.canvas.overlayOpacityEnd;
  const startColor = `rgba(${_cS.r}, ${_cS.g}, ${_cS.b}, ${_cSo})`;
  const endColor = `rgba(${_cE.r}, ${_cE.g}, ${_cE.b}, ${_cEo})`;

  // Start position (Negative offset to center the strip)
  const startOffset = -skewOffset;

  slotsImages.forEach((img, i) => {
    if (!img) return;

    // Image Fitting Logic
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

    const dx = startOffset + i * (slotWidth + spacing) - spacing;
    
    // Adjust source width/height for spacing
    sWidth -= spacing * 2;
    sHeight -= spacing * 2;

    const blurredImg = blurImage(img, Setup.Settings.canvas.blurAmount || 5);

    // --- DRAWING OPERATIONS ---

    // 1. Draw Main Image
    composite.ctx.save();
    composite.ctx.transform(1, 0, skewAngle, 1, dx, 0); 
    composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, slotWidth, realHeight);
    composite.ctx.restore();

    // 2. Draw Reflection Image
    // We use the same transform for perfect alignment.
    // We draw from the bottom (realHeight + reflectionHeight) upwards (negative height) to flip it.
    composite.ctx.save();
    composite.ctx.transform(1, 0, skewAngle, 1, dx, 0);
    composite.ctx.drawImage(
        blurredImg, 
        sx, sy, sWidth, sHeight, 
        0, realHeight + reflectionHeight, // Destination Y (Bottom)
        slotWidth, -reflectionHeight      // Destination Height (Flip Up)
    );
    composite.ctx.restore();

    // 3. Apply Reflection Fade (The Shadow/Killing)
    // This logic now matches your "Line" function exactly.
    composite.ctx.save();
    composite.ctx.transform(1, 0, skewAngle, 1, dx, 0);

    // Gradient covers the physical height of the reflection
    const gradient = composite.ctx.createLinearGradient(0, realHeight, 0, realHeight + reflectionHeight);
    
    // Start color at the top of the reflection
    gradient.addColorStop(0, startColor);
    
    // End color at the 'Scale' percentage. 
    // If Scale is 0.5, it becomes fully opaque halfway down.
    // If Scale is 1.0, it fades all the way to the bottom.
    gradient.addColorStop(Setup.Settings.canvas.reflectionScale || 1, endColor);
    
    composite.ctx.fillStyle = gradient;
    composite.ctx.fillRect(0, realHeight, slotWidth, reflectionHeight);
    composite.ctx.restore();
  });
}

function drawCompositeImageCarousel() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const salt = Setup.Settings.canvas.salt || 1;
  
  // Clear background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Single image: fill canvas
  if (N === 1) {
    const img = slotsImages[0];
    if (img) {
      const imgRatio = img.width / img.height;
      const canvasRatio = canvas.width / canvas.height;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > canvasRatio) {
        sHeight = img.height;
        sWidth = sHeight * canvasRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.width;
        sHeight = sWidth / canvasRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
      }
      
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    }
    return;
  }
  
  const cw = canvas.width;
  const ch = canvas.height;
  
  // Draw first image as full background
  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;
    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, cw, ch);
  }
  
  // Dark overlay for contrast
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, cw, ch);
  
  // If only one image, we're done
  if (N === 1) return;
  
  const centerX = cw / 2;
  const centerY = ch / 2;
  
  // 3D Carousel parameters
  const radiusX = cw * 0.45; // Horizontal radius
  const radiusY = ch * 0.15; // Vertical radius (ellipse for perspective)
  const baseWidth = cw * 0.28;
  const baseHeight = ch * 0.50;
  
  // Rotation offset based on salt for different starting positions
  const rotationOffset = (salt * 0.3) % (Math.PI * 2);
  
  // Remaining images in carousel (skip first one, it's the background)
  const carouselImages = slotsImages.slice(1);
  const carouselCount = carouselImages.length;
  
  if (!carouselCount) return;
  
  // Create array of images with their 3D positions
  const carouselItems = carouselImages.map((img, i) => {
    const angle = (i / carouselCount) * Math.PI * 2 + rotationOffset;
    
    // Calculate 3D position on ellipse
    const x = centerX + Math.cos(angle) * radiusX;
    const y = centerY + Math.sin(angle) * radiusY;
    
    // Z-depth for sorting (cos determines front/back)
    const z = Math.cos(angle);
    
    // Scale based on depth (closer = larger)
    const depthScale = 0.5 + (z + 1) * 0.35; // 0.5 to 1.2
    const width = baseWidth * depthScale;
    const height = baseHeight * depthScale;
    
    // Opacity based on depth
    const opacity = 0.4 + (z + 1) * 0.35; // 0.4 to 1.1 (clamped later)
    
    return {
      img,
      x,
      y,
      z,
      width,
      height,
      opacity: Math.min(1, opacity),
      angle,
      originalIndex: i // Keep original order for reference
    };
  }).filter(item => item.img);
  
  // Sort by z-depth (back to front)
  carouselItems.sort((a, b) => a.z - b.z);
  
  // Draw all images
  carouselItems.forEach(({ img, x, y, z, width, height, opacity, angle }) => {
    ctx.save();
    
    // Apply opacity
    ctx.globalAlpha = opacity;
    
    // Shadow for depth (stronger for front images)
    if (z > 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 15 * (z + 1);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5 * (z + 1);
    }
    
    // Slight rotation for 3D effect
    ctx.translate(x, y);
    const rotationAngle = Math.sin(angle) * 0.1; // ±5.7 degrees
    ctx.rotate(rotationAngle);
    
    // Draw white border/card
    const borderW = Math.max(3, width * 0.02);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-width / 2 - borderW, -height / 2 - borderW, 
                 width + borderW * 2, height + borderW * 2);
    
    // Draw image
    ctx.shadowColor = 'transparent';
    
    const imgRatio = img.width / img.height;
    const targetRatio = width / height;
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
    
    ctx.drawImage(img, sx, sy, sWidth, sHeight, -width / 2, -height / 2, width, height);
    
    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    
    ctx.restore();
  });
}

function drawCompositeImageFanSpread() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const W = canvas.width;
  const H = canvas.height;
  const salt = Setup.Settings.canvas.salt || 1;

  // Clear background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Draw first image as full background
  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = W / H;

    let sX, sY, sW, sH;
    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, W, H);
  }

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, W, H);

  // If only one image, we're done
  if (N === 1) return;

  const centerX = W / 2;
  const centerY = H / 2;

  // Remaining cards to fan out
  const fanCards = slotsImages.slice(1);
  const fanCount = fanCards.length;

  if (!fanCount) return;

  // Fan spread parameters - influenced by salt
  const baseSpreaDeg = 20 + (fanCount * 1.2);
  const maxSpreadDeg = Math.min(50, baseSpreaDeg + (Math.sin(salt) * 10)); // 20-50 degrees
  const maxSpreadRad = maxSpreadDeg * Math.PI / 180;

  // Card dimensions
  const cardBaseW = W * 0.65;
  const cardBaseH = H * 0.70;

  // Compute scale to fit rotated cards
  const testAngle = maxSpreadRad;
  const rotW = Math.abs(cardBaseW * Math.cos(testAngle)) + Math.abs(cardBaseH * Math.sin(testAngle));
  const rotH = Math.abs(cardBaseW * Math.sin(testAngle)) + Math.abs(cardBaseH * Math.cos(testAngle));

  const scale = Math.min(W / rotW, H / rotH) * 0.90;
  const cardW = cardBaseW * scale;
  const cardH = cardBaseH * scale;

  // Lateral offset (cards shift sideways slightly)
  const dx = cardW * 0.04;

  // Vertical offset based on salt
  const dyBase = Math.sin(salt * 0.7) * H * 0.08;

  // Angle spacing
  const half = (fanCount - 1) / 2;
  const anglePerCard = fanCount === 1 ? 0 : (maxSpreadRad * 2) / (fanCount - 1);

  // Draw cards back to front
  for (let i = 0; i < fanCount; i++) {
    const img = fanCards[i];
    if (!img) continue;

    const t = i - half;
    const angle = t * anglePerCard;
    
    // Position with subtle wave pattern
    const x = centerX + t * dx;
    const y = centerY + dyBase + Math.sin(i * 0.5 + salt) * H * 0.02;

    ctx.save();

    // Opacity increases to front
    ctx.globalAlpha = 0.65 + (i / fanCount) * 0.35;

    // Shadow intensity increases toward front
    ctx.shadowColor = `rgba(0, 0, 0, ${0.3 + (i / fanCount) * 0.3})`;
    ctx.shadowBlur = 15 + (i / fanCount) * 15;
    ctx.shadowOffsetX = 4 + t * 2;
    ctx.shadowOffsetY = 6 + (i / fanCount) * 8;

    // Transform to card center
    ctx.translate(x, y);
    ctx.rotate(angle);

    // White card background
    ctx.fillStyle = 'white';
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

    // Draw image inside with padding
    const padding = Math.max(8 * scale, 5);
    const innerW = cardW - padding * 2;
    const innerH = cardH - padding * 2;

    const imgRatio = img.width / img.height;
    const targetRatio = innerW / innerH;

    let sx, sy, sW, sH;
    if (imgRatio > targetRatio) {
      sH = img.height;
      sW = sH * targetRatio;
      sx = (img.width - sW) / 2;
      sy = 0;
    } else {
      sW = img.width;
      sH = sW / targetRatio;
      sx = 0;
      sy = (img.height - sH) / 2;
    }

    ctx.drawImage(img, sx, sy, sW, sH, -innerW / 2, -innerH / 2, innerW, innerH);

    // Subtle border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

    ctx.restore();
  }
}

function drawCompositeImageScatteredStack() {
  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 0 } = Setup.Settings.canvas;
  
  // Book-like stack - all images visible
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Base size to fill most of the canvas
  const baseWidth = canvas.width;
  const baseHeight = canvas.height;
  
  // Draw first image as background (fills entire canvas)
  const bgImg = slotsImages[0];
  if (bgImg) {
    const imgRatio = bgImg.width / bgImg.height;
    const targetRatio = baseWidth / baseHeight;
    let sx, sy, sWidth, sHeight;
    
    if (imgRatio > targetRatio) {
      sHeight = bgImg.height;
      sWidth = sHeight * targetRatio;
      sx = (bgImg.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = bgImg.width;
      sHeight = sWidth / targetRatio;
      sx = 0;
      sy = (bgImg.height - sHeight) / 2;
    }
    
    composite.ctx.drawImage(bgImg, sx, sy, sWidth, sHeight, 0, 0, baseWidth, baseHeight);
  }
  
  // For single image, return after drawing background
  if (N === 1) {
    return;
  }
  
  // Calculate maximum visible cards (excluding background)
  const maxVisible = N - 1;
  
  // --- SALT & RANDOMIZATION LOGIC ---
  
  // We use a default salt of 1 if undefined. 
  // We apply a modulo (%) to keep numbers manageable if the user inputs a huge integer.
  const rawSalt = Setup.Settings.canvas.salt || 1;
  const salt = Math.abs(rawSalt) % 100000; 

  // Helper: Deterministic Random Number Generator
  // Returns a value between -1.0 and 1.0 based on the index and a "channel" (to separate x, y, and rot)
  const getDeterministicNoise = (index, channel) => {
    // We use Math.sin with the salt and index to create a "hash".
    // 12.9898 and 78.233 are arbitrary "magic numbers" often used in shader noise to break patterns.
    const seed = (index + 1) * (salt + 1) * (channel * 12.9898);
    return Math.sin(seed); 
  };

  const maxOffsetX = canvas.width * 0.25; // Increased range for more dramatic scatter
  const maxOffsetY = canvas.height * 0.20;
  const maxRotationRad = 0.5; // ~28 degrees

  // Size reduction per card
  const sizeReduction = 0.03; 
  
  // Draw from back to front (starting from index 1 to skip background)
  for (let i = 0; i < maxVisible; i++) {
    const imgIndex = i + 1; // Skip first image (background)
    const img = slotsImages[imgIndex];
    if (!img) continue;
    
    // Scale logic remains linear so the stack still has depth (smallest at back)
    const scale = 1 - (i * sizeReduction);
    const width = baseWidth * scale;
    const height = baseHeight * scale;
    
    // --- APPLY SALT TO POSITION & ROTATION ---
    
    // Channel 1: Rotation noise
    // Returns -1 to 1, multiplied by max rotation
    const rotation = getDeterministicNoise(i, 1) * maxRotationRad; 

    // Channel 2: X Axis Offset
    const offsetX = getDeterministicNoise(i, 2) * maxOffsetX;

    // Channel 3: Y Axis Offset
    const offsetY = getDeterministicNoise(i, 3) * maxOffsetY;
    
    const x = centerX - width / 2 + offsetX;
    const y = centerY - height / 2 + offsetY;
    
    // Opacity - back cards slightly more transparent
    const opacity = 0.7 + (i / maxVisible) * 0.3;
    
    composite.ctx.save();
    composite.ctx.globalAlpha = opacity;
    
    // Apply rotation around center of the generated offset
    composite.ctx.translate(centerX + offsetX, centerY + offsetY);
    composite.ctx.rotate(rotation);
    composite.ctx.translate(-centerX - offsetX, -centerY - offsetY);
    
    // Draw card shadow
    composite.ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    composite.ctx.shadowBlur = 15;
    composite.ctx.shadowOffsetX = 5;
    composite.ctx.shadowOffsetY = 5;
    
    // Draw white card background
    composite.ctx.fillStyle = 'white';
    composite.ctx.fillRect(x, y, width, height);
    
    // Draw image with padding
    const padding = 10 * scale;
    const imgWidth = width - padding * 2;
    const imgHeight = height - padding * 2;
    const imgRatio = img.width / img.height;
    const targetRatio = imgWidth / imgHeight;
    
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
    
    composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 
      x + padding, y + padding, imgWidth, imgHeight);
    
    // Add subtle border
    composite.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    composite.ctx.lineWidth = 1;
    composite.ctx.strokeRect(x, y, width, height);
    
    composite.ctx.restore();
  }
}

function drawCompositeImageSpiral() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const salt = Setup.Settings.canvas.salt || 1;
  const cw = canvas.width;
  const ch = canvas.height;

  // Clear canvas
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);

  // Draw first image as full background
  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;
    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, cw, ch);
  }

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, cw, ch);

  // If only one image, we're done
  if (N === 1) return;

  // Remaining images for spiral
  const spiralImages = slotsImages.slice(1);
  const spiralCount = spiralImages.length;

  if (!spiralCount) return;

  const centerX = cw / 2;
  const centerY = ch / 2;

  // Better scale factor - ensures last image is still visible
  // Using logarithmic scale instead of exponential for better size distribution
  const minScale = 0.25; // Minimum 25% of initial size
  const maxScale = 1.0;

  // Calculate initial size to fill canvas
  const initialSize = Math.min(cw, ch) * 0.70;

  // Spiral parameters influenced by salt
  const spiralTightness = 0.15 + (Math.abs(Math.sin(salt * 0.5)) * 0.15); // 0.15-0.30
  const rotationSpeed = 2.5 + (Math.abs(Math.cos(salt * 0.7)) * 2); // 2.5-4.5 rotations
  const startAngle = (salt * 0.8) % (Math.PI * 2); // Starting angle based on salt

  spiralImages.forEach((img, i) => {
    if (!img) return;

    // Logarithmic scale distribution (much better than exponential)
    const progress = i / Math.max(spiralCount - 1, 1);
    const scale = maxScale - (progress * (maxScale - minScale));
    const width = initialSize * scale;
    const height = initialSize * scale;

    // Spiral calculation
    const angle = startAngle + (progress * Math.PI * 2 * rotationSpeed);
    const radius = progress * Math.min(cw, ch) * spiralTightness;
    
    const x = centerX - width / 2 + Math.cos(angle) * radius;
    const y = centerY - height / 2 + Math.sin(angle) * radius;

    // Rotation based on spiral angle and salt
    const rotation = angle * 0.15 + (Math.sin(salt + i) * 0.12);

    // Opacity based on position
    const opacity = 0.85 + (progress * 0.15);

    ctx.save();
    ctx.globalAlpha = opacity;

    // Apply rotation around center of image
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(rotation);
    ctx.translate(-x - width / 2, -y - height / 2);

    // Shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12 + progress * 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;

    // White card background
    ctx.fillStyle = 'white';
    ctx.fillRect(x, y, width, height);

    // Draw image with padding
    const padding = Math.max(5, width * 0.025);
    const imgWidth = width - padding * 2;
    const imgHeight = height - padding * 2;
    const imgRatio = img.width / img.height;
    const targetRatio = imgWidth / imgHeight;

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

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 
      x + padding, y + padding, imgWidth, imgHeight);

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    ctx.restore();
  });
}

function drawCompositeImageWaves() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const salt = Setup.Settings.canvas.salt || 1;
  const cw = canvas.width;
  const ch = canvas.height;

  // Clear canvas
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);

  // Draw first image as full background
  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;
    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, cw, ch);
  }

  // Gradient overlay for depth
  const gradient = ctx.createLinearGradient(0, 0, 0, ch);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cw, ch);

  // If only one image, we're done
  if (N === 1) return;

  // Remaining images arranged in wave pattern
  const waveImages = slotsImages.slice(1);
  const waveCount = waveImages.length;

  if (!waveCount) return;

  // Wave parameters influenced by salt
  const waveFrequency = 1.5 + (Math.abs(Math.sin(salt * 0.6)) * 1.5); // 1.5-3 waves
  const waveAmplitude = cw * (0.08 + Math.abs(Math.cos(salt * 0.8)) * 0.12); // 8-20% of width
  const verticalSpacing = ch / (waveCount + 1);

  // Card dimensions
  const cardWidth = cw * 0.22;
  const cardHeight = ch * 0.28;

  waveImages.forEach((img, i) => {
    if (!img) return;

    const imgIndex = i + 1; // Offset by 1 for background

    // Vertical position - evenly spaced
    const baseY = verticalSpacing * (i + 1) - cardHeight / 2;

    // Horizontal wave movement
    const progress = i / Math.max(waveCount - 1, 1);
    const wavePhase = (progress * Math.PI * 2 * waveFrequency) + (salt * 0.5);
    const waveOffset = Math.sin(wavePhase) * waveAmplitude;
    
    // Alternating left-right with wave
    const baseX = (i % 2 === 0) 
      ? cw * 0.15 + waveOffset  // Left side
      : cw * 0.65 + waveOffset; // Right side

    const x = baseX;
    const y = baseY;

    // Rotation follows wave
    const rotation = Math.sin(wavePhase) * 0.12; // ±7 degrees

    // Scale variation for depth
    const scaleVariation = 0.85 + Math.abs(Math.sin(wavePhase + salt)) * 0.3; // 0.85-1.15
    const width = cardWidth * scaleVariation;
    const height = cardHeight * scaleVariation;

    ctx.save();

    // Opacity variation
    ctx.globalAlpha = 0.90 + Math.abs(Math.cos(wavePhase)) * 0.10;

    // Shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 15 + scaleVariation * 10;
    ctx.shadowOffsetX = Math.sin(wavePhase) * 5;
    ctx.shadowOffsetY = 8;

    // Rotate around center
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // White card background
    const borderW = Math.max(4, width * 0.02);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-width / 2 - borderW, -height / 2 - borderW, 
                 width + borderW * 2, height + borderW * 2);

    // Draw image
    ctx.shadowColor = 'transparent';

    const imgRatio = img.width / img.height;
    const targetRatio = width / height;
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

    ctx.drawImage(img, sx, sy, sWidth, sHeight, -width / 2, -height / 2, width, height);

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore();
  });
}

function drawCompositeImageBookStack() {
  const N = slotsImages.length;
  if (!N) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const ctx = composite.ctx;
  const salt = Setup.Settings.canvas.salt || 1;

  // Clear and draw first image as background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, cw, ch);

  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;
    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, cw, ch);
  }

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, cw, ch);

  if (N === 1) return;

  // Remaining images as physically stacked grid
  const stackImages = slotsImages.slice(1);
  const stackCount = stackImages.length;

  if (!stackCount) return;

  // Poster aspect ratio (portrait)
  const posterAspect = 0.70;
  
  // 30% overlap means we only move 70% of the height/width per step
  const overlapFactor = 0.70;
  
  // Canvas ratio determines if we use more rows or columns
  const canvasRatio = cw / ch;
  const posterRatio = posterAspect; // width/height of poster (0.7 = portrait)
  
  // If canvas is wide (ratio > 1), use more columns
  // If canvas is tall (ratio < 1), use more rows
  // Adjust the distribution based on canvas vs poster aspect ratios
  let idealCols, rows;
  
  if (canvasRatio > 1.2) {
    // Very wide canvas: maximize columns
    idealCols = Math.ceil(Math.sqrt(stackCount * canvasRatio * 1.5));
    rows = Math.ceil(stackCount / idealCols);
  } else if (canvasRatio < 0.8) {
    // Very tall canvas: maximize rows
    rows = Math.ceil(Math.sqrt(stackCount / canvasRatio * 1.5));
    idealCols = Math.ceil(stackCount / rows);
  } else {
    // Square-ish canvas: balanced grid
    const sqrtCount = Math.sqrt(stackCount);
    idealCols = Math.ceil(sqrtCount * Math.sqrt(canvasRatio));
    rows = Math.ceil(stackCount / idealCols);
  }
  
  // Calculate poster size to MAXIMIZE coverage
  // For height: ch = posterHeight + (rows-1) * posterHeight * overlapFactor
  const maxPosterHeight = ch / (1 + (rows - 1) * overlapFactor);
  
  // For width: cw = posterWidth + (cols-1) * posterWidth * overlapFactor
  const maxPosterWidth = cw / (1 + (idealCols - 1) * overlapFactor);
  
  // Scale to poster aspect ratio - use the dimension that gives biggest size
  let finalPosterWidth, finalPosterHeight;
  
  const posterHeightFromWidth = maxPosterWidth / posterAspect;
  const posterWidthFromHeight = maxPosterHeight * posterAspect;
  
  if (posterHeightFromWidth <= ch / (1 + (rows - 1) * overlapFactor)) {
    // Width-based sizing fits
    finalPosterWidth = maxPosterWidth;
    finalPosterHeight = posterHeightFromWidth;
  } else {
    // Height-based sizing fits
    finalPosterHeight = maxPosterHeight;
    finalPosterWidth = posterWidthFromHeight;
  }
  
  const stepX = finalPosterWidth * overlapFactor;
  const stepY = finalPosterHeight * overlapFactor;
  
  // Calculate total grid dimensions
  const totalWidth = finalPosterWidth + (idealCols - 1) * stepX;
  const totalHeight = finalPosterHeight + (rows - 1) * stepY;
  
  // Center the entire grid
  const startX = (cw - totalWidth) / 2;
  const startY = (ch - totalHeight) / 2;
  
  // Draw row by row (back to front) so overlaps look natural
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < idealCols; col++) {
      const index = row * idealCols + col;
      if (index >= stackCount) break;
      
      const img = stackImages[index];
      if (!img) continue;
      
      const x = startX + col * stepX;
      const y = startY + row * stepY;
      
      ctx.save();
      
      // Shadow intensity increases toward front
      const depthFactor = (row * idealCols + col) / stackCount;
      ctx.shadowColor = `rgba(0, 0, 0, ${0.3 + depthFactor * 0.3})`;
      ctx.shadowBlur = 15 + depthFactor * 15;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 8 + depthFactor * 8;
      
      // Subtle rotation influenced by salt
      const rotationSeed = (index + 1) * (salt + 1) * 17.3;
      const rotationNoise = Math.sin(rotationSeed);
      const rotation = rotationNoise * 0.04; // ±2.3 degrees
      
      const centerX = x + finalPosterWidth / 2;
      const centerY = y + finalPosterHeight / 2;
      
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);
      
      // White poster background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(x, y, finalPosterWidth, finalPosterHeight, 6);
      ctx.fill();
      
      // Draw image
      ctx.shadowColor = 'transparent';
      
      const padding = Math.max(8, finalPosterWidth * 0.04);
      const contentX = x + padding;
      const contentY = y + padding;
      const contentW = finalPosterWidth - padding * 2;
      const contentH = finalPosterHeight - padding * 2;
      
      const imgRatio = img.width / img.height;
      const targetRatio = contentW / contentH;
      
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
      
      // Clip to rounded corners
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(contentX, contentY, contentW, contentH, 4);
      ctx.clip();
      
      ctx.drawImage(img, sx, sy, sWidth, sHeight, contentX, contentY, contentW, contentH);
      
      ctx.restore(); // Restore clip
      
      // Border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, finalPosterWidth, finalPosterHeight, 6);
      ctx.stroke();
      
      ctx.restore(); // Restore rotation/shadow
    }
  }
}

function drawCompositeImagePolaroidWall() {
  const N = slotsImages.length;
  if (!N) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const ctx = composite.ctx;
  const salt = Setup.Settings.canvas.salt || 1;

  // Clear with textured background
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 0, cw, ch);

  // First image as background with dark overlay
  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;
    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, cw, ch);
  }

  // Dark overlay for contrast
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, cw, ch);

  if (N === 1) return;

  // Remaining images as polaroids
  const polaroidImages = slotsImages.slice(1);
  const count = polaroidImages.length;

  if (!count) return;

  // Calculate polaroid size - decent sized photos
  const polaroidWidth = Math.min(cw * 0.28, ch * 0.35);
  const polaroidHeight = polaroidWidth * 1.18; // Polaroid aspect (photo + bottom white space)
  const photoHeight = polaroidWidth * 0.95; // Actual photo area

  // Grid for positioning (but with organic scatter)
  const cols = Math.ceil(Math.sqrt(count * (cw / ch)));
  const rows = Math.ceil(count / cols);
  
  const spacingX = cw / (cols + 1);
  const spacingY = ch / (rows + 1);

  // Draw polaroids from back to front
  for (let i = 0; i < count; i++) {
    const img = polaroidImages[i];
    if (!img) continue;

    // Base grid position
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const gridX = spacingX * (col + 1);
    const gridY = spacingY * (row + 1);

    // Salt-driven scatter from grid position
    const scatterSeed = (i + 1) * salt * 23.456;
    const scatterX = (Math.sin(scatterSeed) - 0.5) * spacingX * 0.4;
    const scatterY = (Math.cos(scatterSeed * 1.234) - 0.5) * spacingY * 0.4;

    const x = gridX + scatterX - polaroidWidth / 2;
    const y = gridY + scatterY - polaroidHeight / 2;

    ctx.save();

    // Rotation influenced by salt
    const rotationSeed = (i + 1) * salt * 31.415;
    const rotation = Math.sin(rotationSeed) * 0.15; // ±8.6 degrees
    
    const centerX = x + polaroidWidth / 2;
    const centerY = y + polaroidHeight / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);

    // Shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 6;

    // White polaroid frame
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(x, y, polaroidWidth, polaroidHeight);

    ctx.shadowColor = 'transparent';

    // Photo area
    const photoMargin = polaroidWidth * 0.06;
    const photoX = x + photoMargin;
    const photoY = y + photoMargin;
    const photoW = polaroidWidth - photoMargin * 2;

    // Draw photo
    const imgRatio = img.width / img.height;
    const targetRatio = photoW / photoHeight;

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

    ctx.drawImage(img, sx, sy, sWidth, sHeight, photoX, photoY, photoW, photoHeight);

    // Subtle inner shadow on photo
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(photoX, photoY, photoW, photoHeight);

    // Tape pieces - salt determines position (top or corner)
    const tapeChoice = Math.abs(Math.sin(rotationSeed * 2)) > 0.5;
    const tapeWidth = polaroidWidth * 0.5;
    const tapeHeight = polaroidWidth * 0.08;
    const tapeX = x + (polaroidWidth - tapeWidth) / 2;
    const tapeY = y - tapeHeight * 0.4;

    ctx.fillStyle = 'rgba(255, 255, 220, 0.7)'; // Semi-transparent tape
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;

    if (tapeChoice) {
      // Top center tape
      ctx.fillRect(tapeX, tapeY, tapeWidth, tapeHeight);
    } else {
      // Corner tape (rotated)
      ctx.save();
      ctx.translate(x + polaroidWidth * 0.85, y + polaroidHeight * 0.15);
      ctx.rotate(0.785); // 45 degrees
      ctx.fillRect(-tapeWidth * 0.3, -tapeHeight / 2, tapeWidth * 0.6, tapeHeight);
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawCompositeImageShrink() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const cw = canvas.width;
  const ch = canvas.height;
  const cx = cw / 2;
  const cy = ch / 2;

  // --- Constraint Logic ---
  // We need at least 20% of the PREVIOUS image to be visible.
  // Area_Next <= 0.8 * Area_Prev
  // Scale_Next <= sqrt(0.8) * Scale_Prev  (approx 0.894)
  // We use 0.85 (15% reduction) to be safe and visually clear.
  const scaleStep = 0.85; 

  // Draw from Back (Largest/0) to Front (Smallest/N-1)
  for (let i = 0; i < N; i++) {
    const img = slotsImages[i];
    if (!img) continue;

    // 1. Calculate Dimensions for this layer
    // i=0 is scale 1.0 (100%), i=1 is 0.85, i=2 is 0.72, etc.
    const currentScale = Math.pow(scaleStep, i);
    
    const w = cw * currentScale;
    const h = ch * currentScale;
    const x = cx - (w / 2);
    const y = cy - (h / 2);

    ctx.save();

    // 2. Draw Shadows (Only for layers sitting on top of others)
    if (i > 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20 * currentScale; // Shadow scales with size
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5 * currentScale;
      
      // Optional: Draw a thin white border for better separation
      ctx.fillStyle = 'white';
      ctx.fillRect(x - (2*currentScale), y - (2*currentScale), w + (4*currentScale), h + (4*currentScale));
    }

    // 3. Draw Image with "Cover" fit
    // We want the image to fill the calculate box (w, h) entirely
    // without distorting aspect ratio.
    const imgRatio = img.width / img.height;
    const layerRatio = w / h; // This is actually same as canvas ratio

    let sx, sy, sWidth, sHeight;

    if (imgRatio > layerRatio) {
      // Image is wider than the layer -> Crop sides
      sHeight = img.height;
      sWidth = sHeight * layerRatio;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      // Image is taller than the layer -> Crop top/bottom
      sWidth = img.width;
      sHeight = sWidth / layerRatio;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    // Draw the image into the calculated zone
    // We explicitly turn off shadow for the image draw to avoid double-shadowing artifacts
    ctx.shadowColor = 'transparent';
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);

    ctx.restore();
  }
}

function drawCompositeImageScatteredPhotos() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const cw = canvas.width;
  const ch = canvas.height;
  const cx = cw / 2;
  const cy = ch / 2;

  // Draw first image as full canvas background
  const img = slotsImages[0];
  if (img) {
    const iw = img.width;
    const ih = img.height;

    // Ratios
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;

    // If image is wider (relative), crop width; else crop height
    if (imgRatio > canvasRatio) {
      // Crop LEFT/RIGHT — keep full height
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;         // center horizontally
      sY = 0;
    } else {
      // Crop TOP/BOTTOM — keep full width
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;         // center vertically
    }

    ctx.drawImage(img, sX, sY, sW, sH, 0, 0, cw, ch);
  }

  // If only one image, we're done
  if (N === 1) return;

  // Base size for the photos (approx 45% of canvas width)
  // We want them large enough to see, small enough to pile up.
  const baseSize = Math.min(cw, ch);

  // Draw remaining images as polaroid stack on top
  for (let i = 1; i < N; i++) {
    const img = slotsImages[i];
    if (!img) continue;

    // --- 1. Create the "Random" Seed ---
    // We mix specific inputs to create a unique signature for this specific image state.
    // Changing ANY of these values will reshuffle this specific card.
    const uniqueSalt = (i + 1) * (N + 13) * (cw + ch) * (Setup.Settings.canvas.salt || 1);
    
    // Helper to get a deterministic number between -1.0 and 1.0
    // We multiply by prime numbers to avoid repeating patterns
    const rndX = Math.sin(uniqueSalt * 12.9898);
    const rndY = Math.sin(uniqueSalt * 78.233);
    const rndR = Math.cos(uniqueSalt * 53.539); // Rotation
    const rndS = Math.sin(uniqueSalt * 99.111); // Scale variance

    // --- 2. Calculate Dimensions & Position ---
    
    // Scale: Variation between 0.9x and 1.1x of base size
    const scale = 0.4 + (rndS * 0.1);
    
    // Maintain Aspect Ratio
    const imgRatio = img.width / img.height;
    let w, h;
    
    // Logic to ensure the photo fits within the "Polaroid" nicely
    if (imgRatio > 1) {
      w = baseSize * scale;
      h = w / imgRatio;
    } else {
      h = baseSize * scale;
      w = h * imgRatio;
    }

    // Position: Center + Random Scatter
    // We limit the scatter to 25% of canvas so images don't fly off-screen
    const maxScatterX = cw * 0.5; 
    const maxScatterY = ch * 0.35;
    
    const x = cx + (rndX * maxScatterX);
    const y = cy + (rndY * maxScatterY);

    // Rotation: Random angle between -20 and 20 degrees
    const rotation = rndR * 20 * (Math.PI / 180);

    // --- 3. Draw ---
    ctx.save();

    // Move to position and rotate
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Draw Drop Shadow (Natural photo depth)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    // Draw White Border (Photo Paper look)
    const padding = Math.max(10, w * 0.06); // 6% border
    ctx.fillStyle = '#ffffff';
    
    // We draw from center (-w/2) because we translated to center (x, y)
    // The border rect is slightly larger than the image
    ctx.fillRect(
      (-w / 2) - padding, 
      (-h / 2) - padding, 
      w + (padding * 2), 
      h + (padding * 2)
    );

    // Draw Image inside the border
    ctx.shadowColor = 'transparent'; // Disable shadow for the image itself
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    ctx.restore();
  }
}

function drawCompositeImageCardFan() {
  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 0 } = Setup.Settings.canvas;
  
  // First image is background, rest are fanned cards
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Base size to fill most of the canvas
  const baseWidth = canvas.width;
  const baseHeight = canvas.height;
  
  // Draw background (first image)
  const bgImg = slotsImages[0];
  if (bgImg) {
    const imgRatio = bgImg.width / bgImg.height;
    const targetRatio = baseWidth / baseHeight;
    let sx, sy, sWidth, sHeight;
    
    if (imgRatio > targetRatio) {
      sHeight = bgImg.height;
      sWidth = sHeight * targetRatio;
      sx = (bgImg.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = bgImg.width;
      sHeight = sWidth / targetRatio;
      sx = 0;
      sy = (bgImg.height - sHeight) / 2;
    }
    
    composite.ctx.drawImage(bgImg, sx, sy, sWidth, sHeight, 0, 0, baseWidth, baseHeight);
  }
  
  // If only one image, we're done
  if (N === 1) return;
  
  // Calculate maximum visible cards (limit to prevent too small images)
  const maxVisible = N - 1; // Exclude background
  
  // SALT-DRIVEN VARIATION
  // Salt affects rotation, positioning, and arrangement patterns
  const salt = Setup.Settings.canvas.salt || 1;
  
  // Use salt to create different rotation patterns
  // Salt determines the base angle and rotation spread
  const saltAngle = (salt * 137.5) % 360; // Golden angle multiplier for varied patterns
  const maxRotation = 0.2 + (Math.abs(Math.sin(salt * 0.5)) * 0.3); // 0.2 to 0.5 radians
  
  // Salt affects horizontal and vertical spread
  const maxOffsetX = canvas.width * (0.1 + (Math.abs(Math.cos(salt * 0.7)) * 0.15)); // 10-25%
  const maxOffsetY = canvas.height * (0.05 + (Math.abs(Math.sin(salt * 0.9)) * 0.15)); // 5-20%
  
  // Salt affects size reduction pattern
  const sizeReduction = 0.02 + (Math.abs(Math.sin(salt * 1.3)) * 0.04); // 2-6% per card
  
  // Salt determines arrangement style
  const arrangementMode = Math.floor(Math.abs(salt * 3.7)) % 4; // 4 different modes
  
  // Draw from back to front (largest to smallest)
  for (let i = 0; i < maxVisible; i++) {
    const imgIndex = i + 1; // Skip first image (background)
    const img = slotsImages[imgIndex];
    if (!img) continue;
    
    // Calculate scale - back cards are larger
    const scale = 1 - (i * sizeReduction);
    const width = baseWidth * scale;
    const height = baseHeight * scale;
    
    // Calculate position based on salt-driven arrangement mode
    const progress = i / (maxVisible - 1);
    let rotation, offsetX, offsetY;
    
    switch(arrangementMode) {
      case 0: // Symmetric fan
        rotation = (progress - 0.5) * maxRotation * 2;
        offsetX = (progress - 0.5) * maxOffsetX * 2;
        offsetY = (progress - 0.5) * maxOffsetY;
        break;
        
      case 1: // Circular arrangement
        const angle = (saltAngle + (360 / maxVisible * i * salt)) * Math.PI / 180;
        rotation = angle % (Math.PI * 0.4) - (Math.PI * 0.2);
        offsetX = Math.cos(angle % (Math.PI * 2)) * maxOffsetX;
        offsetY = Math.sin(angle % (Math.PI * 2)) * maxOffsetY;
        break;
        
      case 2: // Wave pattern
        const wavePhase = (i / maxVisible * Math.PI * 2 * salt) % (Math.PI * 2);
        rotation = Math.sin(wavePhase) * maxRotation;
        offsetX = Math.cos(wavePhase) * maxOffsetX;
        offsetY = Math.sin(wavePhase * 2) * maxOffsetY;
        break;
        
      case 3: // Spiral pattern
        const spiralAngle = (i * salt * 0.5) % (Math.PI * 2);
        const spiralRadius = progress;
        rotation = (spiralAngle - Math.PI) % (Math.PI * 0.6) - (Math.PI * 0.3);
        offsetX = Math.cos(spiralAngle) * maxOffsetX * spiralRadius;
        offsetY = Math.sin(spiralAngle) * maxOffsetY * spiralRadius;
        break;
    }
    
    const x = centerX - width / 2 + offsetX;
    const y = centerY - height / 2 + offsetY;
    
    // Opacity with salt variation
    const baseOpacity = 0.6 + (Math.abs(Math.cos(salt * 0.3)) * 0.2); // 0.6-0.8 base
    const opacity = baseOpacity + (i / maxVisible) * (1 - baseOpacity);
    
    composite.ctx.save();
    composite.ctx.globalAlpha = opacity;
    
    // Apply rotation around center of image
    composite.ctx.translate(centerX + offsetX, centerY + offsetY);
    composite.ctx.rotate(rotation);
    composite.ctx.translate(-centerX - offsetX, -centerY - offsetY);
    
    // Shadow intensity varies with salt
    const shadowIntensity = 0.2 + (Math.abs(Math.sin(salt * 1.1)) * 0.3); // 0.2-0.5
    composite.ctx.shadowColor = `rgba(0, 0, 0, ${shadowIntensity})`;
    composite.ctx.shadowBlur = 10 + (Math.abs(Math.cos(salt * 0.8)) * 15); // 10-25
    composite.ctx.shadowOffsetX = 3 + Math.cos(salt) * 5; // 3-8
    composite.ctx.shadowOffsetY = 3 + Math.sin(salt) * 5; // 3-8
    
    // Draw white card background
    composite.ctx.fillStyle = 'white';
    composite.ctx.fillRect(x, y, width, height);
    
    // Draw image with padding (padding also affected by salt)
    const padding = (8 + (Math.abs(Math.sin(salt * 1.7)) * 8)) * scale; // 8-16 pixels
    const imgWidth = width - padding * 2;
    const imgHeight = height - padding * 2;
    const imgRatio = img.width / img.height;
    const targetRatio = imgWidth / imgHeight;
    
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
    
    composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 
      x + padding, y + padding, imgWidth, imgHeight);
    
    // Add subtle border (thickness varies with salt)
    composite.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    composite.ctx.lineWidth = 1 + (Math.abs(Math.cos(salt * 2.1)) * 2); // 1-3 pixels
    composite.ctx.strokeRect(x, y, width, height);
    
    composite.ctx.restore();
  }
}

function drawCompositeImageMondriansGrid() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const cw = canvas.width;
  const ch = canvas.height;
  
  // --- SETTINGS ---
  // White background color for the "spaces" (borders)
  const spacingColor = '#ffffff'; 
  // Thickness of the lines between images
  const spacing = Math.max(cw, ch) * 0.015; 

  // --- SALT & DETERMINISM ---
  const rawSalt = Setup.Settings.canvas.salt || 1;
  // Keep salt manageable
  const salt = Math.abs(rawSalt) % 100000;

  // Deterministic random helper
  // Returns 0.0 to 1.0
  const getRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // --- LAYOUT ALGORITHM (Binary Space Partitioning) ---
  // We start with one block (the full canvas) and split it until we have N blocks.
  
  let blocks = [
    { x: 0, y: 0, w: cw, h: ch }
  ];

  // We need exactly N blocks. Iterate N-1 times to create N splits.
  for (let i = 0; i < N - 1; i++) {
    // 1. Find the largest block to split (keeps sizes somewhat balanced)
    let largestIdx = 0;
    let maxArea = 0;
    
    blocks.forEach((block, index) => {
      const area = block.w * block.h;
      if (area > maxArea) {
        maxArea = area;
        largestIdx = index;
      }
    });

    const target = blocks[largestIdx];
    
    // 2. Decide Split Direction & Ratio using SALT
    // We use 'i' and 'salt' to make every split unique but reproducible.
    const rndDir = getRandom((i + 1) * (salt + 1)); // 0..1
    const rndRatio = getRandom((i + 1) * (salt + 1) * 13.37); // 0..1
    
    // Split Limit: Don't split too close to edges (keep between 30% and 70%)
    const splitRatio = 0.3 + (rndRatio * 0.4); 
    
    // Determine Horizontal vs Vertical split
    // If block is very wide, favor vertical split. If tall, favor horizontal.
    // If square-ish, use the random direction.
    let splitVertical = rndDir > 0.5;
    
    if (target.w > target.h * 1.5) splitVertical = true;
    else if (target.h > target.w * 1.5) splitVertical = false;

    // 3. Create the two new blocks
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

    // Replace the target block with the two new ones
    blocks.splice(largestIdx, 1, b1, b2);
  }

  // --- RENDER ---

  // 1. Fill Background (The "Spaces")
  ctx.fillStyle = spacingColor;
  ctx.fillRect(0, 0, cw, ch);

  // 2. Draw Images into Blocks
  // We shuffle the image assignment based on salt so changing salt moves images around.
  const imageIndices = Array.from({ length: N }, (_, i) => i);
  
  // Fisher-Yates shuffle with deterministic salt
  for (let i = imageIndices.length - 1; i > 0; i--) {
    const r = getRandom(i * salt * 55.5);
    const j = Math.floor(r * (i + 1));
    [imageIndices[i], imageIndices[j]] = [imageIndices[j], imageIndices[i]];
  }

  blocks.forEach((block, i) => {
    const imgIndex = imageIndices[i];
    const img = slotsImages[imgIndex];
    
    if (!img) return;

    // Apply padding (half spacing on each side)
    // We effectively "inset" the image drawing area
    const x = block.x + spacing / 2;
    const y = block.y + spacing / 2;
    const w = block.w - spacing;
    const h = block.h - spacing;

    if (w <= 0 || h <= 0) return; // Safety check

    // Calculate Aspect Ratio Crop (Object-Fit: Cover)
    const imgRatio = img.width / img.height;
    const blockRatio = w / h;
    
    let sx, sy, sw, sh;
    
    if (imgRatio > blockRatio) {
      // Image is wider than block -> Crop sides
      sh = img.height;
      sw = sh * blockRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      // Image is taller than block -> Crop top/bottom
      sw = img.width;
      sh = sw / blockRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }

    ctx.save();
    
    // Optional: Clip to block (clean edges)
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    
    ctx.restore();
  });
}

function drawCompositeImageFramedGrid() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const cw = canvas.width;
  const ch = canvas.height;

  // Draw first image as full canvas background
  const bgImg = slotsImages[0];
  if (bgImg) {
    const iw = bgImg.width;
    const ih = bgImg.height;
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let sX, sY, sW, sH;

    if (imgRatio > canvasRatio) {
      sH = ih;
      sW = ih * canvasRatio;
      sX = (iw - sW) * 0.5;
      sY = 0;
    } else {
      sW = iw;
      sH = iw / canvasRatio;
      sX = 0;
      sY = (ih - sH) * 0.5;
    }

    ctx.drawImage(bgImg, sX, sY, sW, sH, 0, 0, cw, ch);
  }

  // If only one image, we're done
  if (N === 1) return;

  // Apply a dark overlay to make the grid stand out
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, cw, ch);

  // Remaining images to place in grid
  const gridImages = slotsImages.slice(1);
  const numImages = gridImages.length;
  if (!numImages) return;

  // Salt for variation
  const salt = Setup.Settings.canvas.salt || 1;

  // Determine grid layout based on number of images
  let cols, rows;
  if (numImages <= 2) {
    cols = 2;
    rows = 1;
  } else if (numImages <= 4) {
    cols = 2;
    rows = 2;
  } else if (numImages <= 6) {
    cols = 3;
    rows = 2;
  } else if (numImages <= 9) {
    cols = 3;
    rows = 3;
  } else {
    cols = 4;
    rows = Math.ceil(numImages / 4);
  }

  // Gap/border size between images (the white space)
  const gapSize = Math.max(8, Math.min(cw, ch) * 0.02); // 2% of canvas
  
  // Calculate available space for grid
  const gridMargin = Math.min(cw, ch) * 0.05; // 5% margin around entire grid
  const availableWidth = cw - (gridMargin * 2);
  const availableHeight = ch - (gridMargin * 2);

  // Calculate cell dimensions
  const cellWidth = (availableWidth - (gapSize * (cols - 1))) / cols;
  const cellHeight = (availableHeight - (gapSize * (rows - 1))) / rows;

  // Draw each image in grid
  for (let i = 0; i < numImages; i++) {
    const img = gridImages[i];
    if (!img) continue;

    // Calculate grid position
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Calculate cell position
    const cellX = gridMargin + (col * (cellWidth + gapSize));
    const cellY = gridMargin + (row * (cellHeight + gapSize));

    // Deterministic random values based on salt
    const uniqueSalt = (i + 1) * (N + 13) * (cw + ch) * salt;
    const rndRotation = Math.sin(uniqueSalt * 53.539) * 5; // Small rotation -5 to 5 degrees
    const rndScale = 0.95 + (Math.abs(Math.sin(uniqueSalt * 99.111)) * 0.1); // 0.95 to 1.05

    ctx.save();

    // Move to cell center
    const cellCenterX = cellX + cellWidth / 2;
    const cellCenterY = cellY + cellHeight / 2;
    
    ctx.translate(cellCenterX, cellCenterY);
    ctx.rotate(rndRotation * Math.PI / 180);

    // Draw white border/frame
    const borderWidth = Math.max(6, cellWidth * 0.04); // 4% border

    // Shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = '#ffffff';
    const frameWidth = cellWidth * rndScale;
    const frameHeight = cellHeight * rndScale;
    ctx.fillRect(
      -frameWidth / 2,
      -frameHeight / 2,
      frameWidth,
      frameHeight
    );

    // Draw image inside frame
    ctx.shadowColor = 'transparent';
    
    const imgWidth = frameWidth - (borderWidth * 2);
    const imgHeight = frameHeight - (borderWidth * 2);

    // Crop image to fit frame while maintaining aspect ratio
    const imgRatio = img.width / img.height;
    const frameRatio = imgWidth / imgHeight;

    let sX, sY, sW, sH;
    if (imgRatio > frameRatio) {
      sH = img.height;
      sW = sH * frameRatio;
      sX = (img.width - sW) / 2;
      sY = 0;
    } else {
      sW = img.width;
      sH = sW / frameRatio;
      sX = 0;
      sY = (img.height - sH) / 2;
    }

    ctx.drawImage(
      img,
      sX, sY, sW, sH,
      -imgWidth / 2,
      -imgHeight / 2,
      imgWidth,
      imgHeight
    );

    ctx.restore();
  }
}


// ======================
// Layout Function Mapping
// ======================

const drawCompositeImageFn = {
  "Line": drawCompositeImageLine,
  "Grid": drawCompositeImageGrid,
  "Mosaic": drawCompositeImageMosaic,
  "Circle": drawCompositeImageCircle,
  "Collage": drawCompositeImageCollage,
  "Italic": drawCompositeImageItalicLine,
  "Carousel": drawCompositeImageCarousel,
  "Shrink": drawCompositeImageShrink,
  "Fan Spread": drawCompositeImageFanSpread,
  "Scattered Stack": drawCompositeImageScatteredStack,
  "Spiral": drawCompositeImageSpiral,
  "Waves": drawCompositeImageWaves,
  "Book Stack": drawCompositeImageBookStack,
  "Polaroid Wall": drawCompositeImagePolaroidWall,
  "Scattered Photos": drawCompositeImageScatteredPhotos,
  "Card Fan": drawCompositeImageCardFan,
  "Mondrian": drawCompositeImageMondriansGrid,
  "Framed Grid": drawCompositeImageFramedGrid,
};