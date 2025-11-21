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

function loadFullProjectFromJson(jsonData) {
  // set the memory as not loaded
  window.memoryLoaded = false;
  // first, we need to clear all the text layers
  clearTextLayersMemory();
  // then clear the images using the existing function
  deleteAllSlots();
  if (jsonData.Setup) {
    Setup = jsonData.Setup;
    loadTextLayers(Setup.Settings.textLayers);
  }
  // also the images, let's load then, we need to first, theres an example of how to do it in the dummyStart
  if (jsonData.imageSlots) {
    setSlots(jsonData.imageSlots.length);
    jsonData.imageSlots.forEach((src, i) => {
      if (i >= slotsImages.length)
        return;
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
  window.memoryLoaded = true;
  saveSetup();
  saveTextLayersToStorage();
  saveFieldsToStorage();
  drawComposite();
}


function makeSaveAllJson() {
  const save = {};
  save.Setup = Setup;
  save.imageSlots = [];
  slotsImages.forEach((img) => {
    if(!img)
      return;
    save.imageSlots.push(img.getAttribute('src'));
  });
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
  if (savedSetup)
    Setup = { ...Setup, ...JSON.parse(savedSetup) };
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

      // Populate position settings
      newLayerEl.querySelector(".textAlign-input").value = layerData.position.textAlign;
      newLayerEl.querySelector(".textBaseline-input").value = layerData.position.textBaseline;
      newLayerEl.querySelector(".positionX-input").value = layerData.position.x;
      newLayerEl.querySelector(".positionY-input").value = layerData.position.y;

      // Populate strokes
      for (let index2 = 0; index2 < layerData.strokes.length; index2++) {
        const strokeData = layerData.strokes[index2];
        const strokeEl = newLayerEl.querySelector(`#${addStroke({ target: newLayerEl.querySelector(".add-stroke-btn") })}`).parentElement.querySelector('.stroke-item');
        strokeEl.querySelector(".strokeColor-input").value = strokeData.color;
        strokeEl.querySelector(".strokeWidth-input").value = strokeData.width;
        strokeEl.querySelector(".strokeOpacity-input").value = strokeData.opacity;
      }

      // Populate shadows
      for (let index3 = 0; index3 < layerData.shadows.length; index3++) {
        const shadowData = layerData.shadows[index3];
        const shadowEl = newLayerEl.querySelector(`#${addShadow({ target: newLayerEl.querySelector(".add-shadow-btn") })}`).parentElement.querySelector('.shadow-item');
        shadowEl.querySelector(".shadowColor-input").value = shadowData.color;
        shadowEl.querySelector(".shadowBlur-input").value = shadowData.blur;
        shadowEl.querySelector(".shadowOffsetX-input").value = shadowData.offsetX;
        shadowEl.querySelector(".shadowOffsetY-input").value = shadowData.offsetY;
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
    layerEl.parentElement.parentElement.setAttribute('layerIndex', layerIndex);

    // 3. Read Stroke Settings
    const strokeElements = layerEl.querySelectorAll(".stroke-item");
    let strokeIndex = 0;
    for (const strokeEl of strokeElements) {
      const newStroke = {};
      newStroke.color = strokeEl.querySelector(".strokeColor-input").value;
      newStroke.width = parseFloat(strokeEl.querySelector(".strokeWidth-input").value) || 1;
      newStroke.opacity = parseFloat(strokeEl.querySelector(".strokeOpacity-input").value) || 0;

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
    label.innerText = `Stroke/Outline ${index + 1}`;

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
    label.innerText = `Glow/Shadow ${index + 1}`; 

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
  // ⭐️ FIXED: Get text from the first layer, or use a default
  if (Setup.Settings.textLayers.length > 0) {
    const firstLayerText = Setup.Settings.textLayers[0].overlayText;
    if (firstLayerText) {
      return utils.safeWindowsFileName(firstLayerText) + '.png';
    }
  }
  return 'composite.png';
}

function exportAsPNG() {
  const dataURL = canvas.toDataURL("image/png");
  const fileName = getExportFileName();
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportProjectFile() {
  const jsonData = makeSaveAllJson();
  const blob = new Blob([jsonData], { type: "application/json" });
  const fileName = getExportFileName().replace('.png', '.json');
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importProjectFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const contents = e.target.result;
    try {
      const importedSetup = JSON.parse(contents);
      loadFullProjectFromJson(importedSetup);
    } catch (err) {
      alert("Error reading project file: " + err.message);
      throw err;
    }
  };
  reader.readAsText(file);
  event.target.value = ""; // Clear the input
}

function openInNewTab(source) {
  let dataURL = "";
  if (source?.target?.id == "openTabBtn")
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
}

function addtypeSelectOptions() {
  /*
const drawCompositeImageFn = {
  "Line": drawCompositeImageLine,
  "Grid": drawCompositeImageGrid,
  "Circle": drawCompositeImageCircle,
  "Stack": drawCompositeImageStack,
  "Italic Line": drawCompositeImageItalicLineFixed,

  "Carousel Cylinder": drawCompositeImageCarouselCylinder,
  "Carousel Flat": drawCompositeImageCarouselFlat,

  "Mosaic Classic": drawCompositeImageMosaicClassic,
  "Mosaic Adaptive": drawCompositeImageMosaicAdaptive,
  "Mosaic Irregular": drawCompositeImageMosaicIrregular,

  "Circle": drawCompositeImageCircle,
  "Circle Pizza": drawCompositeImageCirclePizza,

  "Collage Layered": drawCompositeImageCollageLayered,
  "Collage Spread": drawCompositeImageCollageSpread,
  "Collage Minimal": drawCompositeImageCollageMinimal,

  "Stack": drawCompositeImageStack,
  "Stack Pyramid": drawCompositeImageStackPyramid,
  "Stack Scatter": drawCompositeImageStackScatter,
  "Stack Grid": drawCompositeImageStackGrid
};

  */
  // get the types from the drawCompositeImageFn and add then to the typeSelectElement options (Clear first)
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
  memory.reset().then(() => {
    jellyfin.cleanDb();
    clearSavedSetup();
    clearTextLayersMemory();
  });
}