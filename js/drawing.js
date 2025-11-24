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
/**
 * Load an image from various sources (URL, File, Blob, or Image element)
 * Converts external URLs to Blob URLs to avoid CORS issues and improve performance
 * @param {string|File|Blob|Image} file - Source of the image
 * @returns {Promise<Image>} Promise that resolves with the loaded Image element
 */
function loadImage(file) {
  if(!file)
    return Promise.reject(new Error('No file provided'));
  
  // If it's already an Image element, just return its src
  if (file instanceof Image) {
    file = file.src;
  }
  
  // If it's a string URL
  if (typeof file === "string") {
    // If it's already a Blob URL or Data URL, just load it directly
    if (isBlobUrl(file) || isDataUrl(file)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      return new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = file;
      });
    }
    
    // For external URLs, convert to Blob URL first
    return new Promise(async (resolve, reject) => {
      try {
        const blobUrl = await urlToBlob(file);
        const img = new Image();
        
        img.onload = () => resolve(img);
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Failed to load image from URL'));
        };
        img.src = blobUrl;
      } catch (error) {
        // If conversion fails, try loading the original URL
        console.warn('Failed to convert to Blob URL, trying original:', error);
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = file;
      }
    });
  }
  
  // If it's a File or Blob object
  if (file instanceof Blob) {
    return new Promise((resolve, reject) => {
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load image from Blob'));
      };
      img.src = blobUrl;
    });
  }
  
  return Promise.reject(new Error('Unsupported file type'));
}

/**
 * Safely revoke a Blob URL from an image element
 * @param {HTMLImageElement|string} imgOrSrc - Image element or URL string
 */
function revokeBlobUrl(imgOrSrc) {
  try {
    const url = typeof imgOrSrc === 'string' ? imgOrSrc : imgOrSrc?.src;
    if (url && isBlobUrl(url)) {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error revoking Blob URL:', error);
  }
}

/**
 * Revoke all Blob URLs from an array of images
 * Useful for bulk cleanup operations
 * @param {Array<HTMLImageElement|string>} images - Array of images or URLs
 */
function revokeAllBlobUrls(images) {
  if (!Array.isArray(images)) return;
  
  images.forEach(img => {
    if (img) {
      revokeBlobUrl(img);
    }
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
    // ⭐️ Skip disabled layers
    if (layer.enabled === false) return;
    
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
    ctx.save(); // Save context for the whole layer (includes rotation)

    // --- Apply Rotation ---
    // Rotation is applied around the text position
    if (layer.position.rotation && layer.position.rotation !== 0) {
      ctx.translate(finalX, finalY);
      ctx.rotate((layer.position.rotation * Math.PI) / 180);
      ctx.translate(-finalX, -finalY);
    }

    // Set common text properties
    ctx.font = layer.fontStyle;
    ctx.textAlign = layer.position.textAlign;
    ctx.textBaseline = layer.position.textBaseline;

    // --- Draw Shadows ---
    // We draw shadows FIRST, from bottom to top
    // This implementation draws shadows as offset, blurred text
    layer.shadows.forEach(shadow => {
      // ⭐️ Skip disabled shadows
      if (shadow.enabled === false) return;
      
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
      // ⭐️ Skip disabled strokes
      if (stroke.enabled === false) return;
      
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

    ctx.restore(); // Restore context for the whole layer (resets rotation)
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


/**
 * Check if a URL is a Blob URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isBlobUrl(url) {
  return url.startsWith('blob:');
}

/**
 * Check if a URL is a Data URL (Base64)
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isDataUrl(url) {
  return url.startsWith('data:');
}

/**
 * Convert a URL to a Blob URL by fetching and creating an object URL
 * This is useful for external images to avoid CORS issues and improve performance
 * @param {string} url - Image URL to convert
 * @returns {Promise<string>} Blob URL
 */
async function urlToBlob(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error converting URL to Blob:', error);
    throw error;
  }
}

/**
 * Convert an Image element to a Blob
 * More memory-efficient than Base64 for large images
 * @param {HTMLImageElement} imgElem - Image element to convert
 * @param {string} mime - MIME type (default: image/png)
 * @param {number} quality - Image quality 0-1 (for jpeg/webp)
 * @returns {Promise<Blob>}
 */
async function imgToBlob(imgElem, mime = "image/png", quality = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = imgElem.naturalWidth || imgElem.width;
  canvas.height = imgElem.naturalHeight || imgElem.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElem, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert image to Blob'));
      }
    }, mime, quality);
  });
}

/**
 * Convert an Image element to a Blob URL
 * @param {HTMLImageElement} imgElem - Image element to convert
 * @param {string} mime - MIME type (default: image/png)
 * @param {number} quality - Image quality 0-1 (for jpeg/webp)
 * @returns {Promise<string>} Blob URL
 */
async function imgToBlobUrl(imgElem, mime = "image/png", quality = 0.95) {
  const blob = await imgToBlob(imgElem, mime, quality);
  return URL.createObjectURL(blob);
}
