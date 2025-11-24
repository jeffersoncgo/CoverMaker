if (typeof module != 'undefined') {
  utils = require("../../scripts/components/utils/common");
  Jellyfin = require("./jellyfin");
}

// ======================
// DOM Element References
// ======================
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

// Templates
const template = document.getElementById('slot-template');
const coverTemplate = document.getElementById('cover-template');
const posterTemplate = document.getElementById('poster-template');

// ⭐️ NEW: Template References ⭐️
const textLayerTemplate = document.getElementById("text-layer-template");
const strokeTemplate = document.getElementById("stroke-template");
const shadowTemplate = document.getElementById("shadow-template");

// ⭐️ NEW: Container References ⭐️
const textLayersContainer = document.getElementById("text-layers-container");

// Slots
const imageSlots = document.getElementById('image-slots');

// This is the hidden <select> we use to populate new layer clones
const fontSelectElement = document.getElementById("fontSelect");

// Canvas Settings
const RatioSelectElement = document.getElementById("RatioSelect");
const typeSelectElement = document.getElementById("typeSelect");
const customWidthElement = document.getElementById("customWidth");
const customHeightElement = document.getElementById("customHeight");
const overlayOpacityStartElement = document.getElementById("overlayOpacityStart");
const overlayOpacityEndElement = document.getElementById("overlayOpacityEnd");
const overlayColorStartElement = document.getElementById("overlayColorStart");
const overlayColorEndElement = document.getElementById("overlayColorEnd");
const spacingElement = document.getElementById("spaceSize");
const randomSaltElement = document.getElementById("randomSalt");
const blurAmountElement = document.getElementById("blurSize");
const reflectionScaleElement = document.getElementById("reflexDistance");
const reflectionDistanceElement = document.getElementById("reflexScale");
const baseScaleElement = document.getElementById("posterScale");

// Export Settings
const exportFormatSelectElement = document.getElementById("exportFormatSelect");
const jpegQualityElement = document.getElementById("jpegQuality");

// Jellyfin UI
const jellyfinContainer = document.getElementById('jellyfinimages');
const jellyfinloadLibraryBtn = document.getElementById('loadLibraryBtn');
const jellyfinsearchInput = document.getElementById('searchInput');
const jellyfinpostersLimit = document.getElementById('posterslimit')
const jellyfinloginActionBtn = document.getElementById('loginAction');
const jellyfinPreviousPageBtn = document.getElementById('previousPage');
const jellyfinNextPageBtn = document.getElementById('jellyfinNextPage');


// ======================
// Storage Functions
// ======================
function saveFieldsToStorage() {
  if (document.getElementById("Server").value.endsWith("/")) {
    document.getElementById("Server").value = document.getElementById("Server").value.slice(0, -1);
  }
  const server = document.getElementById("Server").value;
  const username = document.getElementById("Username").value;
  const password = document.getElementById("Password").value;
  localStorage.setItem("server", server);
  localStorage.setItem("username", username);
  localStorage.setItem("password", password);
}

function loadFieldsFromStorage() {
  const server = localStorage.getItem("server");
  const username = localStorage.getItem("username");
  const password = localStorage.getItem("password");
  if (server) document.getElementById("Server").value = server;
  if (username) document.getElementById("Username").value = username;
  if (password) document.getElementById("Password").value = password;
}

/**
 * Deep merge two objects, ensuring all keys from defaults exist in target
 * @param {Object} target - The target object to merge into
 * @param {Object} defaults - The default object with all required keys
 * @returns {Object} - Merged object with all default keys
 */
function deepMerge(target, defaults) {
  const result = { ...target };
  
  for (const key in defaults) {
    if (defaults.hasOwnProperty(key)) {
      if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        // Recursively merge nested objects
        result[key] = deepMerge(result[key] || {}, defaults[key]);
      } else if (!(key in result)) {
        // Add missing key from defaults
        result[key] = defaults[key];
      }
    }
  }
  
  return result;
}

function loadFullProjectFromJson(jsonData) {
  // set the memory as not loaded
  window.memoryLoaded = false;
  // first, we need to clear all the text layers
  clearTextLayersMemory();
  // then clear the images using the existing function
  deleteAllSlots();
  if (jsonData.Setup) {
    // Get the default Setup from config.js
    const defaultSetup = window.defaultSetup || Setup;
    // Merge imported Setup with defaults to ensure all keys exist
    Setup = deepMerge(jsonData.Setup, defaultSetup);
    loadTextLayers(Setup.Settings.textLayers);
  }
  // restore also the fields from the expandImageSettings element
  RatioSelectElement.value = Setup.Settings.canvas.format;
  typeSelectElement.value = Setup.Settings.canvas.type;
  randomSaltElement.value = Setup.Settings.canvas.salt;
  overlayColorStartElement.value = Setup.Settings.canvas.overlayColorStart;
  overlayColorEndElement.value = Setup.Settings.canvas.overlayColorEnd;
  overlayOpacityStartElement.value = Setup.Settings.canvas.overlayOpacityStart;
  overlayOpacityEndElement.value = Setup.Settings.canvas.overlayOpacityEnd;
  spacingElement.value = Setup.Settings.canvas.spacing;
  blurAmountElement.value = Setup.Settings.canvas.blurAmount;
  reflectionScaleElement.value = Setup.Settings.canvas.reflectionScale;
  reflectionDistanceElement.value = Setup.Settings.canvas.reflectionDistance;
  baseScaleElement.value = Setup.Settings.canvas.baseScale;
  
  // Restore export settings
  if (Setup.Settings.export) {
    exportFormatSelectElement.value = Setup.Settings.export.format || 'png';
    jpegQualityElement.value = Setup.Settings.export.jpegQuality || 0.95;
  }
  
  // Note: Images are no longer loaded from JSON for performance reasons.
  // Images should be exported/imported using ZIP files.
  // If loading from legacy JSON with image URLs, try to load them
  if (jsonData.imageSlots && Array.isArray(jsonData.imageSlots)) {
    const hasImageUrls = jsonData.imageSlots.some(slot => slot && typeof slot === 'string' && slot !== 'placeholder');
    
    if (hasImageUrls) {
      // Legacy format with URLs
      setSlots(jsonData.imageSlots.length);
      jsonData.imageSlots.forEach((src, i) => {
        if (i >= slotsImages.length || !src || src === 'placeholder')
          return;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          slotsImages[i] = img;
          setSlotImage(i, img);
          updateImageSettings();
        };
        img.onerror = () => {
          console.warn(`Failed to load image from URL: ${src}`);
        };
        img.src = src;
      });
    } else {
      // New format without images (just placeholders)
      setSlots(jsonData.imageSlots.length);
    }
  }
  window.memoryLoaded = true;
  updateImageSettings();
  updateTextSettings();
  saveSetup();
  saveTextLayersToStorage();
  saveFieldsToStorage();
  drawComposite();
}

function makeSaveAllJson() {
  const save = {};
  save.Setup = Setup;
  // Don't include image URLs - images will be exported separately in ZIP
  save.imageSlots = slotsImages.map(img => img ? 'placeholder' : null);
  return JSON.stringify(save, null, 2);
}

function clearTextLayersMemory() {
  textLayersContainer.innerHTML = '';
  Setup.Settings.textLayers = [];
  updateTextSettings();
  localStorage.removeItem("textLayers");
}

function saveSetup() {
  if(window.memoryLoaded)
    localStorage.setItem("setup", JSON.stringify(Setup));
}

function loadSetup() {
  const savedSetup = localStorage.getItem("setup");
  if (savedSetup) {
    const defaultSetup = window.defaultSetup || Setup;
    // Merge saved Setup with defaults to ensure all keys exist
    Setup = deepMerge(JSON.parse(savedSetup), defaultSetup);
  }
}

function clearSavedSetup() {
  localStorage.removeItem("setup");
}

function saveTextLayersToStorage() {
  if(window.memoryLoaded)
    localStorage.setItem("textLayers", JSON.stringify(Setup.Settings.textLayers));
}

function loadTextLayersFromStorage() {
  const savedLayers = localStorage.getItem("textLayers");
  if (savedLayers)
    loadTextLayers(JSON.parse(savedLayers))
}

function loadTextLayers(layersData) {
  window.memoryLoaded = false;
  let idsToCheck = []
  if (layersData) {
    for (let index = 0; index < layersData.length; index++) {
      const layerData = layersData[index];
      const id = ensureUniqueId("layer_{n}", getIndexFromId(layerData.id)).index;
      idsToCheck.push(id)
      // Do manually, using the functions, to add layer, strokes and shadows.
      const newLayerId = addTextLayer(id); // This function should return the ID of the new layer
      const newLayerEl = document.getElementById(newLayerId); // Get the newly created DOM element
      // Populate basic font settings
      newLayerEl.querySelector(".overlayText-input").value = layerData.overlayText;
      newLayerEl.querySelector(".fontSelect-input").value = layerData.font.family;
      newLayerEl.querySelector(".fontWeightSelect-input").value = layerData.font.weight;
      newLayerEl.querySelector(".fontStyleSelect-input").value = layerData.font.style;
      newLayerEl.querySelector(".fontSize-input").value = layerData.font.size;
      newLayerEl.querySelector(".fontColor-input").value = layerData.font.color;
      newLayerEl.querySelector(".fontOpacity-input").value = layerData.font.opacity;
      
      // ⭐️ Restore enabled state for layer
      const layerEnabledCheckbox = newLayerEl.parentElement.parentElement.querySelector(".layer-enabled-checkbox");
      if (layerEnabledCheckbox) {
        layerEnabledCheckbox.checked = layerData.enabled !== false;
      }

      // Populate position settings
      newLayerEl.querySelector(".textAlign-input").value = layerData.position.textAlign;
      newLayerEl.querySelector(".textBaseline-input").value = layerData.position.textBaseline;
      newLayerEl.querySelector(".positionX-input").value = layerData.position.x;
      newLayerEl.querySelector(".positionY-input").value = layerData.position.y;
      newLayerEl.querySelector(".rotation-input").value = layerData.position.rotation || 0;

      // Populate strokes
      for (let index2 = 0; index2 < layerData.strokes.length; index2++) {
        const strokeData = layerData.strokes[index2];
        const strokeEl = newLayerEl.querySelector(`#${addStroke({ target: newLayerEl.querySelector(".add-stroke-btn") })}`).parentElement.querySelector('.stroke-item');
        strokeEl.querySelector(".strokeColor-input").value = strokeData.color;
        strokeEl.querySelector(".strokeWidth-input").value = strokeData.width;
        strokeEl.querySelector(".strokeOpacity-input").value = strokeData.opacity;
        
        // ⭐️ Restore enabled state for stroke
        const strokeEnabledCheckbox = strokeEl.parentElement.parentElement.querySelector(".stroke-enabled-checkbox");
        if (strokeEnabledCheckbox) {
          strokeEnabledCheckbox.checked = strokeData.enabled !== false;
        }
      }

      // Populate shadows
      for (let index3 = 0; index3 < layerData.shadows.length; index3++) {
        const shadowData = layerData.shadows[index3];
        const shadowEl = newLayerEl.querySelector(`#${addShadow({ target: newLayerEl.querySelector(".add-shadow-btn") })}`).parentElement.querySelector('.shadow-item');
        shadowEl.querySelector(".shadowColor-input").value = shadowData.color;
        shadowEl.querySelector(".shadowBlur-input").value = shadowData.blur;
        shadowEl.querySelector(".shadowOffsetX-input").value = shadowData.offsetX;
        shadowEl.querySelector(".shadowOffsetY-input").value = shadowData.offsetY;
        
        // ⭐️ Restore enabled state for shadow
        const shadowEnabledCheckbox = shadowEl.parentElement.parentElement.querySelector(".shadow-enabled-checkbox");
        if (shadowEnabledCheckbox) {
          shadowEnabledCheckbox.checked = shadowData.enabled !== false;
        }
      }
    }
  }
  // check if the dom was updated and all the idsToCheck are in it
  if(idsToCheck.length == layersData.length)
    window.memoryLoaded = true;
  
  updateTextSettings(); // Redraw canvas with loaded settings
}

function loadTextShadows(layerIndex, shadowsData) {
  const layerEl = textLayersContainer.querySelectorAll(".text-layer-item")[layerIndex];
  if (shadowsData) {
    for (let index = 0; index < shadowsData.length; index++) {
      const shadowData = shadowsData[index];
      const shadowEl = layerEl.querySelector(`#${addShadow({ target: layerEl.querySelector(".add-shadow-btn") })}`).parentElement.querySelector('.shadow-item');
      shadowEl.querySelector(".shadowColor-input").value = shadowData.color;
      shadowEl.querySelector(".shadowBlur-input").value = shadowData.blur;
      shadowEl.querySelector(".shadowOffsetX-input").value = shadowData.offsetX;
      shadowEl.querySelector(".shadowOffsetY-input").value = shadowData.offsetY;
      
      // ⭐️ Restore enabled state for shadow
      const shadowEnabledCheckbox = shadowEl.parentElement.parentElement.querySelector(".shadow-enabled-checkbox");
      if (shadowEnabledCheckbox) {
        shadowEnabledCheckbox.checked = shadowData.enabled !== false;
      }
    }
  }
  updateTextSettings(); // Redraw canvas with loaded settings
}

function loadTextStrokes(layerIndex, strokesData) {
  const layerEl = textLayersContainer.querySelectorAll(".text-layer-item")[layerIndex];
  if (strokesData) {
    for (let index = 0; index < strokesData.length; index++) {
      const strokeData = strokesData[index];
      const strokeEl = layerEl.querySelector(`#${addStroke({ target: layerEl.querySelector(".add-stroke-btn") })}`).parentElement.querySelector('.stroke-item');
      strokeEl.querySelector(".strokeColor-input").value = strokeData.color;
      strokeEl.querySelector(".strokeWidth-input").value = strokeData.width;
      strokeEl.querySelector(".strokeOpacity-input").value = strokeData.opacity;
      
      // ⭐️ Restore enabled state for stroke
      const strokeEnabledCheckbox = strokeEl.parentElement.parentElement.querySelector(".stroke-enabled-checkbox");
      if (strokeEnabledCheckbox) {
        strokeEnabledCheckbox.checked = strokeData.enabled !== false;
      }
    }
  }
  updateTextSettings(); // Redraw canvas with loaded settings
}


// ======================
// Tab Functions
// ======================
function changeTab(e) {
  if (!e) return;
  for (const tabName in window.Tabs) {
    window.Tabs[tabName].tab.classList.remove("active");
    window.Tabs[tabName].content.classList.remove("active");
  }

  focusTabName = (e.tagName == 'I' ? e.parentElement : e).id.split("Tab")[0];
  
  window.Tabs[focusTabName].tab.classList.add("active");
  window.Tabs[focusTabName].content.classList.add("active");
}

// ======================
// Settings Handle Functions
// ======================

async function updateTextSettings() {
  // saveTextLayersToStorage()
  // Clear the settings array to rebuild it
  Setup.Settings.textLayers = [];

  const layerElements = textLayersContainer.querySelectorAll(".text-layer-item");

  // Use a sequential for...of loop to handle async font loading
  let layerIndex = 0;
  for (const layerEl of layerElements) {
    const newLayer = {
      font: {},
      position: {},
      strokes: [],
      shadows: [],
      id: layerEl.parentElement.parentElement.id
    };

    // 1. Read Basic Font Settings
    newLayer.overlayText = layerEl.querySelector(".overlayText-input").value || "";
    newLayer.font.family = layerEl.querySelector(".fontSelect-input").value;
    newLayer.font.weight = layerEl.querySelector(".fontWeightSelect-input").value;
    newLayer.font.style = layerEl.querySelector(".fontStyleSelect-input").value;
    newLayer.font.size = parseFloat(layerEl.querySelector(".fontSize-input").value) || 36;
    newLayer.font.color = layerEl.querySelector(".fontColor-input").value || "#ffffff";
    newLayer.font.opacity = parseFloat(layerEl.querySelector(".fontOpacity-input").value) || 0;
    
    // ⭐️ Read enabled state for layer (checkbox is in parent container)
    const layerEnabledCheckbox = layerEl.parentElement.parentElement.querySelector(".layer-enabled-checkbox");
    newLayer.enabled = layerEnabledCheckbox ? layerEnabledCheckbox.checked : true;

    // Build main font string
    newLayer.fontStyle =
      `${newLayer.font.style} ${newLayer.font.weight} ${newLayer.font.size}px "${newLayer.font.family}"`;
    
    // Await font loading
    await loadFont(newLayer.font.family);

    // Build main fillStyle
    let r = parseInt(newLayer.font.color.slice(1, 3), 16);
    let g = parseInt(newLayer.font.color.slice(3, 5), 16);
    let b = parseInt(newLayer.font.color.slice(5, 7), 16);
    newLayer.fillStyle = `rgba(${r}, ${g}, ${b}, ${newLayer.font.opacity})`;

    // 2. Read Position Settings
    newLayer.position.textAlign = layerEl.querySelector(".textAlign-input").value;
    newLayer.position.textBaseline = layerEl.querySelector(".textBaseline-input").value;
    newLayer.position.x = parseFloat(layerEl.querySelector(".positionX-input").value) || 0;
    newLayer.position.y = parseFloat(layerEl.querySelector(".positionY-input").value) || 0;
    newLayer.position.rotation = parseFloat(layerEl.querySelector(".rotation-input").value) || 0;
    layerEl.parentElement.parentElement.setAttribute('layerIndex', layerIndex);

    // 3. Read Stroke Settings
    const strokeElements = layerEl.querySelectorAll(".stroke-item");
    let strokeIndex = 0;
    for (const strokeEl of strokeElements) {
      const newStroke = {};
      newStroke.color = strokeEl.querySelector(".strokeColor-input").value;
      newStroke.width = parseFloat(strokeEl.querySelector(".strokeWidth-input").value) || 1;
      newStroke.opacity = parseFloat(strokeEl.querySelector(".strokeOpacity-input").value) || 0;
      
      // ⭐️ Read enabled state for stroke (checkbox is in parent container)
      const strokeEnabledCheckbox = strokeEl.parentElement.parentElement.querySelector(".stroke-enabled-checkbox");
      newStroke.enabled = strokeEnabledCheckbox ? strokeEnabledCheckbox.checked : true;

      // Build strokeStyle
      r = parseInt(newStroke.color.slice(1, 3), 16);
      g = parseInt(newStroke.color.slice(3, 5), 16);
      b = parseInt(newStroke.color.slice(5, 7), 16);
      newStroke.style = `rgba(${r}, ${g}, ${b}, ${newStroke.opacity})`;
      strokeEl.parentElement.parentElement.setAttribute('layerIndex', layerIndex);
      strokeEl.parentElement.parentElement.setAttribute('strokeIndex', strokeIndex);
      newLayer.strokes.push(newStroke);
      strokeIndex++;
    }

    // 4. Read Shadow Settings
    const shadowElements = layerEl.querySelectorAll(".shadow-item");
    let shadowIndex = 0;
    for (const shadowEl of shadowElements) {
      const newShadow = {};
      newShadow.color = shadowEl.querySelector(".shadowColor-input").value;
      newShadow.blur = parseFloat(shadowEl.querySelector(".shadowBlur-input").value) || 0;
      newShadow.offsetX = parseFloat(shadowEl.querySelector(".shadowOffsetX-input").value) || 0;
      newShadow.offsetY = parseFloat(shadowEl.querySelector(".shadowOffsetY-input").value) || 0;
      
      // ⭐️ Read enabled state for shadow (checkbox is in parent container)
      const shadowEnabledCheckbox = shadowEl.parentElement.parentElement.querySelector(".shadow-enabled-checkbox");
      newShadow.enabled = shadowEnabledCheckbox ? shadowEnabledCheckbox.checked : true;
      
      shadowEl.parentElement.parentElement.setAttribute('layerIndex', layerIndex);
      shadowEl.parentElement.parentElement.setAttribute('shadowIndex', shadowIndex);
      newLayer.shadows.push(newShadow);
      shadowIndex++;
    }

    // 5. Add the completed layer to settings
    Setup.Settings.textLayers.push(newLayer);
    layerIndex++;
  }

  // 6. Redraw the canvas
  drawCompositeText();
}

function updateCustomValues() {
  Setup.Sizes.custom.width = parseInt(customWidthElement.value) || 1;
  Setup.Sizes.custom.height = parseInt(customHeightElement.value) || 1;
}

function updateImageSettings() {
  Setup.Settings.canvas.format = RatioSelectElement.value;
  const _format = Setup.Sizes[Setup.Settings.canvas.format]
  const ratio = _format.width / _format.height;

  // The idea is that the min size be 1920
  if (ratio > 1) { // cover
    _format.width = 1920;
    _format.height = Math.round(1920 / ratio);
  } else { // poster
    _format.width = Math.round(1920 * ratio);
    _format.height = 1920;
  }
  
  Setup.Settings.canvas.type = typeSelectElement.value;
  Setup.Settings.canvas.salt = parseInt(randomSaltElement.value) || 0;
  setCanvasSize(_format.width, _format.height);

  Setup.Settings.canvas.overlayColorStart = overlayColorStartElement.value || '#000000';
  Setup.Settings.canvas.overlayColorStartRGB = hexToRgb(Setup.Settings.canvas.overlayColorStart);
  Setup.Settings.canvas.overlayColorEnd = overlayColorEndElement.value || '#ffffff';
  Setup.Settings.canvas.overlayColorEndRGB = hexToRgb(Setup.Settings.canvas.overlayColorEnd);
  Setup.Settings.canvas.overlayOpacityStart = parseFloat(overlayOpacityStartElement.value) || 0;
  Setup.Settings.canvas.overlayOpacityEnd = parseFloat(overlayOpacityEndElement.value) || 0;
  Setup.Settings.canvas.spacing = parseFloat(spacingElement.value) || 0;
  Setup.Settings.canvas.blurAmount = parseInt(blurAmountElement.value) || 0;
  Setup.Settings.canvas.reflectionDistance = parseFloat(reflectionScaleElement.value) || 0;
  Setup.Settings.canvas.reflectionScale = parseFloat(reflectionScaleElement.value) || 0;

  Setup.Settings.canvas.baseScale = parseFloat(baseScaleElement.value) || 1.5;
  Setup.Settings.canvas.reflectionDistance = parseFloat(reflectionDistanceElement.value) || 0;
  drawCompositeImage();
}

function updateExportSettings() {
  Setup.Settings.export.format = exportFormatSelectElement.value || 'png';
  Setup.Settings.export.jpegQuality = parseFloat(jpegQualityElement.value) || 0.95;
  
  // Clamp quality between 0 and 1
  if (Setup.Settings.export.jpegQuality < 0) Setup.Settings.export.jpegQuality = 0;
  if (Setup.Settings.export.jpegQuality > 1) Setup.Settings.export.jpegQuality = 1;
  
  saveSetup();
}

async function updateSettings() {
  updateImageSettings();
  await updateTextSettings();
}

function getIndexFromId(id) {
  return parseInt(id?.replace('layer_', '') || -1);
}

function getLatestLayerId() {
  const lastId = getIndexFromId(Setup.Settings.textLayers[Setup.Settings.textLayers.length - 1]?.id);
  return isNaN(lastId) ? -1 : lastId;
}

function ensureUniqueId(mask, currIndex, placeholder = '{n}') {
    let index = currIndex;
    const generateId = (idx) => mask.split(placeholder).join(idx);
    let id = generateId(index);
    while (document.getElementById(id)) {
        index++;
        id = generateId(index);
    }
    return { uniqueId: id, index };
}

function addTextLayer(layerIndex) {
  const clone = textLayerTemplate.content.cloneNode(true);
  layerIndex ??= getLatestLayerId() + 1;

  const fieldCheckbox = clone.querySelector('.field.checkbox');
  fieldCheckbox.id = `layer_${layerIndex}`;

  // Populate the font select for this new clone
  const fontSelect = clone.querySelector('.fontSelect-input');
  fontSelect.innerHTML = fontSelectElement.innerHTML; // Steal from the (now hidden) original
  
  // --- NEW: Dynamically set IDs for all expandable sections ---
  
  // Get a unique index for this new layer (e.g., 0, 1, 2)

  const expandCheck = clone.querySelector('input.expand-checkbox');
  expandCheck.id = `textLayerCheck-${layerIndex}`;

  const expandLabel = clone.querySelector('label.expand-label');
  expandLabel.setAttribute('for', expandCheck.id);
  expandLabel.innerText = `Layer ${layerIndex}`;

  // Update the main layer header to be "Text Layer 1", "Text Layer 2", etc.
  const header = clone.querySelector('.expand-content .layer-header h4');
  if (header) {
    header.innerText = `Text Layer ${layerIndex + 1}`;
  }

  // get the font select and set its id and label
  const fontSelectInput = clone.querySelector('.expand-content .field .fontSelect-input');
  const fontSelectId = `fontSelect-layer-${layerIndex}`;
  fontSelectInput.id = fontSelectId;

  // Find all expandable sections (Position, Stroke, Shadow) within this clone
  const expandSections = clone.querySelectorAll('.expand-content .field.checkbox');
  
  expandSections.forEach((section, i) => {
    const input = section.querySelector('.expand-content input.expand-checkbox');
    const label = section.querySelector('.expand-content label.expand-label');

    if (input && label) {
      // Get a clean name from the label text (e.g., "Position", "Stroke (Outline)" -> "position", "stroke")
      let idName = label.innerText.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
      if (!idName) idName = `section-${i}`; // Fallback

      // Create a unique ID: "layer-0-position-check", "layer-1-stroke-check", etc.
      const uniqueId = `layer-${layerIndex}-${idName}-check`;
      
      input.id = uniqueId;
      label.setAttribute('for', uniqueId);
    }
  });

  // --- End of new ID logic ---

  // Attach event listeners for this layer's buttons
  clone.querySelector(".delete-layer-btn").addEventListener("click", deleteTextStrokeShadow);
  clone.querySelector(".default-layer-btn").addEventListener("click", setTextLayerDefault);
  clone.querySelector(".duplicate-layer-btn").addEventListener("click", duplicateTextLayer);
  clone.querySelector(".add-stroke-btn").addEventListener("click", addStroke);
  clone.querySelector(".add-shadow-btn").addEventListener("click", addShadow);

  // if done loading, set and all the default layers needed
  // it must use the addStroke and addShadow, because only they will add and run the necessary commands
  // Then this here will update their info with the default ones
    if(window.memoryLoaded) {
      
    if (Setup.defaults.TextLayer) {
      // Populate basic font settings
      clone.querySelector(".overlayText-input").value = Setup.defaults.TextLayer.overlayText;
      clone.querySelector(".fontSelect-input").value = Setup.defaults.TextLayer.font.family;
      clone.querySelector(".fontWeightSelect-input").value = Setup.defaults.TextLayer.font.weight;
      clone.querySelector(".fontStyleSelect-input").value = Setup.defaults.TextLayer.font.style;
      clone.querySelector(".fontSize-input").value = Setup.defaults.TextLayer.font.size;
      clone.querySelector(".fontColor-input").value = Setup.defaults.TextLayer.font.color;
      clone.querySelector(".fontOpacity-input").value = Setup.defaults.TextLayer.font.opacity;

      // Populate position settings
      clone.querySelector(".textAlign-input").value = Setup.defaults.TextLayer.position.textAlign;
      clone.querySelector(".textBaseline-input").value = Setup.defaults.TextLayer.position.textBaseline;
      clone.querySelector(".positionX-input").value = Setup.defaults.TextLayer.position.x;
      clone.querySelector(".positionY-input").value = Setup.defaults.TextLayer.position.y;
      clone.querySelector(".rotation-input").value = Setup.defaults.TextLayer.position.rotation || 0;

      // Populate strokes
      for (let index2 = 0; index2 < Setup.defaults.TextLayer.strokes.length; index2++) {
        const strokeData = Setup.defaults.TextLayer.strokes[index2];
        const strokeEl = clone.querySelector(`#${addStroke({ target: clone.querySelector(".add-stroke-btn") })}`).parentElement.querySelector('.stroke-item');
        strokeEl.querySelector(".strokeColor-input").value = strokeData.color;
        strokeEl.querySelector(".strokeWidth-input").value = strokeData.width;
        strokeEl.querySelector(".strokeOpacity-input").value = strokeData.opacity;
      }

      // Populate shadows
      for (let index3 = 0; index3 < Setup.defaults.TextLayer.shadows.length; index3++) {
        const shadowData = Setup.defaults.TextLayer.shadows[index3];
        const shadowEl = clone.querySelector(`#${addShadow({ target: clone.querySelector(".add-shadow-btn") })}`).parentElement.querySelector('.shadow-item');
        shadowEl.querySelector(".shadowColor-input").value = shadowData.color;
        shadowEl.querySelector(".shadowBlur-input").value = shadowData.blur;
        shadowEl.querySelector(".shadowOffsetX-input").value = shadowData.offsetX;
        shadowEl.querySelector(".shadowOffsetY-input").value = shadowData.offsetY;
      }
    }
  }

  textLayersContainer.appendChild(clone);
  updateTextSettings();
  return fieldCheckbox.id;
}

function duplicateTextLayer(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  loadTextLayers([Setup.Settings.textLayers[layerIndex]]);
}

function setTextLayerDefault(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  Setup.defaults.TextLayer = {...Setup.Settings.textLayers[layerIndex]}
  saveSetup();
  toastMessage('Text Layer default set', { position: 'bottomCenter', type: 'success' });
}

function addStroke(e) {
  const clone = strokeTemplate.content.cloneNode(true);
  clone.querySelector(".delete-stroke-btn").addEventListener("click", deleteTextStrokeShadow);
  clone.querySelector(".default-stroke-btn").addEventListener("click", setStrokeDefault);
  clone.querySelector(".duplicate-stroke-btn").addEventListener("click", duplicateStroke);
  // Find the container *within* the layer that was clicked
  const container = e.target.closest(".expand-content").querySelector(".strokes-container");

  // --- NEW: ID Generation ---
  // 1. Find the parent layer to get its index
  const layerItem = e.target.closest(".text-layer-item");
  const allLayers = Array.from(textLayersContainer.querySelectorAll('.text-layer-item'));
  const layerIndex = allLayers.indexOf(layerItem);

  // 3. Find the new elements in the clone
  const input = clone.querySelector('input.expand-checkbox');
  const label = clone.querySelector('label.expand-label');
  
  // 4. Create and set unique ID and Label text
  if (input && label) {
    const {uniqueId, index} = ensureUniqueId(`layer-${layerIndex}-stroke-{n}-check`, container.childElementCount);
    input.id = uniqueId;
    label.setAttribute('for', uniqueId);
    label.innerText = `Frame ${index + 1}`;

    if (Setup.defaults.stroke) {
      const strokeColorInput = clone.querySelector(".strokeColor-input");
      const strokeWidthInput = clone.querySelector(".strokeWidth-input");
      const strokeOpacityInput = clone.querySelector(".strokeOpacity-input");

      strokeColorInput.value = Setup.defaults.stroke.color;
      strokeWidthInput.value = Setup.defaults.stroke.width;
      strokeOpacityInput.value = Setup.defaults.stroke.opacity;
    }

    container.appendChild(clone);
    updateTextSettings();
    return uniqueId;
  }
}

function duplicateStroke(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  const strokeIndex = parseInt(e.target.parentElement.getAttribute('strokeIndex'));
  loadTextStrokes(layerIndex, [Setup.Settings.textLayers[layerIndex].strokes[strokeIndex]]);
}

function setStrokeDefault(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  const strokeIndex = parseInt(e.target.parentElement.getAttribute('strokeIndex'));
  Setup.defaults.stroke = {...Setup.Settings.textLayers[layerIndex].strokes[strokeIndex]}
  saveSetup();
  toastMessage('Stroke default set', { position: 'bottomCenter', type: 'success' });
}

function addShadow(e) {
  const clone = shadowTemplate.content.cloneNode(true);
  clone.querySelector(".delete-shadow-btn").addEventListener("click", deleteTextStrokeShadow);
  clone.querySelector(".default-shadow-btn").addEventListener("click", setShadowDefault);
  clone.querySelector(".duplicate-shadow-btn").addEventListener("click", duplicateShadow);
  
  // Find the container *within* the layer that was clicked
  const container = e.target.closest(".expand-content").querySelector(".shadows-container");

  // --- NEW: ID Generation ---
  // 1. Find the parent layer to get its index
  const layerItem = e.target.closest(".text-layer-item");
  const allLayers = Array.from(textLayersContainer.querySelectorAll('.text-layer-item'));
  const layerIndex = allLayers.indexOf(layerItem);

  // 3. Find the new elements in the clone
  const input = clone.querySelector('input.expand-checkbox');
  const label = clone.querySelector('label.expand-label');

  // 4. Create and set unique ID and Label text
  if (input && label) {
    const {uniqueId, index} = ensureUniqueId(`layer-${layerIndex}-shadow-{n}-check`, container.childElementCount);
    input.id = uniqueId;
    label.setAttribute('for', uniqueId);
    label.innerText = `Bloom ${index + 1}`; 

    if (Setup.defaults.shadow) {
      const shadowColorInput = clone.querySelector(".shadowColor-input");
      const shadowBlurInput = clone.querySelector(".shadowBlur-input");
      const shadowOffsetXInput = clone.querySelector(".shadowOffsetX-input");
      const shadowOffsetYInput = clone.querySelector(".shadowOffsetY-input");

      shadowColorInput.value = Setup.defaults.shadow.color;
      shadowBlurInput.value = Setup.defaults.shadow.blur;
      shadowOffsetXInput.value = Setup.defaults.shadow.offsetX;
      shadowOffsetYInput.value = Setup.defaults.shadow.offsetY;
    }

    container.appendChild(clone);
    updateTextSettings();
    return uniqueId;
  }
}

function duplicateShadow(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  const shadowIndex = parseInt(e.target.parentElement.getAttribute('shadowIndex'));
  loadTextShadows(layerIndex, [Setup.Settings.textLayers[layerIndex].shadows[shadowIndex]]);
}

function deleteTextStrokeShadow(e) {
  e.target.parentElement.remove();
  updateTextSettings();
}

function setShadowDefault(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  const shadowIndex = parseInt(e.target.parentElement.getAttribute('shadowIndex'));
  Setup.defaults.shadow = {...Setup.Settings.textLayers[layerIndex].shadows[shadowIndex]}
  saveSetup();
  toastMessage('Shadow default set', { position: 'bottomCenter', type: 'success' });
}

function initTextLayers() {
  textLayersContainer.innerHTML = '';
  updateTextSettings();
}

// ======================
// Export/Import Functions
// ======================

function getExportFileName() {
  // Get the file extension based on export format
  const format = Setup.Settings.export.format || 'png';
  const extension = format === 'jpeg' ? '.jpg' : '.png';
  
  // If we have a stored project name from import, use it
  if (window.projectFileName) {
    return window.projectFileName + extension;
  }
  
  // Otherwise, build filename from all text layers
  if (Setup.Settings.textLayers.length > 0) {
    const allTexts = Setup.Settings.textLayers
      .map(layer => layer.overlayText)
      .filter(text => text && text.trim())
      .join(' - ');
    
    if (allTexts) {
      return utils.safeWindowsFileName(allTexts) + extension;
    }
  }
  
  return 'composite' + extension;
}

function getProjectBaseName() {
  // If we have a stored project name from import, use it
  if (window.projectFileName) {
    return window.projectFileName;
  }
  
  // Otherwise, build filename from all text layers
  if (Setup.Settings.textLayers.length > 0) {
    const allTexts = Setup.Settings.textLayers
      .map(layer => layer.overlayText)
      .filter(text => text && text.trim())
      .join(' - ');
    
    if (allTexts) {
      return utils.safeWindowsFileName(allTexts);
    }
  }
  
  return 'composite';
}

/**
 * DEBUG FUNCTION: Log current state of slotsImages array
 */
function debugSlotsImages() {
  console.log('=== SLOTS DEBUG ===');
  console.log(`Total slots: ${slotsImages.length}`);
  slotsImages.forEach((img, index) => {
    if (img) {
      console.log(`Slot ${index}: Image src = ${img.src.substring(0, 80)}...`);
    } else {
      console.log(`Slot ${index}: null`);
    }
  });
  console.log('===================');
}

// Make it globally accessible for console debugging
window.debugSlotsImages = debugSlotsImages;

/**
 * TEST FUNCTION: Fill all slots with numbered images
 * Creates canvas images with numbers from 0 to last slot index
 */
function fillSlotsWithNumbers() {
  const slotCount = slotsImages.length;
  
  if (slotCount === 0) {
    alert('No slots available! Add some slots first.');
    return;
  }
  
  console.log(`Filling ${slotCount} slots with numbered images...`);
  
  for (let i = 0; i < slotCount; i++) {
    // Create a canvas to draw the number
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 270;
    testCanvas.height = 400;
    const testCtx = testCanvas.getContext('2d');
    
    // Draw background with unique color per slot
    const hue = (i * 360 / slotCount) % 360;
    testCtx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    testCtx.fillRect(0, 0, testCanvas.width, testCanvas.height);
    
    // Draw number
    testCtx.fillStyle = 'white';
    testCtx.strokeStyle = 'black';
    testCtx.lineWidth = 3;
    testCtx.font = 'bold 120px Arial';
    testCtx.textAlign = 'center';
    testCtx.textBaseline = 'middle';
    
    const text = i.toString();
    testCtx.strokeText(text, testCanvas.width / 2, testCanvas.height / 2);
    testCtx.fillText(text, testCanvas.width / 2, testCanvas.height / 2);
    
    // Convert canvas to blob and create Image
    testCanvas.toBlob(blob => {
      if (!blob) {
        console.error(`Failed to create blob for slot ${i}`);
        return;
      }
      
      const blobUrl = URL.createObjectURL(blob);
      
      // Load the blob URL into the slot (loadImageIntoSlot will handle Image creation)
      loadImageIntoSlot(blobUrl, i);
      console.log(`Loaded number ${i} (${blobUrl}) into slot ${i}`);
    }, 'image/png');
  }
  
  toastMessage('Test: Filling slots with numbers...', { position: 'topRight', type: 'success' });
}

function exportAsPNG() {
  const btn = document.getElementById('exportBtn');
  btn.classList.add('disabled');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.5';
  
  toastMessage('Generating image...', { position: 'bottomCenter', type: 'info' });
  
  // Use setTimeout to let UI update
  setTimeout(() => {
    try {
      // Get export format and quality from settings
      const format = Setup.Settings.export.format || 'png';
      const quality = Setup.Settings.export.jpegQuality || 0.95;
      
      // Generate data URL with correct format
      let dataURL;
      if (format === 'jpeg') {
        dataURL = canvas.toDataURL("image/jpeg", quality);
      } else {
        dataURL = canvas.toDataURL("image/png");
      }
      
      const fileName = getExportFileName();
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = fileName;
      link.style.display = 'none';
      
      // Prevent any navigation or page refresh
      link.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up after a delay to ensure download started
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
      toastMessage('Image exported successfully!', { position: 'bottomCenter', type: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      toastMessage('Failed to export image', { position: 'bottomCenter', type: 'danger' });
    } finally {
      btn.classList.remove('disabled');
      btn.style.pointerEvents = '';
      btn.style.opacity = '';
    }
  }, 100);
}

async function exportProjectFile() {
  if (typeof JSZip === 'undefined') {
    alert('JSZip library not loaded. Please refresh the page.');
    return;
  }

  const btn = document.getElementById('exportProjectBtn');
  btn.classList.add('disabled');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.5';
  
  toastMessage('Exporting project...', { position: 'bottomCenter', type: 'info' });

  try {
    const zip = new JSZip();
    const fileName = getProjectBaseName();

    // Add project configuration
    const jsonData = makeSaveAllJson();
    zip.file('project.json', jsonData);

    // Add images as separate files
    const imagePromises = [];
    for (let i = 0; i < slotsImages.length; i++) {
      const img = slotsImages[i];
      if (img) {
        // Convert image to blob
        const blobPromise = imgToBlob(img, 'image/png', 1)
          .then(blob => {
            zip.file(`images/slot_${i}.png`, blob);
          })
          .catch(err => {
            console.error(`Failed to export image ${i}:`, err);
          });
        imagePromises.push(blobPromise);
      }
    }

    // Wait for all images to be added
    toastMessage(`Processing ${imagePromises.length} images...`, { position: 'bottomCenter', type: 'info' });
    await Promise.all(imagePromises);

    // Generate ZIP file
    toastMessage('Creating ZIP file...', { position: 'bottomCenter', type: 'info' });
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Download ZIP
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(zipBlob);
    link.href = blobUrl;
    link.download = `${fileName}.covermaker.zip`;
    link.style.display = 'none';
    
    // Prevent any navigation or page refresh
    link.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 100);

    toastMessage('Project exported successfully!', { position: 'bottomCenter', type: 'success' });
  } catch (error) {
    console.error('Export failed:', error);
    toastMessage('Failed to export project: ' + error.message, { position: 'bottomCenter', type: 'danger' });
  } finally {
    btn.classList.remove('disabled');
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
  }
}

async function importProjectFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check if it's a ZIP file
  if (file.name.endsWith('.zip') || file.name.endsWith('.covermaker.zip')) {
    await importProjectFromZip(file);
  } else if (file.name.endsWith('.json')) {
    // Legacy JSON import (without images)
    importProjectFromJson(file);
  } else {
    alert('Unsupported file format. Please use .zip or .json files.');
  }

  event.target.value = ''; // Clear the input
}

/**
 * Import project from ZIP file with images
 */
async function importProjectFromZip(file) {
  if (typeof JSZip === 'undefined') {
    alert('JSZip library not loaded. Please refresh the page.');
    return;
  }

  const btn = document.getElementById('importProjectBtn');
  btn.classList.add('disabled');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.5';
  
  toastMessage('Opening project file...', { position: 'bottomCenter', type: 'info' });

  try {
    // Store the original filename (without extension) for future exports
    const fileName = file.name.replace(/\.covermaker\.zip$|\.zip$/i, '');
    window.projectFileName = utils.safeWindowsFileName(fileName);
    
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    // Read project.json
    const projectJsonFile = contents.file('project.json');
    if (!projectJsonFile) {
      throw new Error('Invalid project file: project.json not found');
    }

    const jsonText = await projectJsonFile.async('text');
    const projectData = JSON.parse(jsonText);

    // Clear existing data
    window.memoryLoaded = false;
    clearTextLayersMemory();
    deleteAllSlots();

    // Load configuration
    if (projectData.Setup) {
      // Get the default Setup from config.js
      const defaultSetup = window.defaultSetup || Setup;
      // Merge imported Setup with defaults to ensure all keys exist
      Setup = deepMerge(projectData.Setup, defaultSetup);
      loadTextLayers(Setup.Settings.textLayers);
    }

  // Restore UI fields
  RatioSelectElement.value = Setup.Settings.canvas.format;
  typeSelectElement.value = Setup.Settings.canvas.type;
  randomSaltElement.value = Setup.Settings.canvas.salt;
  overlayColorStartElement.value = Setup.Settings.canvas.overlayColorStart;
  overlayColorEndElement.value = Setup.Settings.canvas.overlayColorEnd;
  overlayOpacityStartElement.value = Setup.Settings.canvas.overlayOpacityStart;
  overlayOpacityEndElement.value = Setup.Settings.canvas.overlayOpacityEnd;
  spacingElement.value = Setup.Settings.canvas.spacing;
  blurAmountElement.value = Setup.Settings.canvas.blurAmount;
  reflectionScaleElement.value = Setup.Settings.canvas.reflectionScale;
  reflectionDistanceElement.value = Setup.Settings.canvas.reflectionDistance;
  baseScaleElement.value = Setup.Settings.canvas.baseScale;
  
  // Restore export settings
  if (Setup.Settings.export) {
    exportFormatSelectElement.value = Setup.Settings.export.format || 'png';
    jpegQualityElement.value = Setup.Settings.export.jpegQuality || 0.95;
  }    // Load images from ZIP
    toastMessage('Reading project data...', { position: 'bottomCenter', type: 'info' });
    const imageFiles = [];
    contents.folder('images').forEach((relativePath, file) => {
      if (relativePath.endsWith('.png')) {
        const match = relativePath.match(/slot_(\d+)\.png/);
        if (match) {
          const slotIndex = parseInt(match[1]);
          imageFiles.push({ slotIndex, file });
        }
      }
    });

    // Sort by slot index
    imageFiles.sort((a, b) => a.slotIndex - b.slotIndex);

    // Set up slots
    const maxSlotIndex = imageFiles.length > 0 ? Math.max(...imageFiles.map(f => f.slotIndex)) : 0;
    setSlots(maxSlotIndex + 1);

    // Load each image
    toastMessage(`Loading ${imageFiles.length} images...`, { position: 'bottomCenter', type: 'info' });
    for (const { slotIndex, file } of imageFiles) {
      try {
        const blob = await file.async('blob');
        const img = await loadImage(blob);
        slotsImages[slotIndex] = img;
        setSlotImage(slotIndex, img);
      } catch (err) {
        console.error(`Failed to load image ${slotIndex}:`, err);
      }
    }

    // Finalize
    toastMessage('Finalizing...', { position: 'bottomCenter', type: 'info' });
    window.memoryLoaded = true;
    updateImageSettings();
    updateTextSettings();
    saveSetup();
    saveTextLayersToStorage();
    saveFieldsToStorage();
    drawComposite();

    toastMessage('Project imported successfully!', { position: 'bottomCenter', type: 'success' });
  } catch (error) {
    console.error('Import failed:', error);
    toastMessage('Failed to import project: ' + error.message, { position: 'bottomCenter', type: 'danger' });
  } finally {
    const btn = document.getElementById('importProjectBtn');
    btn.classList.remove('disabled');
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
  }
}

/**
 * Import project from legacy JSON file (without images)
 */
async function importProjectFromJson(file) {
  const btn = document.getElementById('importProjectBtn');
  btn.classList.add('disabled');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.5';
  
  toastMessage('Importing legacy project...', { position: 'bottomCenter', type: 'info' });
  
  try {
    // Store the original filename (without extension) for future exports
    const fileName = file.name.replace(/\.json$/i, '');
    window.projectFileName = utils.safeWindowsFileName(fileName);
    
    await _importProjectFromJsonCore(file);
    toastMessage('Project imported successfully!', { position: 'bottomCenter', type: 'success' });
  } catch (error) {
    console.error('Import failed:', error);
    toastMessage('Failed to import project', { position: 'bottomCenter', type: 'danger' });
  } finally {
    btn.classList.remove('disabled');
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
  }
}

function _importProjectFromJsonCore(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const contents = e.target.result;
    try {
      const importedSetup = JSON.parse(contents);
      loadFullProjectFromJson(importedSetup);
      toastMessage('Project imported (without images)', { position: 'bottomCenter', type: 'warning' });
    } catch (err) {
      alert('Error reading project file: ' + err.message);
      throw err;
    }
  };
  reader.readAsText(file);
}

function openInNewTab(source) {
  let dataURL = "";
  if (source?.target?.id == "openTabBtn" || source?.target?.parentElement?.id == "openTabBtn")
    dataURL = canvas.toDataURL("image/png");
  else {
    const slotImage = getSlotPreviewByIndex(getIndexFromButtonClick(source))
    if (slotImage)
      dataURL = slotImage.getAttribute('src'); 
    else
      return;
  }
  const fileName = getExportFileName();
  const tab = window.open();

  const previewHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        display: flex;
        margin:0; 
        background-color:#121212;
        align-items:center; 
        justify-content:center;
      }
      img {
        object-fit: scale-down;
        max-width: calc(100vw - 20px);
        max-height: 100vh;
        min-height: 100vh;
        cursor: zoom-in;
        overflow-x: hidden;
      }
      img[zoomed] {
        cursor: zoom-out;
      }
    </style>
</head>
<body>
    <img id="preview" onload="window.stop()" src="${dataURL}">
</body>
<script>
      const img = document.getElementById("preview");
      img.addEventListener("click", () => {
        if (img.getAttribute('zoomed')) {
          img.removeAttribute('zoomed');
          img.style.maxHeight = '100vh'; 
          img.style.minWidth =  'unset';
          img.style.objectFit =  'scale-down';
        } else {
          img.setAttribute('zoomed', 'true');
          img.style.maxHeight = 'unset';
          img.style.minWidth =  'calc(100vw - 20px)';
          img.style.objectFit =  'contain';
        }
      });
    </script>
</html>`

  tab.document.write(previewHTML);
  tab.document.title = fileName;
}

// =====================================================
// Font Loading
// =====================================================
async function loadFontMetadata() {
  const response = await fetch("./fonts.json");
  FONT_DATABASE = await response.json();
}

async function populateFontSelect() {
  await loadFontMetadata();

  const categories = {
    "Web Safe": webSafeFonts,
    "Sans Serif": [],
    "Serif": [],
    "Display": [],
    "Handwriting": [],
    "Monospace": []
  };

  FONT_DATABASE.familyMetadataList.forEach(font => {
    if (!categories[font.category]) categories[font.category] = [];
    categories[font.category].push(font.family);
  });

  fontSelectElement.innerHTML = "";

  // Create optgroup blocks
  for (const category in categories) {
    const group = document.createElement("optgroup");
    group.label = category;

    categories[category].sort().forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      group.appendChild(opt);
    });

    fontSelectElement.appendChild(group);
  }

  if (fontSelectElement.selectedIndex == -1)
    fontSelectElement.selectedIndex = 0;
}

async function loadFont(fontName) {
  if (!fontName) return;
  if(webSafeFonts.includes(fontName))
    return true;

  const normalized = fontName.trim().toLowerCase().replace(/\s+/g, '-');
  if (!document.querySelector(`link[data-font="${normalized}"]`)) {
    
    const cssLoadPromise = new Promise((resolve, reject) => {
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}`;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.font = normalized;
      
      link.onload = () => resolve(); 
      
      link.onerror = () => reject(new Error(`Failed to load CSS for font: ${fontName}`));
      
      document.head.appendChild(link);
    });

    await cssLoadPromise;
  }
  try {
    await document.fonts.load(`1em "${fontName}"`);
    await document.fonts.ready;
    return true;
    
  } catch (err) {
    console.error(`Failed to load font file for: ${fontName}`, err);
    return false;
  }
}

// ======================
// Utilities
// ======================
function  makeDetailList(inputTarget, list, sort = false) {
  const id = `${inputTarget.id}-list`;
  const datalist = document.getElementById(id) || document.createElement('datalist');
  datalist.id = id;

  if(sort)
    list.sort();

  window.dataLists ??={}

  window.dataLists[id] ??= []

  list.forEach(item => {
    // check if datalist don't already have thie item
    if(window.dataLists[id].includes(item))
      return;
    window.dataLists[id].push(item);
    const option = document.createElement('option');
    option.value = item;
    datalist.appendChild(option);
  });

  inputTarget.setAttribute('list', datalist.id);
  inputTarget.parentNode.insertBefore(datalist, inputTarget.nextSibling);
}

// ======================
// Function Wrappers
// ======================
searchOnLibrary = Controller.wrap(searchOnLibrary, true, 100, 1000);
// drawComposite now uses unified render with debounce to prevent flicker during rapid parameter changes
drawComposite = Controller.wrap(drawComposite, true, 100);
updateTextSettings = Controller.wrap(updateTextSettings, true, 100);
saveTextLayersToStorage = Controller.wrap(saveTextLayersToStorage, true, 100, 1000);
saveSetup = Controller.wrap(saveSetup, true, 100, 1000);

// ======================
// Event Listeners
// ======================

document.addEventListener("mousemove", (e) => {
  window.lastCursorX = e.clientX;
  window.lastCursorY = e.clientY;
});

document.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      loadImageIntoSlot(item.getAsFile());
      break;
    }
  }
});

jellyfinsearchInput.addEventListener('input', () => {
  jellyfin.backupSearchParams();
  jellyfin.searchParams.offset = 0;
  jellyfin.searchParams.page = 1;
  jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[1]
  searchOnLibrary(null, true, true).then(() => {
    fillJellyfinContainerAttr();
  })
})

jellyfinloginActionBtn.addEventListener('click', Login)

function addSettingListeners() {
  // This single listener handles ALL dynamic text inputs
  document.getElementById('settingsContent').addEventListener('input', (e) => {
    // We only call updateTextSettings if a text input changed
    if (e.target.closest('.text-layer-item')) {
      updateTextSettings();
    }
  });
  
  // ⭐️ Listener for toggle checkboxes (enable/disable)
  document.getElementById('settingsContent').addEventListener('change', (e) => {
    if (e.target.classList.contains('toggle-checkbox')) {
      updateTextSettings();
    }
  });
  
  // ⭐️ Listener for toggle buttons (click to toggle checkbox)
  document.getElementById('settingsContent').addEventListener('click', (e) => {
    const toggleButton = e.target.closest('.toggle-button');
    if (toggleButton) {
      // Find the associated checkbox in the same parent
      const parent = toggleButton.parentElement;
      const checkbox = parent.querySelector('.toggle-checkbox');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        // Trigger change event to update canvas
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // These are for the non-dynamic image settings
  [RatioSelectElement, customWidthElement, customHeightElement].forEach((el) => {
    el.addEventListener("input", updateCustomValues);
  });

  [
    RatioSelectElement,
    customWidthElement,
    customHeightElement,
    typeSelectElement,
    randomSaltElement,
    overlayOpacityStartElement,
    overlayOpacityEndElement,
    overlayColorStartElement,
    overlayColorEndElement,
    spacingElement,
    blurAmountElement,
    reflectionScaleElement,
    reflectionDistanceElement,
    baseScaleElement
  ].forEach((el) => {
    el.addEventListener("input", () => {
      updateImageSettings();
      drawComposite();
    });
  });
  
  // Export settings listeners
  [exportFormatSelectElement, jpegQualityElement].forEach((el) => {
    el.addEventListener("input", updateExportSettings);
  });
  
  // Note: The font listeners are removed, as they are now handled by the main 'input' listener
}

// Export buttons
document.getElementById("exportBtn").addEventListener("click", exportAsPNG);
document.getElementById("openTabBtn").addEventListener("click", openInNewTab);
document.getElementById("exportProjectBtn").addEventListener("click", exportProjectFile);
document.getElementById("importProjectInput").addEventListener("change", importProjectFile);
document.getElementById("importProjectBtn").addEventListener("click", () => {
  document.getElementById("importProjectInput").click();
});

document.getElementById("addTextLayerBtn").addEventListener("click", () => addTextLayer());

// Test button to fill slots with numbered images
document.getElementById("testFillNumbersBtn")?.addEventListener("click", fillSlotsWithNumbers);

// Debug button to log slotsImages array state
document.getElementById("debugSlotsBtn")?.addEventListener("click", debugSlotsImages);

// ======================
// App Initialization
// ======================

function dummyStart() {
  // Add initial slots
  // Load default slotsImages
  const imagesToLoad = {
    "final_destination_bloodlines": "https://m.media-amazon.com/images/M/MV5BMzc3OWFhZWItMTE2Yy00N2NmLTg1YTktNGVlNDY0ODQ5YjNlXkEyXkFqcGc@._V1_FMjpg_UY4096_.jpg",
    "conclave": "https://m.media-amazon.com/images/M/MV5BYjgxMDI5NmMtNTU3OS00ZDQxLTgxZmEtNzY1ZTBmMDY4NDRkXkEyXkFqcGc@._V1_FMjpg_UX1080_.jpg",
    "oppenheimer": "https://m.media-amazon.com/images/M/MV5BN2JkMDc5MGQtZjg3YS00NmFiLWIyZmQtZTJmNTM5MjVmYTQ4XkEyXkFqcGc@._V1_FMjpg_UY3454_.jpg",
    "interestellar": "https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_FMjpg_UY3600_.jpg"
  }

  const values = Object.values(imagesToLoad);
  setSlots(values.length);

  values.forEach((src, i) => {
    if (i >= slotsImages.length)
      return;
    
    // Revoke old Blob URL before loading new image
    if (slotsImages[i]) {
      revokeBlobUrl(slotsImages[i]);
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      slotsImages[i] = img;
      setSlotImage(i, img)
      updateImageSettings();
    };
    img.src = src;
  });

}


// On window load
window.addEventListener('load', async () => {
  // Store a deep copy of the default Setup before any modifications
  window.defaultSetup = JSON.parse(JSON.stringify(Setup));
  
  loadFieldsFromStorage();
  document.getElementById("Server").addEventListener("change", saveFieldsToStorage);
  document.getElementById("Username").addEventListener("change", saveFieldsToStorage);
  document.getElementById("Password").addEventListener("change", saveFieldsToStorage);

  // Initialize tabs
  window.Tabs = {
    "imageslots": {
      "tab": document.querySelector("#imageslotsTab"),
      "content": document.querySelector("#imageslotsContent")
    },
    "settings": {
      "tab": document.querySelector("#settingsTab"),
      "content": document.querySelector("#settingsContent")
    }
  }

  // Set up tab events
  for (const tabName in window.Tabs)
    window.Tabs[tabName].tab.addEventListener("click", e => changeTab(e.target));
  
  // Set initial tab
  changeTab(window.Tabs["imageslots"].tab);
  
  // Initial draw and Jellyfin setup
  addtypeSelectOptions();
  drawComposite();
  CreateJellyfin();
  await populateFontSelect();

  loadSetup();
  initTextLayers();
  loadEssentials();
});

function loadEssentials() {
  window.memoryLoaded = false;
  window.memory = new pageMemory();
  window.memory.addEvent('onMemoryIsEmpty', () => dummyStart())
  window.memory.addEvent('onRestoreSucess', () => window.memoryLoaded = true)
  window.memory.addEvent('onRestoreSucess', updateImageSettings)
  window.memory.addEvent('onRestoreSucess', () => {
    window.memoryLoaded = true;
    loadTextLayersFromStorage();
  })
  window.memory.addEvent('onRestoreSucess', () => searchOnLibrary(null, true, true))
  window.memory.addEvent('onRestoreError', () =>  window.memoryLoaded = true)
  window.memory.addEvent('onSaveMemory', saveTextLayersToStorage)
  window.memory.addEvent('onSaveMemory', saveSetup)
  window.memory.init();
  addSettingListeners();
  
  window.addEventListener('beforeunload', () => {
    cleanupAllBlobUrls();
  });
}

function addtypeSelectOptions() {
  typeSelectElement.innerHTML = '';
  for (const type in drawCompositeImageFn) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    typeSelectElement.appendChild(option);
  }
}



function cleanMemory() {
  window.memoryLoaded = false;
  window.projectFileName = null;
  memory.reset().then(() => {
    jellyfin.cleanDb();
    clearSavedSetup();
    clearTextLayersMemory();
  });
}

