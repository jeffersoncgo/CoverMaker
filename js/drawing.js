const stepsCache = [];
let lastStepIndex = 0;
const stepExamplee = {
  canvas: null,
  ctx: null,
  index: 0,
  params: {},
  previousStepHash: 0
}

function tagFn(fn) {
  if(!fn || typeof fn !== 'function')
    return '';
  if (!fn.__uid) {
    Object.defineProperty(fn, "__uid", {
      value: Math.random().toString(36).substring(2) + Date.now().toString(36),
      writable: false,
    });
  }
  return fn.__uid;
}

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

function stepHash(params, previousStepHash = 0) {
  const paramString = JSON.stringify(params);
  let hash = 0;
  for (let i = 0; i < paramString.length; i++) {
    const char = paramString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  if (previousStepHash) {
    hash ^= previousStepHash;
  }
  return hash;
}

async function runStep(prevHash = 0, fn, ...params) {
  const index = lastStepIndex;
  lastStepIndex++;
  const newHash = stepHash({params, fnId: `${tagFn(fn)}_${index}`}, prevHash);
  const cached = stepsCache[index];

  if (cached && cached.hash === newHash) {
    // console.log(`Reusing cached step ${index}`, params);
    return cached; // reuse canvas + ctx
  }// else {
  //   console.log(`Running step ${index}`, fn, params);
  // }

  if (typeof params != 'object' || params === null)
    params = [];
  
  // console.log({fn, index, newHash, prevHash, ...params });
  const result = typeof fn == 'function' ? await fn(...params) : [...params];
  // console.log(`Caching step ${index}`, fn, result, params);
  stepsCache[index] = { hash: newHash, ...result, index };
  return stepsCache[index];
}

function markStepDirty(index) {
  if (stepsCache[index]) {
    stepsCache[index] = null;
  }
}

function clearStepsCache() {
  stepsCache.length = 0;
  composite.lastHash = null;
  lastStepIndex = 0;
}

function createCanvas(w, h, abortSignal) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function cloneCanvas(sourceCanvas, abortSignal) {
  const newCanvas = createCanvas(sourceCanvas.width, sourceCanvas.height, abortSignal);
  const newCtx = newCanvas.getContext('2d');
  newCtx.drawImage(sourceCanvas, 0, 0);
  return {canvas: newCanvas, ctx: newCtx, abortSignal};
}

// ======================
// Image Handling Utilities
// ======================

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
  if(!imgOrSrc) return;
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
  images.forEach(revokeBlobUrl);
}

// ======================
// Canvas Drawing Functions (Core)
// ======================


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

function setCanvasSize(width, height) {
  composite.size.width = width;
  composite.size.height = height;
  mainCanvas.width = width;
  mainCanvas.height = height;
  mainCanvas.style.aspectRatio = width / height;
  drawComposite();
}

// Extract AbortSignal from params if present
function extractAbortSignal(params) {
  if (!params || params.length === 0) return null;
  for (const param of params) {
    if(param?.constructor?.name === 'AbortSignal')
      return param;
  }
  return null;
}

async function drawComposite(...params) {
  lastStepIndex = 0; // reset step index for caching

  const abortSignal = extractAbortSignal(params);

  const canvasSize = await runStep(null, null, window.composite.size, abortSignal);//This will create the initial canvas, only so we have something to draw on, and have a initial hash
  // after this point canvasSize alrady carry the abort signal and hash
  if(!canvasSize || !canvasSize[0].width || !canvasSize[0].height) return;
  
  window.Composites ??= {}; // Ensure global Composites object exists

  window.Composites.Image = await drawCompositeImage(canvasSize.hash, abortSignal); //canvasSize is passed, so if changed, it will force all steps to redraw
  if(!window.Composites.Image || !window.Composites.Image.ctx || !window.Composites.Image.canvas) return;
  
  window.Composites.Text = await drawCompositeText(canvasSize.hash, canvasSize[0].width, canvasSize[0].height, abortSignal); //canvasSize is passed, so if changed, it will force all steps to redraw

  const newHash = stepHash({ imageHash: window.Composites.Image.hash, textHash: window.Composites.Text?.hash || 0 });
  if(composite.lastHash === newHash) {
    console.log('No changes detected, skipping redraw');
    return; // No changes, skip redraw
  }
  composite.lastHash = newHash;

  if(window.Composites.Text && window.Composites.Text.ctx && window.Composites.Text.canvas) {
    window.Composites.Merged = mergeCanvases(window.Composites.Image.canvas, window.Composites.Text.canvas, 0, 0, 1.0, ...params);
    await copyCompositeToMainCanvas({canvas: window.Composites.Merged}, ...params);//ctx not needed here
  } else {
    await copyCompositeToMainCanvas(window.Composites.Image, ...params);
  }
}

function mergeCanvases(baseCanvas, overlayCanvas, x = 0, y = 0, alpha = 1.0) {
  const mergedCanvas = createCanvas(baseCanvas.width, baseCanvas.height);
  const mergedCtx = mergedCanvas.getContext('2d');
  mergedCtx.drawImage(baseCanvas, 0, 0);
  mergedCtx.globalAlpha = alpha;
  mergedCtx.drawImage(overlayCanvas, x, y);
  mergedCtx.globalAlpha = 1.0;
  return mergedCanvas;
}


async function copyCompositeToMainCanvas(composite) {
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
  mainCtx.drawImage(composite.canvas, 0, 0);
}

async function applyImageEffects(canvas, ctx, hash, abortSignal) {
  try {
    console.log('Applying image effects...');
    // 1. Initialize with the starting canvas
    
    const effects = projectConfig.canvas.effects || [];

    if(!canvas || !ctx || effects.length === 0) {
      return { canvas, ctx, hash };
    }

    // 2. Loop sequentially (one by one)
    for (const eff of effects) {
      if (!eff.enabled) continue; 

      const effectDef = EFFECTS_REGISTRY[eff.type];
      if (!effectDef) continue;

      // 3. Clone the CURRENT state
      // On the first loop, this clones the Original.
      // On the second loop, this clones the Result of the first loop (e.g., the blurred image).
      const cloned = cloneCanvas(canvas, abortSignal);
      
      // Update local references to point to the new clone
      canvas = cloned.canvas;
      ctx = cloned.ctx;
      
      // 4. Apply the effect to the clone
      // The 'await' ensures we don't start the next loop until this is totally finished
      const result = await runStep(hash, effectDef.apply, ctx, canvas, eff.params || {}, abortSignal, eff);
      // 5. Update the accumulators
      // The output of this step becomes the input for the next step
      canvas = result.canvas;
      ctx = result.ctx;
      hash = result.hash;
    }

    // Return the final result after all layers are applied
    return { canvas, ctx, hash, abortSignal };
  } catch (err) {
    console.error('Error applying effect layers:', err);
  }
}

/**
 * Apply a composite drawing from the registry onto a provided context and canvas.
 * If no target context/canvas are provided, defaults to the visible `ctx`/`canvas`.
 * Returns true if the composite was applied, false otherwise.
 *
 * @param {CanvasRenderingContext2D} [targetCtx] - Context to draw into (defaults to `ctx`).
 * @param {HTMLCanvasElement} [targetCanvas] - Canvas associated with the context (defaults to `canvas`).
 * @param {Object} [options] - Optional overrides for type and params. Example: { type: 'line', params: {} }
 * @returns {boolean} True if a composite was applied, false if not.
 */
async function applyComposite(canvas, ctx, options = {}, slotsImages = [], hash, abortSignal) {
  const cloned = cloneCanvas(canvas, abortSignal);
  canvas = cloned.canvas;
  ctx = cloned.ctx;
  try {
    if (typeof ensureCompositeDefaults === 'function') try { ensureCompositeDefaults(abortSignal); } catch(e) {}
    const eff = projectConfig.canvas.composite || {};

    if (eff.enabled === false) return false;

    const type = options.type || eff.type || projectConfig.canvas.type;
    const params = options.params || eff.params || {};

    const effectDef = (typeof COMPOSITE_REGISTRY !== 'undefined') ? COMPOSITE_REGISTRY[type] : undefined;
    if (!effectDef) return false;

    return await runStep(hash, effectDef.apply, ctx, canvas, slotsImages, params, abortSignal, { srcOnly: slotsImages.map(img => fnv1a(img?.src  || '')) }, eff);
  } catch (err) {
    console.error('Error applying composite effect:', err);
    return {};
  }
}

// ======================
// Canvas Drawing Functions (Text)
// ======================

async function creteTransparentCanvas(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = "rgba(0,0,0,0)"; // No overlay
  ctx.clearRect(0, 0, width, height);
  // ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

async function createBaseTextLayer(width, height, text, position, fontStyle, fillStyle, abortSignal) {
  // Create a transparent canvas for this specific text layer
  const { canvas, ctx } = await creteTransparentCanvas(width, height);
  
  // --- Calculate Position ---
  let anchorX = 0;
  if (position.textAlign === 'center') anchorX = width / 2;
  else if (position.textAlign === 'right') anchorX = width;

  let anchorY = 0;
  if (position.textBaseline === 'middle') anchorY = height / 2;
  else if (position.textBaseline === 'bottom') anchorY = height;

  const finalX = anchorX + position.x;
  const finalY = anchorY + position.y;

  // --- Setup Context ---
  ctx.font = fontStyle;
  ctx.textAlign = position.textAlign;
  ctx.textBaseline = position.textBaseline;

  // --- Apply Rotation ---
  if (position.rotation && position.rotation !== 0) {
    ctx.translate(finalX, finalY);
    ctx.rotate((position.rotation * Math.PI) / 180);
    ctx.translate(-finalX, -finalY);
  }

  // --- Draw Main Fill ---
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, finalX, finalY);

  // Return canvas + metadata needed for effects (x, y, text)
  return { canvas, ctx, meta: { text, x: finalX, y: finalY }, abortSignal  };
}

async function mergeImageLayers(canvasList, abortSignal) {
  // This wil initially crete an empty canvas
  // It will then loop over each canvas in the list and draw it onto the main canvas
  if (!Array.isArray(canvasList) || canvasList.length === 0) {
    return null;
  }
  const baseCanvas = canvasList[0];
  const mergedCanvas = createCanvas(baseCanvas.width, baseCanvas.height, abortSignal);
  const mergedCtx = mergedCanvas.getContext('2d');
  for (const layerCanvas of canvasList) {
    mergedCtx.drawImage(layerCanvas, 0, 0);
  }
  return { canvas: mergedCanvas, ctx: mergedCtx, abortSignal };
}

async function drawCompositeText(canvasHash, width, height, abortSignal) {
  try {
    // 1. Initialize Background / base info
    const layers = projectConfig.textLayers || [];

    // Collection of per-layer canvases (isolated text layers)
    const imgLayers = [];
    // Optional: track hashes per layer if you want a composite hash
    const layerHashes = [];

    // 2. Process each text layer independently
    for (const layer of layers) {
      if (layer.enabled === false) continue;

      // ----- PHASE A: Generate the Isolated Text Layer -----

      // A1: Start hash for this layer from the canvasHash
      let layerHash = canvasHash;

      // A2: Create the base text graphic (raw text on transparent)
      const baseResult = await runStep(
        layerHash,
        createBaseTextLayer,
        width,
        height,
        layer.overlayText,
        layer.position,
        layer.fontStyle,
        layer.fillStyle,
        abortSignal
      );

      let { canvas, ctx, hash, meta } = baseResult;
      const { text, x, y } = meta;
      layerHash = hash;

      // A3: Apply Text Effects to this Isolated Layer
      const textEffects = layer.effects || [];

      for (const eff of textEffects) {
        if (!eff.enabled) continue;

        const effectDef = TEXT_EFFECTS[eff.type];
        if (!effectDef) continue;

        // Clone the TEXT canvas (not the main background)
        const clonedText = cloneCanvas(canvas, abortSignal);
        canvas = clonedText.canvas;
        ctx = clonedText.ctx;

        const res = await runStep(
          layerHash,
          effectDef.apply,
          ctx,
          canvas,
          text,
          x,
          y,
          eff.params || {},
          abortSignal,
          eff
        );

        canvas = res.canvas;
        ctx = res.ctx;
        layerHash = res.hash;
      }

      // A4: Store finished text layer canvas for merging later
      imgLayers.push(canvas);
      layerHashes.push(layerHash);
    }

    // 3. Merge all isolated text layers onto a final composite
    // Decide how to compute the final hash.
    // Option 1: let mergeImageLayers derive a new hash from canvasHash + layerHashes
    const merged = await runStep(
      canvasHash,
      mergeImageLayers,
      imgLayers,
      layerHashes, // optional extra param if mergeImageLayers accepts it
      abortSignal 
    );

    const finalHash = merged.hash ?? canvasHash; // fallback to canvasHash if merge doesn't return one

    return {
      canvas: merged.canvas,
      ctx: merged.ctx,
      hash: finalHash,
      abortSignal
    };
  } catch (err) {
    console.error('Error in drawCompositeText:', err);
    return canvasHash; // Return original state on error
  }
}

// ======================
// Canvas Drawing Functions (Background)
// ======================

async function createBackgroundCanvas(abortSignal) {
  const canvas = createCanvas(composite.size.width, composite.size.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = projectConfig.canvas.backgroundColor || '#000000';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  window.temp1 = canvas;
  window.temp1Ctx = ctx;
  return { canvas, ctx, abortSignal };
}

async function drawCompositeImage(canvasHash, abortSignal) {
  try {
    const canvas = await runStep(canvasHash, createBackgroundCanvas, abortSignal);
    const imageCanvas = await applyComposite(canvas.canvas, canvas.ctx, {}, slotsImages, canvasHash, abortSignal);

    return await applyImageEffects( imageCanvas.canvas, imageCanvas.ctx, imageCanvas.hash, abortSignal);
  } catch (err) {
    const type = Setup?.Settings?.canvas?.composite?.type || Setup?.Settings?.canvas?.type;
    const msg = `Error applying composite "${type}" via COMPOSITE_REGISTRY: ${err?.message || err}`;
    console.error(msg, err);
    if (typeof toastMessage === 'function') {
      try { toastMessage(msg, { type: 'danger', duration: 6000 }); } catch (tErr) { console.error('Toast error:', tErr) }
    }
    return {canvasHash}; // Stop execution
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
async function imgToBlob(imgElem, mime = "image/webp", quality = 0.95) {
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

function cropCanvas(sourceCanvas) {
  const ctx = sourceCanvas.getContext('2d');
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  
  // 1. Get the raw pixel data
  // Warning: This will fail if the canvas is "tainted" (has images from other domains without CORS)
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let top = 0, bottom = h, left = 0, right = w;

  // 2. Scan for Top
  // We loop through rows until we find a non-transparent pixel
  top: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Check Alpha channel (every 4th byte: R, G, B, A)
      if (data[(y * w + x) * 4 + 3] > 0) {
        top = y;
        break top; // Stop outer loop
      }
    }
  }

  // If top is still 0 (and we didn't break), the canvas might be empty.
  // However, we need to verify if the very first pixel was empty or if the whole thing is empty.
  // A quick check: if we looped through everything and found nothing.
  // (Simplification: We assume if top didn't break loop logic, we might be at the end, 
  // but let's handle the "Empty Canvas" case at the end).

  // 3. Scan for Bottom
  bottom: for (let y = h - 1; y >= top; y--) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        bottom = y + 1; // +1 because we want the height to include this row
        break bottom;
      }
    }
  }

  // Check if empty canvas
  if (bottom <= top) {
     return null; // Canvas is fully transparent
  }

  // 4. Scan for Left (Restrict Y loop to top/bottom bounds for speed)
  left: for (let x = 0; x < w; x++) {
    for (let y = top; y < bottom; y++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        left = x;
        break left;
      }
    }
  }

  // 5. Scan for Right
  right: for (let x = w - 1; x >= left; x--) {
    for (let y = top; y < bottom; y++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        right = x + 1;
        break right;
      }
    }
  }

  // 6. Cut the content
  const croppedWidth = right - left;
  const croppedHeight = bottom - top;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;
  
  // Draw the specific region from source to the new canvas
  croppedCanvas.getContext('2d').drawImage(
    sourceCanvas, 
    left, top, croppedWidth, croppedHeight, // Source Rect
    0, 0, croppedWidth, croppedHeight       // Dest Rect
  );

  return croppedCanvas;
}