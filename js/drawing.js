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
  const result = typeof fn == 'function' ? await fn(...params) : {...params[0]};
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
  stepsCache = [];
}

function createCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function cloneCanvas(sourceCanvas) {
  const newCanvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const newCtx = newCanvas.getContext('2d');
  newCtx.drawImage(sourceCanvas, 0, 0);
  return {canvas: newCanvas, ctx: newCtx};
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

async function drawComposite() {
  lastStepIndex = 0; // reset step index for caching
  const canvasSize = await runStep(null, null, window.composite.size);//This will create the initial canvas, only so we have something to draw on, and have a initial hash
  if(!canvasSize || !canvasSize.width || !canvasSize.height) return;
  
  window.Composites ??= {}; // Ensure global Composites object exists

  window.Composites.Image = await drawCompositeImage(canvasSize); //canvasSize is passed, so if changed, it will force all steps to redraw
  if(!window.Composites.Image || !window.Composites.Image.ctx || !window.Composites.Image.canvas) return;
  
  window.Composites.Text = await drawCompositeText(canvasSize); //canvasSize is passed, so if changed, it will force all steps to redraw

  const newHash = stepHash({ imageHash: window.Composites.Image.hash, textHash: window.Composites.Text?.hash || 0 });
  if(composite.lastHash === newHash) {
    console.log('No changes detected, skipping redraw');
    return; // No changes, skip redraw
  }
  composite.lastHash = newHash;

  if(window.Composites.Text && window.Composites.Text.ctx && window.Composites.Text.canvas) {
    window.Composites.Merged = mergeCanvases(window.Composites.Image.canvas, window.Composites.Text.canvas, 0, 0, 1.0);
    await copyCompositeToMainCanvas({canvas: window.Composites.Merged});//ctx not needed here
  } else {
    await copyCompositeToMainCanvas(window.Composites.Image);
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

async function applyImageEffects(..._params) {
  try {
    console.log('Applying image effects...');
    // 1. Initialize with the starting canvas
    let { canvas, ctx, hash } = _params[0] || {};
    
    const effects = Setup.Settings.canvas.effects || [];

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
      const cloned = cloneCanvas(canvas);
      
      // Update local references to point to the new clone
      canvas = cloned.canvas;
      ctx = cloned.ctx;
      
      // 4. Apply the effect to the clone
      // The 'await' ensures we don't start the next loop until this is totally finished
      const result = await runStep(hash, effectDef.apply, ctx, canvas, eff.params || {}, eff);
      // 5. Update the accumulators
      // The output of this step becomes the input for the next step
      canvas = result.canvas;
      ctx = result.ctx;
      hash = result.hash;
    }

    // Return the final result after all layers are applied
    return { canvas, ctx, hash };
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
async function applyComposite(..._params) {
  let {canvas, ctx, options = {}, slotsImages = [], hash} = _params[0] || {};
  const cloned = cloneCanvas(canvas);
  canvas = cloned.canvas;
  ctx = cloned.ctx;
  try {
    if (typeof ensureCompositeDefaults === 'function') try { ensureCompositeDefaults(); } catch(e) {}
    const eff = Setup.Settings.canvas.composite || {};

    if (eff.enabled === false) return false;

    const type = options.type || eff.type || Setup.Settings.canvas.type;
    const params = options.params || eff.params || {};

    const effectDef = (typeof COMPOSITE_REGISTRY !== 'undefined') ? COMPOSITE_REGISTRY[type] : undefined;
    if (!effectDef) return false;

    return await runStep(hash, effectDef.apply, ctx, canvas, slotsImages, params, { srcOnly: slotsImages.map(img => fnv1a(img?.src  || '')) }, eff);
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

async function createBaseTextLayer(width, height, text, position, fontStyle, fillStyle) {
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
  return { canvas, ctx, meta: { text, x: finalX, y: finalY } };
}

async function mergeImageLayers(canvasList) {
  // This wil initially crete an empty canvas
  // It will then loop over each canvas in the list and draw it onto the main canvas
  if (!Array.isArray(canvasList) || canvasList.length === 0) {
    return null;
  }
  const baseCanvas = canvasList[0];
  const mergedCanvas = createCanvas(baseCanvas.width, baseCanvas.height);
  const mergedCtx = mergedCanvas.getContext('2d');
  for (const layerCanvas of canvasList) {
    mergedCtx.drawImage(layerCanvas, 0, 0);
  }
  return { canvas: mergedCanvas, ctx: mergedCtx };
}

async function drawCompositeText(..._params) {
  try {
    // 1. Initialize Background / base info
    const canvasSize = _params[0] || {};
    const { width, height, hash: initialHash } = canvasSize;

    const layers = Setup.Settings.textLayers || [];

    // Collection of per-layer canvases (isolated text layers)
    const imgLayers = [];
    // Optional: track hashes per layer if you want a composite hash
    const layerHashes = [];

    // 2. Process each text layer independently
    for (const layer of layers) {
      if (layer.enabled === false) continue;

      // ----- PHASE A: Generate the Isolated Text Layer -----

      // A1: Start hash for this layer from the initialHash
      let layerHash = initialHash;

      // A2: Create the base text graphic (raw text on transparent)
      const baseResult = await runStep(
        layerHash,
        createBaseTextLayer,
        width,
        height,
        layer.overlayText,
        layer.position,
        layer.fontStyle,
        layer.fillStyle
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
        const clonedText = cloneCanvas(canvas);
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
    // Option 1: let mergeImageLayers derive a new hash from initialHash + layerHashes
    const merged = await runStep(
      initialHash,
      mergeImageLayers,
      imgLayers,
      layerHashes // optional extra param if mergeImageLayers accepts it
    );

    const finalHash = merged.hash ?? initialHash; // fallback to initialHash if merge doesn't return one

    return {
      canvas: merged.canvas,
      ctx: merged.ctx,
      hash: finalHash,
    };
  } catch (err) {
    console.error('Error in drawCompositeText:', err);
    return _params[0]; // Return original state on error
  }
}

// ======================
// Canvas Drawing Functions (Background)
// ======================

async function createBackgroundCanvas() {
  const canvas = createCanvas(composite.size.width, composite.size.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = Setup.Settings.canvas.backgroundColor || '#000000';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  window.temp1 = canvas;
  window.temp1Ctx = ctx;
  return { canvas, ctx };
}

async function drawCompositeImage(...canvasSize) {
  try {
    // Let's fisrt use the run Step and the canvasSize hash to create a cached background canvas
    const canvas = await runStep(canvasSize.hash, createBackgroundCanvas, canvasSize);

    const imageCanvas = await applyComposite({ ...canvas, slotsImages });

    return await applyImageEffects({ ...imageCanvas });
  } catch (err) {
    const type = Setup?.Settings?.canvas?.composite?.type || Setup?.Settings?.canvas?.type;
    const msg = `Error applying composite "${type}" via COMPOSITE_REGISTRY: ${err?.message || err}`;
    console.error(msg, err);
    if (typeof toastMessage === 'function') {
      try { toastMessage(msg, { type: 'danger', duration: 6000 }); } catch (tErr) { console.error('Toast error:', tErr) }
    }
    return {...canvasSize}; // Stop execution
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
