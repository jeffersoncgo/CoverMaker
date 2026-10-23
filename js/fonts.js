// This is the hidden <select> we use to populate new layer clones
const fontSelectElement = document.getElementById("fontSelect");

// Standard fonts that browsers render natively without loading
const WEB_SAFE_FONTS = new Set([
  "Arial", "Verdana", "Times New Roman", "Helvetica", 
  "Georgia", "Courier New", "Brush Script MT", 
  "Trebuchet MS", "Arial Black", "Impact", "Comic Sans MS", "Tahoma"
]);

const fontSources = {
  Google: {
    listFile: "fonts/google-fonts.json",
    cssUrl: "https://fonts.googleapis.com/css2?family="
  }
};

var systemFontsLoaded = false;

// Tracks loaded fonts to prevent redundant network requests/processing
var loadedFonts = new Set();
var FONT_DATABASE = {};
// Stores the raw FontData objects from the OS (required for blob access)
var systemFontObjects = [];

async function loadFontMetadata(source) {
  if (fontSources[source]) {
    try {
      const response = await fetch(fontSources[source].listFile);
      FONT_DATABASE[source] = await response.json();
    } catch (e) {
      console.error("Could not load font metadata for", source, e);
      FONT_DATABASE[source] = [];
    }
  }
}

async function populateFontSelect() {
  // Default fallback fonts
  let localFonts = [
    "Arial", "Verdana", "Times New Roman", "Helvetica",
    "Georgia", "Courier New", "Brush Script MT"
  ];

  // 1. Try to get actual OS fonts
  if ('queryLocalFonts' in window && !systemFontsLoaded) {
    try {
      // Check if page is visible before asking (prevents the specific SecurityError)
      if (document.hidden) {
        throw new Error("Page hidden - deferring font load");
      }

      const rawFonts = await window.queryLocalFonts();
      
      systemFontObjects = rawFonts;
      const uniqueFamilies = new Set(rawFonts.map(f => f.family));
      localFonts = Array.from(uniqueFamilies).sort();
      
      systemFontsLoaded = true; // Success! Don't retry again.

    } catch (err) {
      // If it's the "visible" error, we just log a warning and proceed with fallbacks
      // If it's a "denied" error (user said no), we also proceed with fallbacks
      console.warn("Using web-safe fonts temporarily:", err.message);
    }
  } else if (systemFontsLoaded) {
     // If we are rebuilding the list (e.g. after adding custom fonts)
     // and we already have system fonts, reuse them.
     const uniqueFamilies = new Set(systemFontObjects.map(f => f.family));
     localFonts = Array.from(uniqueFamilies).sort();
  }

  // 2. Prepare Categories
  let categories = {
    // "Custom": ["Add New Font...", ...Object.keys(Setup.customFonts || {})],
    "Local": localFonts,
  };

  // ... (Rest of your category/source loading logic remains the same) ...
  for (const source in fontSources) {
    if (!FONT_DATABASE[source]) {
      await loadFontMetadata(source);
    }
    if (FONT_DATABASE[source]) {
      categories[source] = FONT_DATABASE[source];
    }
  }

  // 3. Build the UI
  // Save current selection to restore it if we are just updating the list
  const currentSelection = fontSelectElement.value;

  fontSelectElement.innerHTML = "";

  for (const category in categories) {
    if (!categories[category] || categories[category].length === 0) continue;

    const group = document.createElement("optgroup");
    group.label = category;

    categories[category].sort().forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      opt.dataset.source = category;
      group.appendChild(opt);
    });

    fontSelectElement.appendChild(group);
  }

  // Restore selection or default to first
  if (currentSelection && Array.from(fontSelectElement.options).some(o => o.value === currentSelection)) {
    fontSelectElement.value = currentSelection;
  } else if (fontSelectElement.selectedIndex === -1) {
    fontSelectElement.selectedIndex = 0;
  }
}

function tryPopulateFontSelect(el) {
  // if current element options is different from the fontSelectElement options,
  // we will get their selected value to restore it later
  // and will populate it with the fontSelectElement options
  if (!systemFontsLoaded && 'queryLocalFonts' in window) {
    populateFontSelect(true);
  }
  if (el.options.length !== fontSelectElement.options.length) {
    const currentSelection = el.value;
    el.innerHTML = fontSelectElement.innerHTML;
    // Restore selection
    if (currentSelection && Array.from(el.options).some(o => o.value === currentSelection)) {
      el.value = currentSelection;
    } else if (el.selectedIndex === -1) {
      el.selectedIndex = 0;
    }
  }
}

function extractNameFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    const nameWithExt = decodeURIComponent(filename);
    const name = nameWithExt.split('.').slice(0, -1).join('.');
    return name || null;
  } catch (e) {
    return null;
  }
}

// function addCustomFont(fontUrl, fontName) {
//   if (!fontUrl) return;
//   if (!fontName) {
//     fontName = extractNameFromUrl(fontUrl) || `Custom Font ${Date.now()}`;
//   }
//   Setup.customFonts = Setup.customFonts || {};
//   Setup.customFonts[fontName] = fontUrl;
//   saveSetup();
//   populateFontSelect(); 
// }

/**
 * Main loading function. 
 * Handles Local (Blob), Custom (URL), and External (CSS Link)
 */
// Canvas weights are keywords relative to 400 (lighter → 100, bold/bolder → 700)
const FONT_WEIGHT_NUMBERS = { lighter: 100, normal: 400, bold: 700, bolder: 700 };

// Faces each Google family has ("400,400i,700"), from fonts/google-fonts-variants.json (generated from
// https://fonts.google.com/metadata/fonts on 2026-10-23). Loaded the first time a variant is needed.
let googleFontVariants = null;
async function getGoogleFontVariants() {
  if (!googleFontVariants) {
    googleFontVariants = fetch('fonts/google-fonts-variants.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
  }
  return googleFontVariants;
}

// Fetched in the background at page load, so the first text layer does not wait for it
if (typeof window !== 'undefined') window.addEventListener('load', () => { getGoogleFontVariants(); });

// The face the browser picks for a weight among the available ones (CSS font matching), or null when that is the
// regular 400 face already loaded
function chooseFontVariant(available, wght, ital) {
  const faces = available.split(',').map(k => ({ w: parseInt(k), i: k.endsWith('i') ? 1 : 0 }));
  const weights = [...new Set(faces.map(f => f.w))].sort((a, b) => a - b);
  let chosen;
  if (wght > 500) chosen = weights.find(w => w >= wght) ?? [...weights].reverse().find(w => w > 400);
  else if (wght < 400) chosen = [...weights].reverse().find(w => w <= wght) ?? weights.find(w => w < 400);
  chosen ??= 400;
  const hasItalic = faces.some(f => f.w === chosen && f.i === 1);
  const useItalic = ital && hasItalic ? 1 : 0;
  if (!faces.some(f => f.w === chosen && f.i === useItalic)) return null;
  if (chosen === 400 && !useItalic) return null;
  return { wght: chosen, ital: useItalic };
}

// Loads the real face for a weight/style other than regular 400 (Google Fonts only). Only faces the family has are
// requested; without one, nothing changes and the browser synthesizes bold/italic, as it always did.
async function loadFontVariant(source, fontName, weight, style) {
  if (source !== 'Google' || !fontSources[source] || Setup?.Fonts?.loadVariants === false) return false;
  const requestedWeight = FONT_WEIGHT_NUMBERS[weight] ?? (parseInt(weight) || 400);
  const requestedItalic = (style === 'italic' || style === 'oblique') ? 1 : 0;
  if (requestedWeight === 400 && !requestedItalic) return false;
  const available = (await getGoogleFontVariants())[fontName];
  if (!available) return false;
  const variant = chooseFontVariant(available, requestedWeight, requestedItalic);
  if (!variant) return false;
  const { wght, ital } = variant;
  const key = `${fontName.trim().toLowerCase().replace(/\s+/g, '-')}:${ital},${wght}`;
  if (!document.querySelector(`link[data-font-variant="${key}"]`)) {
    const ok = await new Promise((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${fontSources[source].cssUrl}${encodeURIComponent(fontName)}:ital,wght@${ital},${wght}`;
      link.dataset.fontVariant = key;
      link.onload = () => resolve(true);
      link.onerror = () => { link.remove(); resolve(false); };
      document.head.appendChild(link);
    });
    if (!ok) return false;
  }
  await document.fonts.load(`${ital ? 'italic' : 'normal'} ${wght} 1em "${fontName}"`);
  return true;
}

// Turning the option off removes the faces loaded by loadFontVariant (their @font-face rules go with the links)
function unloadFontVariants() {
  document.querySelectorAll('link[data-font-variant]').forEach(link => link.remove());
}

async function loadFont(source, fontName, weight = 'normal', style = 'normal') {
  if (!fontName || !source) return false;

  const cacheKey = `${source}::${fontName}`;
  if (loadedFonts.has(cacheKey)) {
    try { await loadFontVariant(source, fontName, weight, style); } catch (e) { /* keep the regular face */ }
    return true;
  }

  try {
    // --- STRATEGY 1: LOCAL OS FONTS ---
    if (source === "Local") {
      
      // CHECK: If it is a standard font, do NOT try to load it manually.
      // The browser already has it.
      if (WEB_SAFE_FONTS.has(fontName)) {
        console.log(`Skipped manual load for web-safe font: ${fontName}`);
        loadedFonts.add(cacheKey);
        return true;
      }

      // If it's NOT safe (e.g. "AniMe Vision"), load the blob
      const fontData = systemFontObjects.find(f => f.family === fontName);
      
      if (fontData) {
        const blob = await fontData.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        try {
          const fontFace = new FontFace(fontName, `url(${blobUrl})`);
          document.fonts.add(fontFace);
          await fontFace.load();
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      } 
    } 

    // --- STRATEGY 2: CUSTOM UPLOADED FONTS ---
    // else if (source === "Custom") {
    //   if(fontName === "Add New Font...") return false;
    //   const url = Setup.customFonts ? Setup.customFonts[fontName] : null;
    //   if (!url) throw new Error("Custom font URL not found");

    //   const fontFace = new FontFace(fontName, `url(${url})`);
    //   document.fonts.add(fontFace);
    //   await fontFace.load();
    // }

    // --- STRATEGY 3: GOOGLE / EXTERNAL ---
    else if (fontSources[source]) {
      const normalized = fontName.trim().toLowerCase().replace(/\s+/g, '-');
      
      if (!document.querySelector(`link[data-font="${normalized}"]`)) {
        await new Promise((resolve, reject) => {
          const baseUrl = fontSources[source].cssUrl;
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = `${baseUrl}${encodeURIComponent(fontName)}`;
          link.dataset.font = normalized;
          link.onload = resolve;
          link.onerror = () => reject(new Error(`Failed to load CSS: ${link.href}`));
          document.head.appendChild(link);
        });
      }
    }

    // --- FINAL VERIFICATION ---
    await document.fonts.load(`1em "${fontName}"`);
    
    loadedFonts.add(cacheKey);
    try { await loadFontVariant(source, fontName, weight, style); } catch (e) { /* keep the regular face */ }
    return true;

  } catch (err) {
    console.error(`Failed to load font: ${fontName} from ${source}`, err);
    return false;
  }
}