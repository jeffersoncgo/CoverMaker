function hexToRgb(hex) {
  // Remove the hash if it exists
  hex = hex.replace(/^#/, '');

  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  // Parse the integer value
  const bigint = parseInt(hex, 16);
  
  // Extract RGB components using bitwise operators
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r, g, b }; // Returns an object: { r: 255, g: 255, b: 255 }
}

// ======================
// Image Handling Utilities
// ======================
function loadImage(file) {
  if(!file)
    return;
  file = file instanceof Image ? file.src : file;
  if (typeof file == "string") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = file;
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      loadImage(e.target.result).then(resolve).catch(reject)
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blurImage(img, size) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  ctx.filter = `blur(${size}px)`;
  ctx.drawImage(canvas, 0, 0);
  return canvas;
}

// ======================
// Canvas Drawing Functions (Core)
// ======================

function setCanvasSize(width, height) {
  composite.size.width = width;
  composite.size.height = height;
  composite.canvas.width = width;
  composite.canvas.height = height;
  canvas.width = width;
  canvas.height = height;
  canvas.style.aspectRatio = width / height;
  drawComposite();
}

function drawComposite() {
  drawCompositeImage();
  drawCompositeText();
}


// ======================
// Canvas Drawing Functions (Text)
// ======================

function drawCompositeText() {
  // Draw the composite image from the offscreen canvas directly.
  // Avoid clearing the visible canvas first — `drawImage` overwrites
  // the pixel area and clearing beforehand can produce a brief blank
  // frame if the offscreen buffer is being re-rendered.
  ctx.drawImage(composite.canvas, 0, 0);
  
  // 3. Draw the dark overlay
  // Let's change this, to make a gradient overlay instead of solid color
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `rgba(${Setup.Settings.canvas.overlayColorStartRGB.r}, ${Setup.Settings.canvas.overlayColorStartRGB.g}, ${Setup.Settings.canvas.overlayColorStartRGB.b}, ${Setup.Settings.canvas.overlayOpacityStart})`);
  gradient.addColorStop(1, `rgba(${Setup.Settings.canvas.overlayColorEndRGB.r}, ${Setup.Settings.canvas.overlayColorEndRGB.g}, ${Setup.Settings.canvas.overlayColorEndRGB.b}, ${Setup.Settings.canvas.overlayOpacityEnd})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 4. ⭐️ NEW: Loop over each text layer and draw it ⭐️
  Setup.Settings.textLayers.forEach(layer => {
    const text = layer.overlayText;

    // --- Calculate Position ---
    let anchorX = 0;
    if (layer.position.textAlign === 'center') {
      anchorX = canvas.width / 2;
    } else if (layer.position.textAlign === 'right') {
      anchorX = canvas.width;
    }

    let anchorY = 0;
    if (layer.position.textBaseline === 'middle') {
      anchorY = canvas.height / 2;
    } else if (layer.position.textBaseline === 'bottom') {
      anchorY = canvas.height;
    }
    
    const finalX = anchorX + layer.position.x;
    const finalY = anchorY + layer.position.y;

    // --- Start Drawing Layer ---
    ctx.save(); // Save context for the whole layer

    // Set common text properties
    ctx.font = layer.fontStyle;
    ctx.textAlign = layer.position.textAlign;
    ctx.textBaseline = layer.position.textBaseline;

    // --- Draw Shadows ---
    // We draw shadows FIRST, from bottom to top
    // This implementation draws shadows as offset, blurred text
    layer.shadows.forEach(shadow => {
      ctx.save();
      ctx.fillStyle = shadow.color;
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.offsetX;
      ctx.shadowOffsetY = shadow.offsetY;
      ctx.fillText(text, finalX, finalY);
      ctx.restore();
    });

    // --- Draw Strokes ---
    // We draw strokes SECOND, from bottom to top
    layer.strokes.forEach(stroke => {
      ctx.save();
      ctx.strokeStyle = stroke.style;
      ctx.lineWidth = stroke.width;
      ctx.strokeText(text, finalX, finalY);
      ctx.restore();
    });

    // --- Draw Main Fill ---
    // We draw the main text fill LAST, on top of everything
    ctx.fillStyle = layer.fillStyle;
    ctx.fillText(text, finalX, finalY);

    ctx.restore(); // Restore context for the whole layer
  });
}

// ======================
// Canvas Drawing Functions (Background)
// ======================

function drawCompositeImage() {
  // Only resize the offscreen canvas when dimensions actually change.
  // Resizing clears the canvas and resets context state in many browsers,
  // which causes visible flicker if done every frame.
  if (composite.canvas.width !== canvas.width || composite.canvas.height !== canvas.height) {
    composite.canvas.width = canvas.width;
    composite.canvas.height = canvas.height;
    composite.ctx = composite.canvas.getContext('2d');
  }
  // Clear and fill the offscreen canvas before drawing images.
  composite.ctx.clearRect(0, 0, composite.canvas.width, composite.canvas.height);
  composite.ctx.fillStyle = "black";
  composite.ctx.fillRect(0, 0, composite.canvas.width, composite.canvas.height);
  
  // Call the appropriate drawing function based on current type
  const drawFn = drawCompositeImageFn[Setup.Settings.canvas.type];
  if (drawFn) {
    drawFn();
  } else {
    console.warn(`Unknown canvas type: ${Setup.Settings.canvas.type}. Falling back to Line.`);
    drawCompositeImageLine();
  }
}

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

  const { spacing = 10 } = Setup.Settings.canvas;
  
  // Clear background
  composite.ctx.fillStyle = "black";
  composite.ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (N === 1) {
    // Single image fills canvas
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    }
    return;
  }
  
  // Dynamic mosaic with varied sizes based on image count
  const margin = spacing * 2;
  const usableWidth = canvas.width - margin * 2;
  const usableHeight = canvas.height - margin * 2;
  
  if (N === 2) {
    // Two images: split vertically
    const width = usableWidth / 2 - spacing;
    slotsImages.forEach((img, i) => {
      if (!img) return;
      const x = margin + i * (width + spacing);
      const imgRatio = img.width / img.height;
      const targetRatio = width / usableHeight;
      
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, x, margin, width, usableHeight);
    });
  } else if (N === 3) {
    // Three images: one large left, two stacked right
    const largeWidth = usableWidth * 0.6;
    const smallWidth = usableWidth * 0.4 - spacing;
    const smallHeight = (usableHeight - spacing) / 2;
    
    // Large left image
    const largeImg = slotsImages[0];
    if (largeImg) {
      const imgRatio = largeImg.width / largeImg.height;
      const targetRatio = largeWidth / usableHeight;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > targetRatio) {
        sHeight = largeImg.height;
        sWidth = sHeight * targetRatio;
        sx = (largeImg.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = largeImg.width;
        sHeight = sWidth / targetRatio;
        sx = 0;
        sy = (largeImg.height - sHeight) / 2;
      }
      
      composite.ctx.drawImage(largeImg, sx, sy, sWidth, sHeight, margin, margin, largeWidth, usableHeight);
    }
    
    // Two small right images
    for (let i = 1; i < 3; i++) {
      const img = slotsImages[i];
      if (!img) continue;
      
      const x = margin + largeWidth + spacing;
      const y = margin + (i - 1) * (smallHeight + spacing);
      
      const imgRatio = img.width / img.height;
      const targetRatio = smallWidth / smallHeight;
      
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, smallWidth, smallHeight);
    }
  } else {
    // 4+ images: dynamic grid with varied sizes
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);
    const cellWidth = usableWidth / cols;
    const cellHeight = usableHeight / rows;
    
    slotsImages.forEach((img, i) => {
      if (!img) return;
      
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      // Vary the size within the cell for mosaic effect
      const sizeVariation = 0.8 + (Math.sin(i * 1.5) + 1) * 0.2; // 0.8 to 1.2
      const width = cellWidth * sizeVariation - spacing;
      const height = cellHeight * sizeVariation - spacing;
      
      const x = margin + col * cellWidth + (cellWidth - width) / 2;
      const y = margin + row * cellHeight + (cellHeight - height) / 2;
      
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
    });
  }
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
  
  slotsImages.forEach((img, i) => {
    if (!img) return;
    
    const startAngle = angleStep * i;
    const endAngle = angleStep * (i + 1);
    
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

  const { spacing = 15 } = Setup.Settings.canvas;
  
  // Clear with black background
  composite.ctx.fillStyle = "black";
  composite.ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Deterministic "random" based on index
  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000 * (Setup.Settings.canvas.salt || 1);
    return x - Math.floor(x);
  };
  
  const margin = canvas.width * 0.05;
  const usableWidth = canvas.width - margin * 2;
  const usableHeight = canvas.height - margin * 2;
  
  // Sort by size - larger images first (background)
  const imagesWithSizes = slotsImages.map((img, i) => ({
    img,
    index: i,
    // First images are larger, later ones smaller
    size: 0.7 - (i / N) * 0.4 // 70% down to 30%
  }));
  
  imagesWithSizes.forEach(({ img, index, size }, i) => {
    if (!img) return;
    
    const sizeFactor = size;
    const width = usableWidth * sizeFactor;
    const height = usableHeight * sizeFactor;
    
    // Position images more strategically to avoid overlap
    const gridCols = 3;
    const gridRows = 3;
    const cellWidth = usableWidth / gridCols;
    const cellHeight = usableHeight / gridRows;
    
    // Assign to grid cells with some variation
    const col = (index * 7) % gridCols; // Prime number for better distribution
    const row = (index * 11) % gridRows;
    
    const baseX = margin + col * cellWidth + (cellWidth - width) / 2;
    const baseY = margin + row * cellHeight + (cellHeight - height) / 2;
    
    // Add small random offset within cell
    const x = baseX + (seededRandom(index * 5) - 0.5) * (cellWidth - width) * 0.3;
    const y = baseY + (seededRandom(index * 13) - 0.5) * (cellHeight - height) * 0.3;
    
    const rotation = (seededRandom(index * 17) - 0.5) * 0.3;
    const opacity = 0.8 + seededRandom(index * 19) * 0.2; // 80-100% opacity
    
    composite.ctx.save();
    composite.ctx.globalAlpha = opacity;
    
    // Translate to center, rotate, then draw
    composite.ctx.translate(x + width / 2, y + height / 2);
    composite.ctx.rotate(rotation);
    
    // Draw image centered at origin
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
    
    composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, -width / 2, -height / 2, width, height);
    
    // Add subtle white border
    composite.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    composite.ctx.lineWidth = 2;
    composite.ctx.strokeRect(-width / 2, -height / 2, width, height);
    
    composite.ctx.restore();
  });
}

function drawCompositeImageItalicLine() {
  const N = slotsImages.length;
  if (!N) return;
  
  const { spacing = 0, baseScale = 1, reflectionDistance = 0.5 } = Setup.Settings.canvas;
  
  const slotWidth = canvas.width / N;
  const slotTotalHeight = canvas.height / 2;
  const realHeight = slotTotalHeight * baseScale;
  const reflectionHeight = slotTotalHeight * reflectionDistance;
  const targetRatio = slotWidth / realHeight;
  
  // Skew angle (italic effect)
  const skewAngle = -0.15;
  
  const _cS = Setup.Settings.canvas.overlayColorStartRGB;
  const _cSo = Setup.Settings.canvas.overlayOpacityStart;
  const _cE = Setup.Settings.canvas.overlayColorEndRGB;
  const _cEo = Setup.Settings.canvas.overlayOpacityEnd;
  const startColor = `rgba(${_cS.r}, ${_cS.g}, ${_cS.b}, ${_cSo})`;
  const endColor = `rgba(${_cE.r}, ${_cE.g}, ${_cE.b}, ${_cEo})`;

  slotsImages.forEach((img, i) => {
    if (!img) return;
    
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
    
    const dx = i * (slotWidth + spacing) - spacing;
    const dy = 0;
    
    sWidth -= spacing * 2;
    sHeight -= spacing * 2;
    
    // Draw main image with skew
    composite.ctx.save();
    composite.ctx.transform(1, 0, skewAngle, 1, dx, dy);
    composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, slotWidth, realHeight);
    composite.ctx.restore();
    
    // FIXED: Draw reflection with proper alignment
    const blurredImg = blurImage(img, Setup.Settings.canvas.blurAmount || 5);
    composite.ctx.save();
    
    // Calculate the skew offset for proper reflection positioning
    const skewOffset = realHeight * Math.tan(skewAngle);
    
    // Apply the same transformation as main image but flipped
    composite.ctx.transform(1, 0, skewAngle, 1, dx + skewOffset, realHeight + reflectionHeight);
    composite.ctx.scale(1, -1);
    composite.ctx.drawImage(blurredImg, sx, sy, sWidth, sHeight, -skewOffset, 0, slotWidth, reflectionHeight);
    composite.ctx.restore();
    
    // Apply reflection fade with proper positioning
    composite.ctx.save();
    composite.ctx.transform(1, 0, skewAngle, 1, dx + skewOffset, realHeight);
    const gradient = composite.ctx.createLinearGradient(0, 0, 0, reflectionHeight);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(Setup.Settings.canvas.reflectionScale || 1, endColor);
    composite.ctx.fillStyle = gradient;
    composite.ctx.fillRect(-skewOffset, 0, slotWidth, reflectionHeight);
    composite.ctx.restore();
  });
}

function drawCompositeImageCarousel() {
  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 20 } = Setup.Settings.canvas;
  
  // 3D carousel effect with center image larger and side images smaller with perspective
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const centerWidth = canvas.width * 0.4;
  const centerHeight = canvas.height * 0.6;
  const sideWidth = canvas.width * 0.25;
  const sideHeight = canvas.height * 0.45;
  const sideOffset = canvas.width * 0.35;
  
  // Draw left image (if available)
  if (N >= 3) {
    const leftImg = slotsImages[N - 1]; // Wrap around
    if (leftImg) {
      composite.ctx.save();
      composite.ctx.globalAlpha = 0.6;
      
      const imgRatio = leftImg.width / leftImg.height;
      const targetRatio = sideWidth / sideHeight;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > targetRatio) {
        sHeight = leftImg.height;
        sWidth = sHeight * targetRatio;
        sx = (leftImg.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = leftImg.width;
        sHeight = sWidth / targetRatio;
        sx = 0;
        sy = (leftImg.height - sHeight) / 2;
      }
      
      composite.ctx.drawImage(leftImg, sx, sy, sWidth, sHeight, 
        centerX - sideOffset - sideWidth / 2, centerY - sideHeight / 2, sideWidth, sideHeight);
      composite.ctx.restore();
    }
  }
  
  // Draw center image (main focus)
  if (N >= 1) {
    const centerImg = slotsImages[0];
    if (centerImg) {
      const imgRatio = centerImg.width / centerImg.height;
      const targetRatio = centerWidth / centerHeight;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > targetRatio) {
        sHeight = centerImg.height;
        sWidth = sHeight * targetRatio;
        sx = (centerImg.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = centerImg.width;
        sHeight = sWidth / targetRatio;
        sx = 0;
        sy = (centerImg.height - sHeight) / 2;
      }
      
      composite.ctx.save();
      // Add subtle shadow behind center image
      composite.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      composite.ctx.shadowBlur = 20;
      composite.ctx.shadowOffsetX = 0;
      composite.ctx.shadowOffsetY = 10;
      
      composite.ctx.drawImage(centerImg, sx, sy, sWidth, sHeight, 
        centerX - centerWidth / 2, centerY - centerHeight / 2, centerWidth, centerHeight);
      composite.ctx.restore();
    }
  }
  
  // Draw right image (if available)
  if (N >= 2) {
    const rightImg = slotsImages[1];
    if (rightImg) {
      composite.ctx.save();
      composite.ctx.globalAlpha = 0.6;
      
      const imgRatio = rightImg.width / rightImg.height;
      const targetRatio = sideWidth / sideHeight;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > targetRatio) {
        sHeight = rightImg.height;
        sWidth = sHeight * targetRatio;
        sx = (rightImg.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = rightImg.width;
        sHeight = sWidth / targetRatio;
        sx = 0;
        sy = (rightImg.height - sHeight) / 2;
      }
      
      composite.ctx.drawImage(rightImg, sx, sy, sWidth, sHeight, 
        centerX + sideOffset - sideWidth / 2, centerY - sideHeight / 2, sideWidth, sideHeight);
      composite.ctx.restore();
    }
  }
}

function drawCompositeImageStack() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const W = canvas.width;
  const H = canvas.height;

  // Book spread parameters
  const maxSpreadDeg = Math.min(28, 6 + N * 1.5); // dynamic spread
  const maxSpreadRad = maxSpreadDeg * Math.PI / 180;

  const centerX = W / 2;
  const centerY = H / 2;

  // ────────────────────────────────────────────────
  // 1) Compute a uniform scale so the most rotated card fits
  // ────────────────────────────────────────────────
  const cardBaseW = W * 0.80;
  const cardBaseH = H * 0.80;

  // Find size of rotated bounding box
  const testAngle = maxSpreadRad;
  const rotW = Math.abs(cardBaseW * Math.cos(testAngle)) + Math.abs(cardBaseH * Math.sin(testAngle));
  const rotH = Math.abs(cardBaseW * Math.sin(testAngle)) + Math.abs(cardBaseH * Math.cos(testAngle));

  const scale = Math.min(W / rotW, H / rotH) * 0.95;

  const cardW = cardBaseW * scale;
  const cardH = cardBaseH * scale;
  

  // Lateral offset: small "page shift"
  const dx = cardW * 0.05;

  // ────────────────────────────────────────────────
  // 2) Angle spacing
  // ────────────────────────────────────────────────
  const half = (N - 1) / 2;
  const anglePerCard = (N === 1 ? 0 : (maxSpreadRad * 2) / (N - 1));

  // ────────────────────────────────────────────────
  // 3) Draw back → front
  // ────────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const img = slotsImages[i];
    if (!img) continue;

    const t = i - half;
    const angle = t * anglePerCard;
    const x = centerX + t * dx;
    const y = centerY;

    ctx.save();

    // Opacity increases to front
    ctx.globalAlpha = 0.55 + (i / N) * 0.45;

    // Soft realistic shadow
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;

    // Transform anchor → card center
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Draw card background
    ctx.fillStyle = 'white';
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

    // Draw image inside (letterbox cover)
    const padding = Math.max(10 * scale, 6);
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

    ctx.drawImage(
      img,
      sx, sy, sW, sH,
      -innerW / 2, -innerH / 2, innerW, innerH
    );

    ctx.restore();
  }
}

function drawCompositeImageStack2() {
  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 0 } = Setup.Settings.canvas;
  
  // Book-like stack - all images visible, arranged like a fanned deck
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Calculate maximum visible cards (limit to prevent too small images)
  const maxVisible = N;
  
  // Base size to fill most of the canvas
  const baseWidth = canvas.width;
  const baseHeight = canvas.height;
  
  // For single image, just center it
  if (N === 1) {
    const img = slotsImages[0];
    if (img) {
      const x = centerX - baseWidth / 2;
      const y = centerY - baseHeight / 2;
      
      const imgRatio = img.width / img.height;
      const targetRatio = baseWidth / baseHeight;
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, baseWidth, baseHeight);
    }
    return;
  }
  
  // For multiple images - fan them out like a deck of cards
  const maxRotation = 0.3; // Maximum rotation in radians (~17 degrees)
  const maxOffsetX = canvas.width * 0.15;
  const maxOffsetY = canvas.height * 0.1;
  
  // Size reduction per card
  const sizeReduction = 0.03; // Each card is 3% smaller than the one behind it
  
  // Draw from back to front (largest to smallest)
  for (let i = 0; i < maxVisible; i++) {
    const imgIndex = i; // Use first images for the stack
    const img = slotsImages[imgIndex];
    if (!img) continue;
    
    // Calculate scale - back cards are larger
    const scale = 1 - (i * sizeReduction);
    const width = baseWidth * scale;
    const height = baseHeight * scale;
    
    // Calculate position - fan out from center
    const progress = i / (maxVisible - 1);
    const rotation = (progress - 0.5) * maxRotation * 2; // -maxRotation to +maxRotation
    
    // Offset for fan effect
    const offsetX = (progress - 0.5) * maxOffsetX * 2;
    const offsetY = (progress - 0.5) * maxOffsetY;
    
    const x = centerX - width / 2 + offsetX;
    const y = centerY - height / 2 + offsetY;
    
    // Opacity - back cards slightly more transparent
    const opacity = 0.7 + (i / maxVisible) * 0.3;
    
    composite.ctx.save();
    composite.ctx.globalAlpha = opacity;
    
    // Apply rotation around center of image
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

function drawCompositeImageStack3() {
  const N = slotsImages.length;
  if (!N) return;

  // Clear canvas with black background
  composite.ctx.fillStyle = "black";
  composite.ctx.fillRect(0, 0, canvas.width, canvas.height);

  // For single image, fill entire canvas
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    }
    return;
  }

  // Calculate optimal scaling to ensure at least 20% visibility for each image
  // We need to find a scale factor where: 1 + r + r² + ... + r^(N-1) ≤ 1 (for width/height coverage)
  // But we also need to ensure each image has 20% visibility, so we need enough overlap
  let scaleFactor;
  
  if (N === 2) {
    scaleFactor = 0.95; // Second image 60% of first
  } else if (N === 3) {
    scaleFactor = 0.90; // Each subsequent 50% of previous
  } else if (N === 4) {
    scaleFactor = 0.85;
  } else {
    scaleFactor = 0.80; // For 5+ images
  }

  // Position images in a spiral from center
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const angleStep = (Math.PI * 2) / slotsImages.length; // 6 positions around center

  // Calculate maximum initial size to fill canvas
  const initialSize = Math.max(canvas.width, canvas.height);

  slotsImages.forEach((img, i) => {
    if (!img) return;

    // Calculate size for this image
    const scale = Math.pow(scaleFactor, i);
    const width = initialSize * scale;
    const height = initialSize * scale;

    // Calculate position - spiral out from center
    const angle = angleStep * i;
    const distance = (1 - scale) * initialSize * 0.3; // Closer to center for larger images
    
    const x = centerX - width / 2 + Math.cos(angle) * distance;
    const y = centerY - height / 2 + Math.sin(angle) * distance;

    // Small random rotation for natural look (except first image)
    const rotation = i === 0 ? 0 : (Math.sin(i * 7) * 0.05);

    // Slight transparency for stacked images (except first)
    const opacity = i === 0 ? 1 : 0.9;

    composite.ctx.save();
    composite.ctx.globalAlpha = opacity;

    // Apply rotation around center of image
    composite.ctx.translate(x + width / 2, y + height / 2);
    composite.ctx.rotate(rotation);
    composite.ctx.translate(-x - width / 2, -y - height / 2);

    // Draw white card background (except first image)
    if (i > 0) {
      composite.ctx.fillStyle = 'white';
      composite.ctx.fillRect(x, y, width, height);
    }

    // Draw image
    const padding = i === 0 ? 0 : 8; // No padding for first image
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

    // Add border for stacked images
    if (i > 0) {
      composite.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      composite.ctx.lineWidth = 1;
      composite.ctx.strokeRect(x, y, width, height);
    }

    composite.ctx.restore();
  });
}

function drawCompositeImageStack4() {
  const N = slotsImages.length;
  if (!N) return;

  // Clear canvas
  composite.ctx.fillStyle = "black";
  composite.ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (N === 1) {
    // Single image fills canvas
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    }
    return;
  }

  // Calculate scale factor to ensure at least 20% visibility
  // This formula ensures each image is visible while fitting in canvas
  const scaleFactor = 0.65; // Each image 65% of previous

  // Stack positions - different corners to ensure visibility
  const positions = [
    { x: 0, y: 0, align: 'top-left' }, // First image - full canvas
    { x: 0.7, y: 0.7, align: 'bottom-right' }, // Second - bottom right
    { x: 0.1, y: 0.7, align: 'bottom-left' }, // Third - bottom left
    { x: 0.7, y: 0.1, align: 'top-right' }, // Fourth - top right
    { x: 0.4, y: 0.4, align: 'center' }, // Fifth - center
    { x: 0.1, y: 0.1, align: 'top-left' }, // Sixth - top left
    { x: 0.8, y: 0.8, align: 'bottom-right' } // Seventh - bottom right
  ];

  const baseSize = Math.min(canvas.width, canvas.height);

  slotsImages.forEach((img, i) => {
    if (!img) return;

    // Calculate size
    const scale = Math.pow(scaleFactor, i);
    const width = baseSize * scale;
    const height = baseSize * scale;

    // Get position
    // const pos = positions[Math.min(i, positions.length - 1)];
    // use the positions in a loop
    const pos = positions[i % positions.length];
    let x, y;

    // Calculate position based on alignment
    switch (pos.align) {
      case 'top-left':
        x = canvas.width * pos.x;
        y = canvas.height * pos.y;
        break;
      case 'top-right':
        x = canvas.width * pos.x - width;
        y = canvas.height * pos.y;
        break;
      case 'bottom-left':
        x = canvas.width * pos.x;
        y = canvas.height * pos.y - height;
        break;
      case 'bottom-right':
        x = canvas.width * pos.x - width;
        y = canvas.height * pos.y - height;
        break;
      case 'center':
        x = canvas.width * pos.x - width / 2;
        y = canvas.height * pos.y - height / 2;
        break;
    }

    // Ensure within bounds
    x = Math.max(0, Math.min(x, canvas.width - width));
    y = Math.max(0, Math.min(y, canvas.height - height));

    // Small rotation for natural look (except first image)
    const rotation = i === 0 ? 0 : (Math.sin(i * 5) * 0.03);

    composite.ctx.save();
    
    // Apply rotation
    composite.ctx.translate(x + width / 2, y + height / 2);
    composite.ctx.rotate(rotation);
    composite.ctx.translate(-x - width / 2, -y - height / 2);

    // For first image, draw directly without background
    if (i === 0) {
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
      
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    } else {
      // For stacked images, draw with white background
      composite.ctx.fillStyle = 'white';
      composite.ctx.fillRect(x, y, width, height);

      // Draw image with padding
      const padding = 5;
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

      // Add border
      composite.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      composite.ctx.lineWidth = 1;
      composite.ctx.strokeRect(x, y, width, height);
    }

    composite.ctx.restore();
  });
}

function drawCompositeImageStack5() {
  const N = slotsImages.length;
  if (!N) return;

  const { width: cw, height: ch } = canvas;
  const ctx = composite.ctx;

  // 1. Determine the Aspect Ratio for the "Books/Cards"
  // We use the first image as a reference, or default to 0.75 (portrait/book shape)
  // if mixed orientations, a fixed ratio (like 0.75) looks neatest for a stack.
  const refImg = slotsImages[N - 1]; // Use top image as reference
  const cardAspect = refImg ? refImg.width / refImg.height : 0.75;

  // 2. Define Spacing logic
  // We want the stack to fan out diagonally to use the whole canvas.
  // We allocate a percentage of the canvas for the "spread" (the offsets)
  // and the rest for the "top card".
  
  // Use 90% of canvas size for safety
  const safeW = cw * 0.9;
  const safeH = ch * 0.9;

  // Calculate how much offset per card. 
  // If N is high, offset is small. If N is low, offset is larger (but capped).
  // We want the total spread to be about 20-40% of the canvas, leaving 60-80% for the card itself.
  let spreadFactor = 0.30; // 30% of space dedicated to the spine offsets
  if (N < 3) spreadFactor = 0.10; // Less spread for fewer items

  // Calculate distinct step size
  // We solve: (CardSize) + (N-1)*step = SafeSize
  // But step is relative to CardSize usually, or relative to Canvas. 
  // Let's determine offsets based on available spread area.
  
  const totalSpreadX = safeW * spreadFactor;
  const totalSpreadY = safeH * spreadFactor;
  
  // Offset per item
  const stepX = N > 1 ? totalSpreadX / (N - 1) : 0;
  const stepY = N > 1 ? totalSpreadY / (N - 1) : 0;

  // 3. Calculate Card Size
  // Remaining space is for the card itself
  const maxCardW = safeW - totalSpreadX;
  const maxCardH = safeH - totalSpreadY;

  // Fit card aspect ratio into the max dimensions
  let cardW = maxCardW;
  let cardH = cardW / cardAspect;

  if (cardH > maxCardH) {
    cardH = maxCardH;
    cardW = cardH * cardAspect;
  }

  // 4. Center the entire bounding box
  // Total used width = cardW + (N-1)*stepX
  // Total used height = cardH + (N-1)*stepY
  const totalUsedW = cardW + (stepX * (N - 1));
  const totalUsedH = cardH + (stepY * (N - 1));
  
  const startX = (cw - totalUsedW) / 2;
  const startY = (ch - totalUsedH) / 2;

  // 5. Draw Loop (From Bottom (0) to Top (N-1))
  for (let i = 0; i < N; i++) {
    const img = slotsImages[i];
    if (!img) continue;

    // Position for this specific card
    const x = startX + (i * stepX);
    const y = startY + (i * stepY);

    ctx.save();

    // Add shadow (Heavy shadow for depth)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 8;

    // Small random rotation for "messy book stack" realism
    // We seed it with 'i' so it's consistent every frame, not jittery
    const rotateDeg = Math.sin(i * 132.5) * 2; // +/- 2 degrees
    const centerX = x + cardW / 2;
    const centerY = y + cardH / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate(rotateDeg * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    // --- Draw Card Base (White Background/Border) ---
    ctx.fillStyle = '#ffffff';
    // Use a path for rounded corners if desired, or simple rect
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 4); // 4px rounded corner
    ctx.fill();

    // --- Draw Image (Aspect Fill/Fit) ---
    // We reset shadow so the image doesn't cast a shadow on its own card
    ctx.shadowColor = 'transparent';

    // Padding inside the white card
    const pad = Math.max(2, cardW * 0.03); // 3% padding
    const contentX = x + pad;
    const contentY = y + pad;
    const contentW = cardW - (pad * 2);
    const contentH = cardH - (pad * 2);

    // Calculate "Cover" fit (Crop to fill) or "Contain" (Letterbox)
    // "Cover" looks better for a stack visualization
    const imgRatio = img.width / img.height;
    const targetRatio = contentW / contentH;
    
    let sx, sy, sWidth, sHeight;

    if (imgRatio > targetRatio) {
      // Image is wider than slot -> Crop sides
      sHeight = img.height;
      sWidth = sHeight * targetRatio;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      // Image is taller than slot -> Crop top/bottom
      sWidth = img.width;
      sHeight = sWidth / targetRatio;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    // Clip to content area (so image doesn't bleed over rounded corners)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(contentX, contentY, contentW, contentH, 2);
    ctx.clip();

    ctx.drawImage(img, sx, sy, sWidth, sHeight, contentX, contentY, contentW, contentH);
    
    ctx.restore(); // Restore clip
    ctx.restore(); // Restore rotation/shadow
  }
}

function drawCompositeImageStack6() {
  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 10 } = Setup.Settings.canvas;
  
  // Grid-like stack - images arranged in rows and columns, all visible
  const maxCols = Math.ceil(Math.sqrt(N));
  const maxRows = Math.ceil(N / maxCols);
  
  // Calculate cell size to fill canvas
  const cellWidth = (canvas.width - spacing * (maxCols - 1)) / maxCols;
  const cellHeight = (canvas.height - spacing * (maxRows - 1)) / maxRows;
  
  // Stack offset for 3D effect
  const stackDepth = Math.min(N, 5); // Maximum stack depth
  const offsetX = 8;
  const offsetY = 8;
  
  // Draw images in grid, with stack effect
  slotsImages.forEach((img, i) => {
    if (!img) return;
    
    const row = Math.floor(i / maxCols);
    const col = i % maxCols;
    
    // Base position in grid
    const baseX = col * (cellWidth + spacing);
    const baseY = row * (cellHeight + spacing);
    
    // Calculate stack position (images further in array appear on top)
    const stackIndex = i % stackDepth;
    const x = baseX + stackIndex * offsetX;
    const y = baseY + stackIndex * offsetY;
    
    // Slight rotation for natural look
    const rotation = (Math.sin(i) * 0.02); // Very slight random rotation
    
    composite.ctx.save();
    
    // Apply rotation around center
    composite.ctx.translate(x + cellWidth / 2, y + cellHeight / 2);
    composite.ctx.rotate(rotation);
    composite.ctx.translate(-x - cellWidth / 2, -y - cellHeight / 2);
    
    // Draw shadow
    composite.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    composite.ctx.shadowBlur = 10;
    composite.ctx.shadowOffsetX = 5;
    composite.ctx.shadowOffsetY = 5;
    
    // Draw white background
    composite.ctx.fillStyle = 'white';
    composite.ctx.fillRect(x, y, cellWidth, cellHeight);
    
    // Draw image with padding
    const padding = 8;
    const imgWidth = cellWidth - padding * 2;
    const imgHeight = cellHeight - padding * 2;
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
    
    composite.ctx.restore();
  });
}

function drawCompositeImageStack7() {
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

function drawCompositeImageStack8() {
  const N = slotsImages.length;
  if (!N) return;

  const ctx = composite.ctx;
  const cw = canvas.width;
  const ch = canvas.height;
  const cx = cw / 2;
  const cy = ch / 2;

  // Base size for the photos (approx 45% of canvas width)
  // We want them large enough to see, small enough to pile up.
  const baseSize = Math.min(cw, ch);

  for (let i = 0; i < N; i++) {
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
  "Shrink": drawCompositeImageStack7,
  "Stack 1": drawCompositeImageStack,
  "Stack 2": drawCompositeImageStack2,
  "Stack 3": drawCompositeImageStack3,
  "Stack 4": drawCompositeImageStack4,
  "Stack 5": drawCompositeImageStack5,
  "Stack 6": drawCompositeImageStack6,
  "Stack 8": drawCompositeImageStack8,
};
