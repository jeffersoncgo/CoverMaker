// Adiciona sliders de parâmetros de efeito dinamicamente
function addEffectParamsOptions(paramsContainer, effectType, paramsObj, effectIndex) {
  const effectDef = EFFECTS_REGISTRY[effectType];
  if (!effectDef) return;
  paramsContainer.innerHTML = '';

  // Top: Effect Type Selector (Only once per paramsContainer)
  const typeContainer = document.createElement('div');
  typeContainer.className = 'field effect-type-field';
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Effect Type:';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'effectTypeSelect-input';
  availableEffects.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.name;
    typeSelect.appendChild(opt);
  });
  const eff = projectConfig.canvas.effects[effectIndex];
  if (eff) typeSelect.value = eff.type;
  typeSelect.addEventListener('change', changeEffectLayerType);
  typeContainer.appendChild(typeLabel);
  typeContainer.appendChild(typeSelect);
  paramsContainer.appendChild(typeContainer);

  // Render parameters via shared renderer helper
  ParamsRenderer.renderParamsOptions(paramsContainer, effectDef.params || [], paramsObj || {}, {
    paramTemplate: document.getElementById('effect-param-template'),
    groupTemplate: document.getElementById('options-param-group-template'),
    onChange: onEffectParamChange,
    extraDataset: [['effectIndex', (typeof effectIndex === 'number') ? String(effectIndex) : '']]
    , skipUnknown: true
  });
  // If caller expects unknown effect params to be hidden, pass skipUnknown=true
}

// Add parameters options for Text Effect Layers (per text layer)
function addTextEffectParamsOptions(paramsContainer, effectType, paramsObj, layerIndex, effectIndex) {
  const effectDef = TEXT_EFFECTS[effectType];
  if (!effectDef) {
    console.warn('Text effect not found:', effectType);
    paramsContainer.innerHTML = '';
    return;
  }
  paramsContainer.innerHTML = '';

  // Top: Effect Type Selector (Only once per paramsContainer)
  const typeContainer = document.createElement('div');
  typeContainer.className = 'field effect-type-field';
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Effect Type:';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'effectTypeSelect-input';
  availableTextEffects.forEach(e => {
    const option = document.createElement('option');
    option.value = e.id;
    option.textContent = e.name;
    typeSelect.appendChild(option);
  });
  typeSelect.value = effectType;
  typeSelect.addEventListener('change', changeTextEffectLayerType);
  typeContainer.appendChild(typeLabel);
  typeContainer.appendChild(typeSelect);
  paramsContainer.appendChild(typeContainer);

  // Render parameters via shared renderer helper
  ParamsRenderer.renderParamsOptions(paramsContainer, effectDef.params || [], paramsObj || {}, {
    paramTemplate: document.getElementById('effect-param-template'),
    groupTemplate: document.getElementById('options-param-group-template'),
    onChange: onTextEffectParamChange,
    extraDataset: [['layerIndex', (typeof layerIndex === 'number') ? String(layerIndex) : ''], ['effectIndex', (typeof effectIndex === 'number') ? String(effectIndex) : '']],
    skipUnknown: true
  });
}

// Global handler used by effect slider template's inline oninput
function onEffectParamChange(event) {
  const slider = event.target;
  if (!slider) return;
  const idx = parseInt(slider.closest('.effect-layer-item').id.replace('effect_', ''), 10);
  const key = slider.dataset.paramKey;
  if (isNaN(idx) || !key) return;
  const parsedValue = getControlValue(slider);

  const effects = Setup?.Settings?.canvas?.effects;
  if (!effects || !effects[idx]) return;
  effects[idx].params = effects[idx].params || {};
  effects[idx].params[key] = parsedValue;

  slider.title = parsedValue;

  // Update visible value text in the DOM (find nearest .effect-param-item)
  // const paramItem = slider.closest('.effect-param-item');
  // const valueSpan = paramItem?.querySelector('.effect-param-value');
  // if (valueSpan) valueSpan.textContent = slider.value;

  drawComposite();
};

// ======================
// Effect Layers UI & Logic
// ======================
const effectLayerTemplate = document.getElementById("effect-layer-template");
const effectLayersContainer = document.getElementById("effect-layers-container");
const addEffectLayerBtn = document.getElementById("addEffectLayerBtn");
let availableEffects = [];
// Text effect layer template & container
const textEffectLayerTemplate = document.getElementById("text-effect-layer-template");
let availableTextEffects = [];

// Carregar registro de efeitos
if (typeof EFFECTS_REGISTRY === 'undefined') {
  // Se não estiver global, tente importar
  // (no HTML, garantir que effectsRegistry.js seja carregado antes de app.js)
  console.warn('EFFECTS_REGISTRY não encontrado!');
} else {
  availableEffects = getAvailableEffects();
}
// Text effects list
if (typeof getAvailableTextEffects !== 'undefined') {
  availableTextEffects = getAvailableTextEffects();
} else {
  console.warn('Text effects registry not loaded (getAvailableTextEffects)');
}

function changeEffectLayerType(event) {
  const field = event.target.closest('.effect-layer-item');
  const newType = event.target.value;
  // When we change the info of one layer only, we use it to update only that layer
  const idx = parseInt(field.closest('.effect-layer-item').id.replace('effect_', ''), 10);
  let eff = projectConfig.canvas.effects[idx];
  const newTypeDef = EFFECTS_REGISTRY[newType];

  if (!newTypeDef) return;

  const expandLabel = field.querySelector('label.expand-label');
  const effectName = newTypeDef?.name || 'Effect';
  
  if (expandLabel)
      expandLabel.textContent = effectName;

  eff.type = newType;
  // Convert registry-defined params array into an object map of { key: value }
  const registryDefaults = {};
  for (const p of newTypeDef.params ?? []) {
    // p.default might be undefined; preserve undefined vs null semantics
    registryDefaults[p.key] = p.default;
  }
  eff.params = { ...registryDefaults };


  const paramsContainer = field.querySelector('.effect-params-container');
  addEffectParamsOptions(paramsContainer, eff.type, eff.params, idx);

  // Update only this effect's UI and image render. Avoid re-rendering the whole list
  renderImageEffectLayer(idx);
}

// Normalize effects params into an object mapping so different import/save
// formats (legacy arrays vs current objects) won't break the UI
function normalizeEffectParams(effects) {
  if (!effects) return;
  (effects || []).forEach((eff) => {
    if (!eff) return;
    // If params is already an object, ensure it's defined
    if (eff.params == null) {
      eff.params = {};
      return;
    }
    if (Array.isArray(eff.params)) {
      // Convert array of param descriptors into a key->value object.
      const paramObj = {};
      for (const p of eff.params) {
        if (!p) continue;
        // When p has key and value/default fields, use either value or default
        if (typeof p.key === 'string') {
          paramObj[p.key] = (p.value !== undefined) ? p.value : p.default;
        }
      }
      eff.params = paramObj;
    }
  });
}

function renderEffectLayers() {
  const effects = projectConfig.canvas.effects || [];
  // Ensure each effect DOM exists and is in correct order
  for (let i = 0; i < effects.length; i++) {
    const id = `effect_${i}`;
    let node = document.getElementById(id);
    if (!node) {
      renderImageEffectLayer(i);
      node = document.getElementById(id);
    } else {
      // If existing but not in the correct order within the container, reposition
      if (effectLayersContainer.children[i] !== node) {
        effectLayersContainer.insertBefore(node, effectLayersContainer.children[i] || null);
      }
      renderImageEffectLayer(i);
    }
  }
  // Remove any extra dom nodes after the last effect
  const existing = Array.from(effectLayersContainer.querySelectorAll('.effect-layer-item'));
  for (let j = existing.length - 1; j >= effects.length; j--) {
    effectLayersContainer.removeChild(existing[j]);
  }
  drawComposite();
}

// Update a single image effect layer DOM based on current Setup.Settings
function renderImageEffectLayer(idx) {
  const eff = projectConfig.canvas.effects?.[idx];
  if (!eff) return;
  const field = document.getElementById(`effect_${idx}`);
  // If element missing, create it by cloning the template and append
  let created = false;
  let node = field;
  if (!node) {
    const clone = effectLayerTemplate.content.cloneNode(true);
    node = clone.querySelector('.effect-layer-item');
    node.id = `effect_${idx}`;
    effectLayersContainer.appendChild(clone);
    created = true;
  }

  // Update label
  const expandLabel = node.querySelector('label.expand-label');
  const effectName = EFFECTS_REGISTRY[eff.type]?.name || 'Effect';
  if (expandLabel) expandLabel.textContent = effectName;

  // Update enabled state
  const enabledCheckbox = node.querySelector('.effect-enabled-checkbox');
  if (enabledCheckbox) {
    enabledCheckbox.checked = eff.enabled !== false;
    enabledCheckbox.onchange = () => {
      eff.enabled = enabledCheckbox.checked;
      drawComposite();
    };
  }

  // Rebuild params UI for this effect only if DOM differs from data
  const paramsContainer = node.querySelector('.effect-params-container');
  let shouldUpdateParams = true;
  if (paramsContainer) {
    const domParams = readParamsFromContainer(paramsContainer);
    try {
      const a = (typeof PipelineStep !== 'undefined' && PipelineStep._stableStringify) ? PipelineStep._stableStringify(domParams) : JSON.stringify(domParams);
      const b = (typeof PipelineStep !== 'undefined' && PipelineStep._stableStringify) ? PipelineStep._stableStringify(eff.params || {}) : JSON.stringify(eff.params || {});
      shouldUpdateParams = a !== b;
    } catch (err) {
      shouldUpdateParams = true;
    }
    if (shouldUpdateParams) addEffectParamsOptions(paramsContainer, eff.type, eff.params, idx);
  }

  // Reattach buttons (use onclick to avoid duplicate listeners)
  const deleteBtn = node.querySelector('.delete-effect-btn');
  if (deleteBtn) deleteBtn.onclick = deleteImageEffectLayer;
  const duplicateBtn = node.querySelector('.duplicate-effect-btn');
  if (duplicateBtn) duplicateBtn.onclick = duplicateImageEffectLayer;
  const defaultBtn = node.querySelector('.default-effect-btn');
  if (defaultBtn) defaultBtn.onclick = setImageEffectLayerDefault;

  // Update visible rendering
  if (created) {
    // Set expand checkbox/label id and text for the newly created element
    const expandCheck = node.querySelector('input.expand-checkbox');
    const expandLabel = node.querySelector('label.expand-label');
    const uniqueId = `effect_check_${idx}`;
    if (expandCheck) expandCheck.id = uniqueId;
    if (expandLabel) {
      expandLabel.setAttribute('for', uniqueId);
      expandLabel.textContent = effectName;
    }
  }
  // Always update rendering after param changes (use unified drawComposite to
  // respect the pipeline when available)
  drawComposite();
}

// Helper: read params object from a params container DOM
function readParamsFromContainer(container) {
  const params = {};
  if (!container) return params;
  const controls = container.querySelectorAll('[data-param-key]');
  controls.forEach((c) => {
    const key = c.dataset.paramKey;
    if (!key) return;
    params[key] = getControlValue(c);
  });
  return params;

}

// ======================
// Text Effect Layers UI + Logic
// ======================

function addTextEffectToLayer(layerIndex, userDefault) {
  if (!Array.isArray(projectConfig.textLayers)) projectConfig.textLayers = [];
  if (!projectConfig.textLayers[layerIndex]) return;

  const userDefaultObj = userDefault || {};
  const effectType = userDefaultObj.type ?? availableTextEffects?.[0]?.id ?? 'fade';

  const registryDefaults = {};
  for (const p of (TEXT_EFFECTS[effectType]?.params ?? [])) {
    registryDefaults[p.key] = p.default;
  }

  const finalParams = { ...registryDefaults, ...(userDefaultObj.params ?? {}) };

  projectConfig.textLayers[layerIndex].effects = projectConfig.textLayers[layerIndex].effects || [];
  projectConfig.textLayers[layerIndex].effects.push({ type: effectType, params: finalParams, enabled: true });
  // Render the new effect only
  renderTextEffectLayer(layerIndex, projectConfig.textLayers[layerIndex].effects.length - 1);
}

function addTextEffectLayer(e) {
  if (e) {
      e.preventDefault(); // Stop default browser behavior (like form submissions)
      e.stopPropagation(); // Stop event from bubbling to parents
      e.stopImmediatePropagation(); // Stop other listeners on this same element
  }
  // event handler on button inside layer
  const layerItem = e.target.closest('.text-layer-item');
  const allLayers = Array.from(textLayersContainer.querySelectorAll('.text-layer-item'));
  const layerIndex = allLayers.indexOf(layerItem);
  if (layerIndex < 0) return;
  addTextEffectToLayer(layerIndex);
}

function deleteTextEffectLayer(e) {
  if (e) {
      e.preventDefault(); // Stop default browser behavior (like form submissions)
      e.stopPropagation(); // Stop event from bubbling to parents
      e.stopImmediatePropagation(); // Stop other listeners on this same element
  }
  // 1. PREVENT DOUBLE FIRING
  if (e) {
      e.preventDefault(); // Stop default browser behavior (like form submissions)
      e.stopPropagation(); // Stop event from bubbling to parents
      e.stopImmediatePropagation(); // Stop other listeners on this same element
  }

  // id = text_effect_{layer}_{idx}
  const indexId = e.target.parentElement.id || e.target.closest('.text-effect-layer-item')?.id; 
  if (!indexId) return;

  const parts = indexId.replace('text_effect_', '').split('_');
  const layerIndex = parseInt(parts[0]);
  const effectIndex = parseInt(parts[1]);

  if (isNaN(layerIndex) || isNaN(effectIndex)) return;
  if (!projectConfig.textLayers[layerIndex] || !Array.isArray(projectConfig.textLayers[layerIndex].effects)) return;

  projectConfig.textLayers[layerIndex].effects.splice(effectIndex, 1);
  renderTextEffectLayersFor(layerIndex);
}

function duplicateTextEffectLayer(e) {
  // if event passed, prevent double firing
  if (e) {
      e.preventDefault(); // Stop default browser behavior (like form submissions)
      e.stopPropagation(); // Stop event from bubbling to parents
      e.stopImmediatePropagation(); // Stop other listeners on this same element
  }
  const indexId = e.target.parentElement.id || e.target.closest('.text-effect-layer-item')?.id; // fallback
  if (!indexId) return;
  const parts = indexId.replace('text_effect_', '').split('_');
  const layerIndex = parseInt(parts[0]);
  const effectIndex = parseInt(parts[1]);
  if (isNaN(layerIndex) || isNaN(effectIndex)) return;
  const effectCopy = JSON.parse(JSON.stringify(projectConfig.textLayers[layerIndex].effects[effectIndex]));
  projectConfig.textLayers[layerIndex].effects.splice(effectIndex + 1, 0, effectCopy);
  renderTextEffectLayersFor(layerIndex);
}

function setTextEffectLayerDefault(e) {
  if (e) {
      e.preventDefault(); // Stop default browser behavior (like form submissions)
      e.stopPropagation(); // Stop event from bubbling to parents
      e.stopImmediatePropagation(); // Stop other listeners on this same element
  }
  const indexId = e.target.parentElement.id || e.target.closest('.text-effect-layer-item')?.id; // fallback
  if (!indexId) return;
  const parts = indexId.replace('text_effect_', '').split('_');
  const layerIndex = parseInt(parts[0]);
  const effectIndex = parseInt(parts[1]);
  if (isNaN(layerIndex) || isNaN(effectIndex)) return;
  Setup.defaults.textEffect = {...projectConfig.textLayers[layerIndex].effects[effectIndex]};
  saveprojectConfig();
  toastMessage('Text Effect default set', { position: 'bottomCenter', type: 'success' });
}

function renderTextEffectLayersFor(layerIndex) {
  const layerEl = textLayersContainer.querySelectorAll('.text-layer-item')[layerIndex];
  if (!layerEl) return;
  const container = layerEl.querySelector('.text-effects-container');
  if (!container) return;
  const effects = projectConfig.textLayers[layerIndex].effects || [];

  // Ensure each effect DOM exists, is in the correct order and updated
  for (let i = 0; i < effects.length; i++) {
    const id = `text_effect_${layerIndex}_${i}`;
    let node = document.getElementById(id);
    if (!node) {
      // create via renderer (it appends to the container)
      renderTextEffectLayer(layerIndex, i);
      node = document.getElementById(id);
    } else {
      // Move into correct order if necessary
      if (container.children[i] !== node) {
        container.insertBefore(node, container.children[i] || null);
      }
      // Update node content
      renderTextEffectLayer(layerIndex, i);
    }
  }

  // Remove extra DOM nodes beyond the current effects length
  const existing = Array.from(container.querySelectorAll('.text-effect-layer-item'));
  for (let j = existing.length - 1; j >= effects.length; j--) {
    const last = existing[j];
    container.removeChild(last);
  }
}

function renderTextEffectLayers() {
  // loop all layers and render
  const layers = textLayersContainer.querySelectorAll('.text-layer-item');
  layers.forEach((item, idx) => renderTextEffectLayersFor(idx));
}

function changeTextEffectLayerType(event) {
  const field = event.target.closest('.text-effect-layer-item');
  const newType = event.target.value;
  const idxParts = field.id.replace('text_effect_', '').split('_');
  const layerIndex = parseInt(idxParts[0]);
  const effIndex = parseInt(idxParts[1]);
  if (!projectConfig.textLayers[layerIndex]) return;
  const eff = projectConfig.textLayers[layerIndex].effects[effIndex];
  const newTypeDef = TEXT_EFFECTS[newType];
  if (!newTypeDef) return;
  eff.type = newType;
  const registryDefaults = {};
  for (const p of newTypeDef.params ?? []) registryDefaults[p.key] = p.default;
  eff.params = {...registryDefaults, ...(eff.params || {}) };
  // Update only the specific text effect item instead of the whole layer list
  renderTextEffectLayer(layerIndex, effIndex);
}

// Update a single text effect layer's DOM
function renderTextEffectLayer(layerIndex, effIndex) {
  const layer = projectConfig.textLayers?.[layerIndex];
  if (!layer || !Array.isArray(layer.effects) || !layer.effects[effIndex]) return;
  const eff = layer.effects[effIndex];
  const container = textLayersContainer.querySelectorAll('.text-layer-item')[layerIndex]?.querySelector('.text-effects-container');
  if (!container) return;

  const fieldId = `text_effect_${layerIndex}_${effIndex}`;
  let field = document.getElementById(fieldId);
  // Create if missing
  if (!field) {
    const clone = textEffectLayerTemplate.content.cloneNode(true);
    field = clone.querySelector('.text-effect-layer-item');
    field.id = fieldId;
    container.appendChild(clone);
  }

  // Enabled checkbox
  const enabledCheckbox = field.querySelector('.text-effect-enabled-checkbox');
  if (enabledCheckbox) {
    enabledCheckbox.checked = eff.enabled !== false;
    enabledCheckbox.id = `text_effect_enabled_${layerIndex}_${effIndex}`;
    enabledCheckbox.onchange = () => {
      eff.enabled = enabledCheckbox.checked;
      updateTextSettings();
    };
  }

  // Expand checkbox + label
  const expandCheck = field.querySelector('input.expand-checkbox');
  const expandLabel = field.querySelector('label.expand-label');
  if (expandCheck && expandLabel) {
    const expandId = `text_effect_expand_${layerIndex}_${effIndex}`;
    expandCheck.id = expandId;
    expandLabel.htmlFor = expandId;
    const effectFriendlyName = (TEXT_EFFECTS && TEXT_EFFECTS[eff.type] && TEXT_EFFECTS[eff.type].name) ? TEXT_EFFECTS[eff.type].name : eff.type;
    expandLabel.textContent = `${effectFriendlyName}`;
  }

  // Params container
  const paramsContainer = field.querySelector('.text-effect-params-container');
    if (paramsContainer) {
    const domParams = readParamsFromContainer(paramsContainer);
    try {
      const a = (typeof PipelineStep !== 'undefined' && PipelineStep._stableStringify) ? PipelineStep._stableStringify(domParams) : JSON.stringify(domParams);
      const b = (typeof PipelineStep !== 'undefined' && PipelineStep._stableStringify) ? PipelineStep._stableStringify(eff.params || {}) : JSON.stringify(eff.params || {});
      if (a !== b) {
        addTextEffectParamsOptions(paramsContainer, eff.type, eff.params || {}, layerIndex, effIndex);
      }
    } catch (err) {
      addTextEffectParamsOptions(paramsContainer, eff.type, eff.params || {}, layerIndex, effIndex);
    }
  }

  // Buttons
  const deleteBtn = field.querySelector('.delete-text-effect-btn');
  if (deleteBtn) deleteBtn.onclick = deleteTextEffectLayer;
  const duplicateBtn = field.querySelector('.duplicate-text-effect-btn');
  if (duplicateBtn) duplicateBtn.onclick = duplicateTextEffectLayer;
  const defaultBtn = field.querySelector('.default-text-effect-btn');
  if (defaultBtn) defaultBtn.onclick = setTextEffectLayerDefault;

  // Trigger update to re-render text
  updateTextSettings();
}

function onTextEffectParamChange(event) {
  const control = event.target;
  const layerIndex = parseInt(control.dataset.layerIndex);
  const effIndex = parseInt(control.dataset.effectIndex);
  const key = control.dataset.paramKey;
  if (isNaN(layerIndex) || isNaN(effIndex) || !key) return;
  const parsedValue = getControlValue(control);
  const effects = Setup?.Settings?.textLayers?.[layerIndex]?.effects;
  if (!effects || !effects[effIndex]) return;
  effects[effIndex].params = effects[effIndex].params || {};
  effects[effIndex].params[key] = parsedValue;
  control.title = String(parsedValue);
  updateTextSettings();
}

// Hooks from addTextLayer - attach listener to add-text-effect-btn

addEffectLayerBtn?.addEventListener('click', addImageEffectLayer);


window.addEventListener('DOMContentLoaded', renderEffectLayers);
window.addEventListener('DOMContentLoaded', renderTextEffectLayers);

// drawCompositeEffects removed — effects are applied within drawCompositeImage() now
// ======================
if (typeof module != 'undefined') {
  utils = require("../../scripts/components/utils/common");
  Jellyfin = require("./jellyfin");
}

// ======================
// DOM Element References
// ======================
const mainCanvas = document.getElementById("myCanvas");
const mainCtx = mainCanvas.getContext("2d");

// Templates
const template = document.getElementById('slot-template');
const coverTemplate = document.getElementById('cover-template');
const posterTemplate = document.getElementById('poster-template');

// ⭐️ NEW: Template References ⭐️
const textLayerTemplate = document.getElementById("text-layer-template");

// ⭐️ NEW: Container References ⭐️
const textLayersContainer = document.getElementById("text-layers-container");

// Slots
const imageSlots = document.getElementById('image-slots');

// This is the hidden <select> we use to populate new layer clones
const fontSelectElement = document.getElementById("fontSelect");

// Canvas Settings
const RatioSelectElement = document.getElementById("RatioSelect");
const typeSelectElement = document.getElementById("typeSelect");
const typeSettingsContainer = document.getElementById("typeSettingsContainer");
const customWidthElement = document.getElementById("customWidth");
const customHeightElement = document.getElementById("customHeight");

// Export Settings
const exportProjectImagesFormatSelectElement = document.getElementById("exportProjectImagesFormatSelect");
const exportProjectImagesQualityElement = document.getElementById("exportProjectImagesQuality");

const exportImageImagesFormatSelectElement = document.getElementById("exportImageImagesFormatSelect");
const exportImageImagesQualityElement = document.getElementById("exportImageImagesQuality");

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

function deprecatedProjectConfigFixes(jsonData) {
    delete jsonData.Setup.Sizes;
    delete jsonData.Setup.Library;
    delete jsonData.Setup.Images;
    delete jsonData.Setup.loadingType;
    delete jsonData.Setup.defaults;
    delete jsonData.Setup.Settings.export;

    // on the jsonData.Setup.Settings.textLayers array, remove strokes and shadows keys
    if (jsonData.Setup && jsonData.Setup.Settings && Array.isArray(jsonData.Setup.Settings.textLayers)) {
      jsonData.Setup.Settings.textLayers.forEach(layer => {
        delete layer.strokes;
        delete layer.shadows;
      });
    }

    return jsonData;
}

function loadFullProjectFromJson(jsonData, isSetupOnly = false) {
  toastMessage('Loading Setup from JSON...', { position: 'bottomCenter', type: 'info', duration: 2000 });
  // set the memory as not loaded
  window.memoryLoaded = false;
  // first, we need to clear all the text layers
  clearTextLayersMemory();
  // then clear the images using the existing function

  jsonData = deprecatedProjectConfigFixes(jsonData);

  projectConfig = jsonData.Setup.Settings;

  if (!isSetupOnly)
    deleteAllSlots();
  if (jsonData.Setup) {
    // Get the default Setup from config.js
    const defaultSetup = window.defaultSetup || Setup;
    // Merge imported Setup with defaults to ensure all keys exist
    Setup = deepMerge(jsonData.Setup, defaultSetup);
    // Normalize params for effects so UI expects an object map
    normalizeEffectParams(projectConfig.canvas.effects);
    // Remove unsupported/legacy param level data
    try { (projectConfig.canvas.effects || []).forEach(e => delete e.params_enabled); } catch(err) {}
    loadTextLayers(projectConfig.textLayers);
  }

  RatioSelectElement.value = projectConfig.canvas.format;
  typeSelectElement.value = projectConfig.canvas.type;

  addTypeParamsOptions(typeSettingsContainer, projectConfig.canvas.composite.type, projectConfig.canvas.composite.params || {});

  if(!isSetupOnly) {
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
  }
  window.memoryLoaded = true;
  updateImageSettings();
  updateTextSettings();
  saveprojectConfig();
  saveFieldsToStorage();
  drawComposite();
  renderEffectLayers();
  renderTextEffectLayers();
}

// Normalize composite params to registry keys and defaults
function normalizeCompositeParams(compositeObj) {
  if (!compositeObj || typeof COMPOSITE_REGISTRY === 'undefined') return;
  const def = COMPOSITE_REGISTRY[compositeObj.type] || {};
  const existing = compositeObj.params || {};
  const sanitized = {};
  for (const p of def.params || []) {
    sanitized[p.key] = existing[p.key] !== undefined ? existing[p.key] : p.default;
  }
  compositeObj.params = sanitized;
}

// Ensure composite uses defaults when missing/empty and merges params where appropriate
function ensureCompositeDefaults(...params) {
  // Ensure canvas exists
  if (!Setup.Settings) Setup.Settings = {};
  if (!projectConfig.canvas) projectConfig.canvas = {};

  const defaultComposite = (Setup.defaults && Setup.defaults.canvas) ? JSON.parse(JSON.stringify(Setup.defaults.canvas)) : null;
  // If composite missing or explicitly an empty object (no own keys), set from defaults
  const comp = projectConfig.canvas.composite;
  const isEmptyObj = comp && typeof comp === 'object' && Object.keys(comp).length === 0;
  if (!comp || isEmptyObj) {
    if (defaultComposite) {
      // Ensure type falls back to canvas type if missing
      if (!defaultComposite.type) defaultComposite.type = projectConfig.canvas.type || (typeof typeSelectElement !== 'undefined' && typeSelectElement?.value) || 'line';
      // Ensure enabled property exists (default to true)
      if (defaultComposite.enabled === undefined) defaultComposite.enabled = true;
      projectConfig.canvas.composite = defaultComposite;
      return;
    }
    // Fallback minimal composite
    projectConfig.canvas.composite = { enabled: true, type: projectConfig.canvas.type || (typeof typeSelectElement !== 'undefined' && typeSelectElement?.value) || 'line', params: {} };
    return;
  }

  // If composite exists but has no type, prefer default composite type
  if (!projectConfig.canvas.composite.type) {
    if (defaultComposite && defaultComposite.type) projectConfig.canvas.composite.type = defaultComposite.type;
    else projectConfig.canvas.composite.type = projectConfig.canvas.type || (typeof typeSelectElement !== 'undefined' && typeSelectElement?.value) || 'line';
  }

  // Ensure params map exists
  if (!projectConfig.canvas.composite.params || typeof projectConfig.canvas.composite.params !== 'object') {
    projectConfig.canvas.composite.params = {};
  }

  // Merge missing params from default (only if defaultComposite exists and type matches)
  if (defaultComposite && defaultComposite.params && defaultComposite.type === projectConfig.canvas.composite.type) {
    const existing = projectConfig.canvas.composite.params || {};
    for (const k in defaultComposite.params) {
      if (!Object.prototype.hasOwnProperty.call(existing, k)) {
        projectConfig.canvas.composite.params[k] = defaultComposite.params[k];
      }
    }
  }

  // Ensure composite params also reflect COMPOSITE_REGISTRY defaults when registry is available.
  // This covers the "clean page" scenario where `Setup.defaults.composite.params` is empty
  // but we still need the composite params populated with the registry's defaults.
  try {
    if (typeof normalizeCompositeParams === 'function') {
      normalizeCompositeParams(projectConfig.canvas.composite, ...params);
    }
  } catch (err) {
    // Do not fail the whole flow if normalization fails — just log for debugging
    console.warn('Error normalizing composite params inside ensureCompositeDefaults:', err);
  }
}

function makeSaveAllJson() {
  const save = {};
  save.Setup = projectConfig ? { Settings: projectConfig } : { Settings: {} };
  // Don't include image URLs - images will be exported separately in ZIP
  save.imageSlots = slotsImages.map(img => img ? 'placeholder' : null);
  return JSON.stringify(save, null, 2);
}

function clearTextLayersMemory() {
  textLayersContainer.innerHTML = '';
  projectConfig.textLayers = [];
  updateTextSettings();
  localStorage.removeItem("textLayers");
}

function saveSetup() {
  if(window.memoryLoaded)
    localStorage.setItem("setup", JSON.stringify(Setup));
}

function saveprojectConfig() {
  if(window.memoryLoaded)
    localStorage.setItem("projectConfig", JSON.stringify(projectConfig));
  
}

function loadSetup() {
  const savedSetup = localStorage.getItem("setup");
  if (savedSetup) {
    const defaultSetup = window.defaultSetup || Setup;
    Setup = deepMerge(JSON.parse(savedSetup), defaultSetup);
    // Update export settings UI
    if (Setup?.Export?.Project?.Images) {
      exportProjectImagesFormatSelectElement.value = Setup.Export.Project.Images.format || 'webp';
      exportProjectImagesQualityElement.value = Setup.Export.Project.Images.jpegQuality || 0.95;
    }
    if (Setup?.Export?.Image?.Images) {
      exportImageImagesFormatSelectElement.value = Setup.Export.Image.Images.format || 'webp';
      exportImageImagesQualityElement.value = Setup.Export.Image.Images.jpegQuality || 0.95;
    }
  }
}

function loadprojectConfig() {
  const savedprojectConfig = localStorage.getItem("projectConfig");
  if (savedprojectConfig) {
    const defaultprojectConfig = window.defaultprojectConfig || projectConfig;
    console.log({effects: JSON.parse(savedprojectConfig)?.canvas?.effects});

    projectConfig = deepMerge(JSON.parse(savedprojectConfig), defaultprojectConfig);
    console.log({effects: projectConfig.canvas.effects});
    normalizeEffectParams(projectConfig.canvas.effects);
    try { (projectConfig.canvas.effects || []).forEach(e => delete e.params_enabled); } catch (err) {}
    try {
      if (projectConfig.canvas?.composite) {
        const def = COMPOSITE_REGISTRY[projectConfig.canvas.composite.type] || {};
        const schemaKeys = new Set((def.params || []).map(p => p.key));
        const sanitized = {};
        const existing = projectConfig.canvas.composite.params || {};
        for (const k of schemaKeys) {
          sanitized[k] = existing[k] !== undefined ? existing[k] : (def.params.find(p => p.key === k)?.default);
        }
        projectConfig.canvas.composite.params = sanitized;
      }
    } catch (err) {
      console.warn('Error normalizing composite params on loadSetup:', err);
    }
    try { ensureCompositeDefaults(); } catch(err) { console.warn('Error ensuring composite defaults:', err); }
    try { normalizeCompositeParams(projectConfig.canvas.composite); } catch(err) { console.warn('Error normalizing composite params after ensureCompositeDefaults:', err); }
    loadTextLayers(projectConfig.textLayers);
  }
}

function clearSavedSetup() {
  localStorage.removeItem("setup");
}

function clearSavedprojectConfig() {
  localStorage.removeItem("projectConfig");
}

function loadTextLayers(layersData) {
  // Prevent re-entrant or duplicate loads
  if (window._loadingTextLayers) {
    console.warn('loadTextLayers: already loading, skipping duplicate call');
    return;
  }
  window._loadingTextLayers = true;

  window.memoryLoaded = false;
  let idsToCheck = []
  if (layersData) {
    for (let index = 0; index < layersData.length; index++) {
      const layerData = layersData[index];
      const id = ensureUniqueId("layer_{n}", getIndexFromId(layerData.id)).index;
      idsToCheck.push(id)
      // Do manually, using the functions, to add layer.
      const newLayerId = addTextLayer(id); // This function should return the ID of the new layer
      const newLayerEl = document.getElementById(newLayerId); // Get the newly created DOM element
      // Populate basic font settings
      const textInput = newLayerEl.querySelector(".overlayText-input");
      textInput.value = layerData.overlayText;
      updateLayerLabel(textInput); // Update label based on text
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

      // Populate text effects (render UI directly so we don't depend on internal Setup.Settings)
      if (Array.isArray(layerData.effects) && layerData.effects.length) {
        const container = newLayerEl.querySelector('.text-effects-container');
        const allLayers = Array.from(textLayersContainer.querySelectorAll('.text-layer-item'));
        const currentLayerIndex = allLayers.indexOf(newLayerEl.querySelector('.text-layer-item'));
        container.innerHTML = '';
        for (let idxEf = 0; idxEf < layerData.effects.length; idxEf++) {
          const effData = layerData.effects[idxEf];
          const clone = textEffectLayerTemplate.content.cloneNode(true);
          const field = clone.querySelector('.text-effect-layer-item');
          field.id = `text_effect_${currentLayerIndex}_${idxEf}`;
            const enabledCheckbox = field.querySelector('.text-effect-enabled-checkbox');
            enabledCheckbox.checked = effData.enabled !== false;
            // Ensure the enabled checkbox has a stable id so associated labels/logic target the correct control
            enabledCheckbox.id = `text_effect_enabled_${currentLayerIndex}_${idxEf}`;
            enabledCheckbox.addEventListener('change', () => updateTextSettings());
          const paramsContainer = field.querySelector('.text-effect-params-container');
          addTextEffectParamsOptions(paramsContainer, effData.type, effData.params || {}, currentLayerIndex, idxEf);
          // Setup the expand checkbox id/label and readable name for the loaded effect
          const expandCheck = field.querySelector('input.expand-checkbox');
          const expandLabel = field.querySelector('label.expand-label');
          const expandId = `text_effect_expand_${currentLayerIndex}_${idxEf}`;
          if (expandCheck) expandCheck.id = expandId;
          if (expandLabel) {
            expandLabel.htmlFor = expandId;
            const effectFriendlyName = (TEXT_EFFECTS && TEXT_EFFECTS[effData.type] && TEXT_EFFECTS[effData.type].name) ? TEXT_EFFECTS[effData.type].name : effData.type;
            expandLabel.textContent = `${effectFriendlyName}`;
          }
          field.querySelector('.delete-text-effect-btn').addEventListener('click', deleteTextEffectLayer);
          field.querySelector('.duplicate-text-effect-btn').addEventListener('click', duplicateTextEffectLayer);
          field.querySelector('.default-text-effect-btn').addEventListener('click', setTextEffectLayerDefault);
          container.appendChild(clone);
        }
      }
    }
  }
  // check if the dom was updated and all the idsToCheck are in it
  if(idsToCheck.length == layersData.length)
    window.memoryLoaded = true;
  
  updateTextSettings(); // Redraw canvas with loaded settings
  window._loadingTextLayers = false;
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
  projectConfig.textLayers = [];

  const layerElements = textLayersContainer.querySelectorAll(".text-layer-item");

  // Use a sequential for...of loop to handle async font loading
  let layerIndex = 0;
  for (const layerEl of layerElements) {
    const newLayer = {
      font: {},
      position: {},
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

    // 5. Read Text Effect Layers (per-layer)
    const labelEl = layerEl.querySelector('.add-text-effect-btn').parentElement.querySelector('label');
    labelEl.setAttribute('layerIndex', layerIndex);
    newLayer.effects = [];
    const textEffectElements = layerEl.querySelectorAll('.text-effect-layer-item');
    let textEffIndex = 0;
    for (const effEl of textEffectElements) {
      const newEff = {};
      const typeSelect = effEl.querySelector('.effectTypeSelect-input');
      newEff.type = typeSelect ? typeSelect.value : (availableTextEffects?.[0]?.id || 'fade');
      const enabledCheckbox = effEl.querySelector('.text-effect-enabled-checkbox');
      newEff.enabled = enabledCheckbox ? enabledCheckbox.checked : true;
      newEff.params = newEff.params || {};
      const paramControls = effEl.querySelectorAll('.effect-param-slider');
      for (const control of paramControls) {
        const pKey = control.dataset.paramKey;
        if (!pKey) continue;
        newEff.params[pKey] = getControlValue(control);
      }
      effEl.setAttribute('layerIndex', layerIndex);
      effEl.setAttribute('effectIndex', textEffIndex);
      newLayer.effects.push(newEff);
      textEffIndex++;
    }

    // 5. Add the completed layer to settings
    projectConfig.textLayers.push(newLayer);
    layerIndex++;
  }

  // 6. Redraw the canvas
  drawComposite();
  saveprojectConfig();
}

function updateCustomValues() {
  Setup.Sizes.custom.width = parseInt(customWidthElement.value) || 1;
  Setup.Sizes.custom.height = parseInt(customHeightElement.value) || 1;
}

function updateImageSettings(skipEffectsRerender = false) {
  projectConfig.canvas.format = RatioSelectElement.value;
  const _format = Setup.Sizes[projectConfig.canvas.format]
  const ratio = _format.width / _format.height;

  // The idea is that the min size be 1920
  if (ratio > 1) { // cover
    _format.width = 1920;
    _format.height = Math.round(1920 / ratio);
  } else { // poster
    _format.width = Math.round(1920 * ratio);
    _format.height = 1920;
  }
  
  projectConfig.canvas.type = typeSelectElement.value;
  setCanvasSize(_format.width, _format.height);
  // Use unified drawComposite so pipeline is used when available
  drawComposite();
  if (!skipEffectsRerender) renderEffectLayers();
  saveprojectConfig();
}

function updateExportSettings() {
  Setup.Export.Project.Images.format = exportProjectImagesFormatSelectElement.value || 'png';
  Setup.Export.Project.Images.quality = parseFloat(exportProjectImagesQualityElement.value) || 0.95;
  Setup.Export.Image.Images.format = exportImageImagesFormatSelectElement.value || 'png';
  Setup.Export.Image.Images.quality = parseFloat(exportImageImagesQualityElement.value) || 0.95;
  
  // Clamp quality between 0 and 1
  if (Setup.Export.Project.Images.quality < 0) Setup.Export.Project.Images.quality = 0;
  if (Setup.Export.Project.Images.quality > 1) Setup.Export.Project.Images.quality = 1;
  if (Setup.Export.Image.Images.quality < 0) Setup.Export.Image.Images.quality = 0;
  if (Setup.Export.Image.Images.quality > 1) Setup.Export.Image.Images.quality = 1;
  
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
  const ids = projectConfig.textLayers.map(layer => getIndexFromId(layer.id));
  const lastId = ids.length ? Math.max(...ids) : -1;
  return lastId;
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

// Text Layers Buttons & Functions


function updateLayerLabel(e) {
  const newText = e.value?.trim() || 'New Layer';
  const labelEl = e.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.querySelector('label.expand-label');
  if (labelEl) {
    labelEl.textContent = newText;
  }
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
  clone.querySelector(".default-layer-btn").addEventListener("click", setTextLayerDefault);
  clone.querySelector(".duplicate-layer-btn").addEventListener("click", duplicateTextLayer);
  clone.querySelector(".delete-layer-btn").addEventListener("click", deleteTextLayer);
  clone.querySelector('.add-text-effect-btn')?.addEventListener('click', addTextEffectLayer);

  // if done loading, set and all the default layers needed
  // it must use the addStroke and addShadow, because only they will add and run the necessary commands
  // Then this here will update their info with the default ones
  if(window.memoryLoaded) {
    if (Setup.defaults.textLayers) {
      // Populate basic font settings
      clone.querySelector(".overlayText-input").value = Setup.defaults.textLayers.overlayText;
      clone.querySelector(".fontSelect-input").value = Setup.defaults.textLayers.font.family;
      clone.querySelector(".fontWeightSelect-input").value = Setup.defaults.textLayers.font.weight;
      clone.querySelector(".fontStyleSelect-input").value = Setup.defaults.textLayers.font.style;
      clone.querySelector(".fontSize-input").value = Setup.defaults.textLayers.font.size;
      clone.querySelector(".fontColor-input").value = Setup.defaults.textLayers.font.color;
      clone.querySelector(".fontOpacity-input").value = Setup.defaults.textLayers.font.opacity;

      // Populate position settings
      clone.querySelector(".textAlign-input").value = Setup.defaults.textLayers.position.textAlign;
      clone.querySelector(".textBaseline-input").value = Setup.defaults.textLayers.position.textBaseline;
      clone.querySelector(".positionX-input").value = Setup.defaults.textLayers.position.x;
      clone.querySelector(".positionY-input").value = Setup.defaults.textLayers.position.y;
      clone.querySelector(".rotation-input").value = Setup.defaults.textLayers.position.rotation || 0;
    }
  }

  textLayersContainer.appendChild(clone);
  updateTextSettings();
  return fieldCheckbox.id;
}

function duplicateTextLayer(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  loadTextLayers([projectConfig.textLayers[layerIndex]]);
}

function setTextLayerDefault(e) {
  const layerIndex = parseInt(e.target.parentElement.getAttribute('layerIndex'));
  Setup.defaults.textLayers = {...projectConfig.textLayers[layerIndex]}
  saveSetup();
  toastMessage('Text Layer default set', { position: 'bottomCenter', type: 'success' });
}

function deleteTextLayer(e) {
  e.target.parentElement.remove();
  updateTextSettings();
}

function initTextLayers() {
  textLayersContainer.innerHTML = '';
  updateTextSettings();
}

// Images Buttons & Functions
function addImageEffectLayer() {
  const userDefault = Setup?.defaults?.effects ?? {};
  const effectType = userDefault.type ?? availableEffects?.[0]?.id ?? 'blur';

  // Start with registry defaults
  const registryDefaults = {};
  for (const p of EFFECTS_REGISTRY[effectType]?.params ?? []) {
    registryDefaults[p.key] = p.default;
  }

  // Merge: user params override registry defaults
  const finalParams = { ...registryDefaults, ...(userDefault.params ?? {}) 
  };

  projectConfig.canvas.effects.push({
    type: effectType,
    params: finalParams,
    enabled: true
  });
  // Only render the newly added effect
  renderImageEffectLayer(projectConfig.canvas.effects.length - 1);
}

function deleteImageEffectLayer(e) {
  const index = parseInt(e.target.parentElement.id.replace('effect_', ''));
  projectConfig.canvas.effects.splice(index, 1);
  renderEffectLayers();
}

function duplicateImageEffectLayer(e) {
  const index = parseInt(e.target.parentElement.id.replace('effect_', ''));
  const effectCopy = JSON.parse(JSON.stringify(projectConfig.canvas.effects[index]));
  projectConfig.canvas.effects.splice(index + 1, 0, effectCopy);
  renderEffectLayers();
}

function setImageEffectLayerDefault(e) {
  const index = parseInt(e.target.parentElement.id.replace('effect_', ''));
  Setup.defaults.effects = {...projectConfig.canvas.effects[index]};
  saveSetup();
  toastMessage('Effect Layer default set', { position: 'bottomCenter', type: 'success' });
}


// ======================
// Export/Import Functions
// ======================


/**
 * Export Config as JSON file
 */
function exportConfigFile() {
  const btn = document.getElementById('exportConfigBtn');
  btn.classList.add('disabled');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.5';

  try {
    const json = JSON.stringify(Setup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'covermaker-config.json';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    toastMessage('Config exported successfully!', { position: 'bottomCenter', type: 'success' });
  } catch (err) {
    console.error('Export config failed:', err);
    toastMessage('Failed to export config', { position: 'bottomCenter', type: 'danger' });
  } finally {
    btn.classList.remove('disabled');
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
  }
}

/**
 * Import Config from JSON file
 */
function importConfigFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Reset the input so the same file can be selected again
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const jsonData = JSON.parse(e.target.result);
      
      if (!jsonData.Setup || typeof jsonData.Setup !== 'object') {
        toastMessage('Invalid config file: missing Config object', { position: 'bottomCenter', type: 'danger' });
        return;
      }

      // Merge imported Config with defaults to ensure all keys exist
      const defaultSetup = window.defaultSetup || Setup;
      Setup = deepMerge(jsonData.Setup, defaultSetup);
      
      // Update UI with imported Config values
      loadSetup();
      
      // Save to localStorage
      saveSetup();
      
      toastMessage('Config imported successfully!', { position: 'bottomCenter', type: 'success' });
    } catch (err) {
      console.error('Import config failed:', err);
      toastMessage('Failed to import config: ' + err.message, { position: 'bottomCenter', type: 'danger' });
    }
  };
  reader.readAsText(file);
}

function getExportFileName() {
  // Get the file extension based on export format
  const format = Setup.Export.Canvas.format || 'png';
  const extension = format === 'jpeg' ? '.jpg' : '.' + format;
  
  // If we have a stored project name from import, use it
  if (window.projectFileName) {
    return window.projectFileName + extension;
  }
  
  // Otherwise, build filename from all text layers
  if (projectConfig.textLayers.length > 0) {
    const allTexts = projectConfig.textLayers
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
  if (projectConfig.textLayers.length > 0) {
    const allTexts = projectConfig.textLayers
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
    }, `image/${Setup.Export.Project.Images.format}`, Setup.Export.Project.Images.quality || 0.95);
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
      const format = Setup.Export.Canvas.format || 'png';
      const quality = Setup.Export.Canvas.quality || 1.0;
      
      const fileName = getExportFileName();
      const link = document.createElement("a");
      link.href = Composites.Merged.toDataURL(`image/${format}`, quality);
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
    // REMOVED: zip.option(...) - This is not where we set compression
    
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
        const blobPromise = imgToBlob(img, `image/${Setup.Export.Project.Images.format}`, Setup.Export.Project.Images.quality || 0.95)
          .then(blob => {
            zip.file(`images/slot_${i}.${Setup.Export.Project.Images.format}`, blob);
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

    // Generate ZIP file WITH COMPRESSION
    toastMessage('Creating ZIP file...', { position: 'bottomCenter', type: 'info' });
    
    // --- THIS IS THE KEY CHANGE ---
    const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: "DEFLATE",
        compressionOptions: {
            level: 9 // 1 (fastest) to 9 (best compression)
        }
    });
    // ------------------------------

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

  clearStepsCache(); // Clear any cached steps before importing to ensure a clean state
  
  const btn = document.getElementById('importProjectBtn');
  btn.classList.add('disabled');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.5';

  try {
    // Check if it's a ZIP file
    if (file.name.endsWith('.zip') || file.name.endsWith('.covermaker.zip')) {
      await importProjectFromZip(file);
    } else if (file.name.endsWith('.json')) {
      // Legacy JSON import (without images)
      await importProjectFromJson(file);
    } else {
      alert('Unsupported file format. Please use .zip or .json files.');
    }
  } catch (error) {
    console.error('Import failed:', error);
    toastMessage('Failed to import project: ' + error.message, { position: 'bottomCenter', type: 'danger' });
  } finally {
    btn.classList.remove('disabled');
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
    event.target.value = ''; // Clear the input
  }
  drawComposite();
}

/**
 * Import project from ZIP file with images
 */
async function importProjectFromZip(file) {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip library not loaded. Please refresh the page.');
  }

  toastMessage('Opening project file...', { position: 'bottomCenter', type: 'info' });

  // Store the original filename (without extension) for future exports
  const fileName = file.name.replace(/\.covermaker\.zip$|\.zip$/i, '');
  window.projectFileName = utils.safeWindowsFileName(fileName);
  
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);


  // Lets 1º Import Images
  await importImagesFromZip(contents);
  

  // 2. Import JSON Configuration
  const projectJsonFile = contents.file('project.json');
  if (!projectJsonFile) {
    throw new Error('Invalid project file: project.json not found');
  }

  const jsonText = await projectJsonFile.async('text');
  const projectData = JSON.parse(jsonText);

  // loadFullProjectFromJson handles clearing slots and text layers
  loadFullProjectFromJson(projectData, true);

  // Finalize
  toastMessage('Finalizing...', { position: 'bottomCenter', type: 'info' });
  toastMessage('Project imported successfully!', { position: 'bottomCenter', type: 'success' });
}

/**
 * Import project from legacy JSON file (without images)
 */
async function importProjectFromJson(file) {
  
  toastMessage('Importing legacy project...', { position: 'bottomCenter', type: 'info' });
  
  // Store the original filename (without extension) for future exports
  const fileName = file.name.replace(/\.json$/i, '');
  window.projectFileName = utils.safeWindowsFileName(fileName);
  
  const text = await file.text();
  const projectData = JSON.parse(text);
      
  loadFullProjectFromJson(projectData, true);
  toastMessage('Project imported (without images)', { position: 'bottomCenter', type: 'warning' });
}

/**
 * Helper to extract and load images from ZIP contents
 */
async function importImagesFromZip(zipContents) {
  const imagesExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tiff'];
  // create a regex to match the image extensions using /slot_(\d+)\.png/
  const imageRegex = new RegExp(`slot_(\\d+)\\.(${imagesExtensions.map(ext => ext.slice(1)).join('|')})$`, 'i');

  toastMessage('Reading project data...', { position: 'bottomCenter', type: 'info' });
  const imageFiles = [];

  // Cleaning existing slots
  setSlots(0);
  
  zipContents.folder('images').forEach((relativePath, file) => {
    const match = relativePath.match(imageRegex);
    if (match) {
      const slotIndex = parseInt(match[1]);
      imageFiles.push({ slotIndex, file });
    }
  });

  // Sort by slot index
  imageFiles.sort((a, b) => a.slotIndex - b.slotIndex);

  // Set up slots if needed (loadFullProjectFromJson should have set them based on JSON, but we double check)
  if (imageFiles.length > 0) {
    const maxSlotIndex = Math.max(...imageFiles.map(f => f.slotIndex));
    if (slotsImages.length <= maxSlotIndex) {
      setSlots(maxSlotIndex + 1);
    }
  }

  // Load each image
  toastMessage(`Loading ${imageFiles.length} images...`, { position: 'bottomCenter', type: 'info' });
  
  // Use Promise.all for parallel loading
  const promises = imageFiles.map(async ({ slotIndex, file }) => {
    try {
      const blob = await file.async('blob');
      const img = await loadImage(blob);
      slotsImages[slotIndex] = img;
      setSlotImage(slotIndex, img);
    } catch (err) {
      console.error(`Failed to load image ${slotIndex}:`, err);
    }
  });
  
  await Promise.all(promises);
}

function openInNewTab(source) {

  const openBlob = (blob) => {
    if (!blob) return;

    // Always ensure it's treated as an image
    const fixedBlob = blob.type.startsWith("image/")
      ? blob
      : new Blob([blob], { type: `image/${Setup.Export.Canvas.format}` });

    const url = URL.createObjectURL(fixedBlob);
    const tab = window.open(url, "_blank");

    if (tab) {
      tab.onload = () => URL.revokeObjectURL(url);
    }
  };

  const base64ToBlob = async (base64) => {
    const res = await fetch(base64);
    const blob = await res.blob();

    // Enforce image MIME if dataURL was malformed
    if (!blob.type.startsWith("image/")) {
      return new Blob([await blob.arrayBuffer()], { type: `image/${Setup.Export.Project.Images.format}` });
    }

    return blob;
  };

  let targetObj = null;
  let isCanvas = false;
  let isImage = false;
  let shouldCrop = false;

  if (source?.target?.id === "openTabBtn" ||
      source?.target?.parentElement?.id === "openTabBtn") {
    targetObj = Composites.Merged;
    isCanvas = true;
  }
  else if (source?.target?.id === "openTextComposite" ||
           source?.target?.parentElement?.id === "openTextComposite") {
    targetObj = Composites.Text.canvas;
    isCanvas = true;
    shouldCrop = true;
  }
  else if (source?.target?.id === "openImageComposite" ||
           source?.target?.parentElement?.id === "openImageComposite") {
    targetObj = Composites.Image.canvas;
    isCanvas = true;
  }
  else {
    targetObj = getSlotPreviewByIndex(getIndexFromButtonClick(source));
    isImage = true;
  }

  if (!targetObj) return;

  if (isCanvas) {
    if (targetObj.toBlob) {
      cropCanvas(targetObj).toBlob(openBlob, `image/${Setup.Export.Canvas.format}`);
    } else if (targetObj.toDataURL) {
      const dataURL = cropCanvas(targetObj).toDataURL(`image/${Setup.Export.Canvas.format}`, Setup.Export.Canvas.quality || 1.0);
      base64ToBlob(dataURL).then(openBlob);
    }
  }
  else if (isImage) {
    const src = targetObj.src;
    if (!src) return;

    if (src.startsWith("data:")) {
      base64ToBlob(src).then(openBlob);
    } else if (src.startsWith("blob:")) {
      fetch(src)
        .then(res => res.blob())
        .then(openBlob);
    } else {
      window.open(src, "_blank");
    }
  }
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

saveSetup = Controller.wrap(saveSetup, true, 100, 100);
saveprojectConfig = Controller.wrap(saveprojectConfig, true, 100, 100);
drawComposite = Controller.wrap(drawComposite, true, 100);
revokeAllBlobUrls = Controller.wrap(revokeAllBlobUrls, false, 200, 200);

updateTextSettings = Controller.wrap(updateTextSettings, true); // debounce to prevent excessive redraws
updateImageSettings = Controller.wrap(updateImageSettings, true); // debounce to prevent excessive redraws

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
    typeSelectElement
  ].forEach((el) => {
    el.addEventListener("input", () => {
      updateImageSettings();
      drawComposite();
    });
  });
  
  // Export settings listeners
  [exportProjectImagesFormatSelectElement, exportProjectImagesQualityElement].forEach((el) => {
    el.addEventListener("input", updateExportSettings);
  });


  document.getElementById("exportConfigBtn")?.addEventListener("click", exportConfigFile);
  document.getElementById("importConfigBtn")?.addEventListener("click", () => {
    // Create a hidden file input for config import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    input.addEventListener('change', importConfigFile);
    document.body.appendChild(input);
    input.click();
    // Clean up after selection
    setTimeout(() => document.body.removeChild(input), 1000);
  });
  
  // Note: The font listeners are removed, as they are now handled by the main 'input' listener
}

// Export buttons
document.getElementById("exportBtn").addEventListener("click", exportAsPNG);
document.getElementById("openTabBtn").addEventListener("click", openInNewTab);
document.getElementById("openTextComposite").addEventListener("click", openInNewTab);
document.getElementById("openImageComposite").addEventListener("click", openInNewTab);
document.getElementById("exportProjectBtn").addEventListener("click", exportProjectFile);

document.getElementById("exportSetupBtn").addEventListener("click", () => {
  const btn = document.getElementById('exportSetupBtn');
  btn.classList.add('disabled');
  btn.style.pointerEvents = 'none';
  btn.style.opacity = '0.5';

  try {
    const json = JSON.stringify(projectConfig, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const base = getProjectBaseName ? getProjectBaseName() : 'covermaker-setup';
    link.href = url;
    link.download = `${base}.covermaker.setup.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    toastMessage('Setup exported successfully!', { position: 'bottomCenter', type: 'success' });
  } catch (err) {
    console.error('Export setup failed:', err);
    toastMessage('Failed to export setup', { position: 'bottomCenter', type: 'danger' });
  } finally {
    btn.classList.remove('disabled');
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
  }
});
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

  loadTextLayers(Setup.defaults.textLayers)
}


// On window load
window.addEventListener('load', async () => {
  // Store a deep copy of the default Setup before any modifications
  window.defaultSetup = JSON.parse(JSON.stringify(Setup));
  window.defaultprojectConfig = JSON.parse(JSON.stringify(projectConfig));
  
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
  // Load setup first so UI picks the saved composite type
  loadSetup();
  // loadprojectConfig();
  addtypeSelectOptions();
  drawComposite();
  CreateJellyfin();
  await populateFontSelect();
  initTextLayers();
  loadEssentials();
  // Ensure UI lists for effect layers are rendered after setup/load
  renderEffectLayers();
  renderTextEffectLayers();
  
  // Load custom posters limits from localStorage
  loadCustomPostersLimits();
  
  // Initialize posters limit (show custom input if needed)
  const postersLimitSelect = document.getElementById('posterslimit');
  if (postersLimitSelect) {
    setpostersLimit(postersLimitSelect.value);
  }
});

function loadEssentials() {
  window.memoryLoaded = false;
  window.memory = new pageMemory();
  window.memory.addEvent('onMemoryIsEmpty', () => dummyStart())
  window.memory.addEvent('onRestoreSucess', () => window.memoryLoaded = true)
  window.memory.addEvent('onRestoreSucess', loadprojectConfig)
  window.memory.addEvent('onRestoreSucess', updateImageSettings)
  window.memory.addEvent('onRestoreSucess', renderEffectLayers)
  window.memory.addEvent('onRestoreSucess', () => searchOnLibrary(null, true, true))
  window.memory.addEvent('onRestoreError', () =>  window.memoryLoaded = true)
  window.memory.addEvent('onSaveMemory', saveprojectConfig)
  window.memory.init();
  addSettingListeners();
  
  window.addEventListener('beforeunload', () => {
     cleanupAllBlobUrls();
  });
}

function addtypeSelectOptions() {
  typeSelectElement.innerHTML = '';
  // Use Composite Registry to populate available composite types
  let availableComposites = [];
  try {
    if (typeof getAvailableComposites === 'function') {
      availableComposites = getAvailableComposites();
    } else if (typeof COMPOSITE_REGISTRY !== 'undefined') {
      // fallback: build list from registry keys
      availableComposites = Object.entries(COMPOSITE_REGISTRY).map(([id, def]) => ({ id, name: def.name }));
    }
  } catch (err) {
    console.warn('Error while getting available composites:', err);
  }

  availableComposites.forEach((c) => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.name || c.id;
    typeSelectElement.appendChild(option);
  });
  // Ensure composite UI is initialized for the selected type
  // Set the select value based on Setup (fall back to the first option)
  if (Setup?.Settings?.canvas?.type) typeSelectElement.value = projectConfig.canvas.type;
  else if (typeSelectElement.options.length) typeSelectElement.value = typeSelectElement.options[0].value;
  // Ensure composite configuration exists and falls back to defaults if empty/missing
  ensureCompositeDefaults();
  // Load options for initial composite type
  addTypeParamsOptions(typeSettingsContainer, projectConfig.canvas.composite.type, projectConfig.canvas.composite.params || {});
  // Add change listener
  // Replace change handler (avoid adding multiple listeners)
  typeSelectElement.onchange = changeCompositeType;
}

// Adds sliders/inputs for composite params into a container
function addTypeParamsOptions(paramsContainer, compositeType, paramsObj) {
  paramsContainer.innerHTML = '';
  if (!paramsContainer) return;
  const compositeDef = COMPOSITE_REGISTRY[compositeType];
  if (!compositeDef) return;

  // Render composite params via shared renderer helper
  ParamsRenderer.renderParamsOptions(paramsContainer, compositeDef.params || [], paramsObj || {}, {
    paramTemplate: document.getElementById('effect-param-template'),
    groupTemplate: document.getElementById('options-param-group-template'),
    onChange: onCompositeParamChange
    , skipUnknown: true
  });
}

// Helper: Normalize reading a control's value across input types
function getControlValue(el) {
  if (!el) return null;
  const tag = (el.tagName || '').toUpperCase();
  const type = (el.type || '').toLowerCase();
  if (type === 'checkbox') return !!el.checked;
  if (type === 'radio') return el.checked ? el.value : null;
  if (type === 'number' || type === 'range') {
    const n = parseFloat(el.value);
    return Number.isNaN(n) ? el.value : n;
  }
  if (tag === 'SELECT') return el.value;
  if (tag === 'SPAN') return el.textContent;
  return el.value;
}

// Handler for composite param changes (unique composite, not a layer)
function onCompositeParamChange(event) {
  const slider = event.target;
  if (!slider) return;
  const key = slider.dataset.paramKey;
  if (!key) return;
  const parsedValue = getControlValue(slider);
  projectConfig.canvas.composite = projectConfig.canvas.composite || { params: {} };
  projectConfig.canvas.composite.params = projectConfig.canvas.composite.params || {};
  projectConfig.canvas.composite.params[key] = parsedValue;
  slider.title = String(parsedValue);
  drawComposite();
  // Persist changes immediately to localStorage
  saveprojectConfig();
}

// Change composite type handler
function changeCompositeType(event) {
  const newType = (event && event.target)
    ? event.target.value
    : typeSelectElement.value;

  if (!newType) return;

  // Update global type
  projectConfig.canvas.type = newType;

  // Ensure structure exists
  ensureCompositeDefaults();

  // Assign composite type
  projectConfig.canvas.composite.type = newType;

  // Always use DEFAULTS only (no merging)
  const def = COMPOSITE_REGISTRY[newType] || {};
  const params = {};

  for (const p of def.params ?? []) {
    params[p.key] = p.default;
  }

  // Overwrite everything
  projectConfig.canvas.composite.params = params;

  // Rebuild UI with fresh defaults
  addTypeParamsOptions(typeSettingsContainer, newType, params);

  // Sync + redraw
  updateImageSettings();
  drawComposite();
  saveprojectConfig();
}




function cleanMemory() {
  window.memoryLoaded = false;
  window.projectFileName = null;
  memory.reset().then(() => {
    jellyfin.cleanDb();
    clearSavedSetup();
    clearSavedprojectConfig();
    clearTextLayersMemory();
  });
}

// ✅ Dev helper: validate the composite default fallback (call from console)
window.validateCompositeFallback = function() {
  const orig = JSON.parse(JSON.stringify(projectConfig.canvas.composite));
  console.log('Before ensureCompositeDefaults:', orig);
  projectConfig.canvas.composite = {};
  ensureCompositeDefaults();
  console.log('After ensureCompositeDefaults:', JSON.parse(JSON.stringify(projectConfig.canvas.composite)));
  // Restore
  projectConfig.canvas.composite = orig;
}


function allowDrop(event) {
  event.preventDefault(); // Necessary to allow dropping
  event.currentTarget.classList.add('drag-over');
}

function removeDragOver(event) {
  event.currentTarget.classList.remove('drag-over');
}

/**
 * Generic array move function
 */
function moveInArray(arr, fromIndex, toIndex) {
  if (toIndex >= arr.length) {
    let k = toIndex - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(toIndex, 0, arr.splice(fromIndex, 1)[0]);
  return arr;
}

// ======================
// Image Effect Drag & Drop
// ======================

function onEffectDragStart(event) {
  const item = event.target.parentElement.closest('.effect-layer-item');
  // Extract index from ID (format: effect_0, effect_1...)
  const index = parseInt(item.id.replace('effect_', ''));
  
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'imageEffect',
    index: index
  }));
}

function onEffectDrop(event) {
  removeDragOver(event);
  event.preventDefault();

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));
    if (data.type !== 'imageEffect') return;

    const fromIndex = data.index;
    const targetItem = event.target.closest('.effect-layer-item');
    if (!targetItem) return;
    
    const toIndex = parseInt(targetItem.id.replace('effect_', ''));

    if (fromIndex === toIndex) return;

    // Move in Data Array
    moveInArray(projectConfig.canvas.effects, fromIndex, toIndex);

    // Re-render UI
    renderEffectLayers();
    
    // Draw Canvas
    drawComposite();

  } catch (e) {
    console.warn("Effect Drop error", e);
  }
}


// ======================
// Text Layer Drag & Drop
// ======================

function onTextLayerDragStart(event) {
  // Store the index of the layer being dragged
  const item = event.target.parentElement.closest('.text-layer-item-container');
  const allLayers = Array.from(document.querySelectorAll('#text-layers-container > .text-layer-item-container'));
  const index = allLayers.indexOf(item);
  
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'textLayer',
    index: index
  }));
}

function onTextLayerDrop(event) {
  removeDragOver(event);
  event.preventDefault();

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));
    if (data.type !== 'textLayer') return;

    const container = document.getElementById('text-layers-container');
    const allLayers = Array.from(container.children);
    
    const fromIndex = data.index;
    const targetItem = event.target.closest('.text-layer-item-container');
    if (!targetItem) return;
    
    const toIndex = allLayers.indexOf(targetItem);

    if (fromIndex === toIndex) return;

    // Move DOM Element
    const itemToMove = allLayers[fromIndex];
    
    if (fromIndex < toIndex) {
      container.insertBefore(itemToMove, targetItem.nextSibling);
    } else {
      container.insertBefore(itemToMove, targetItem);
    }

    // Force update settings to match new DOM order
    // This will rebuild projectConfig.textLayers in the correct order
    updateTextSettings();
    
    // Optional: Re-number layers visually if you use "Layer 1, Layer 2" labels
    // You might want to implement a refreshLayerLabels() function here
    
  } catch (e) {
    console.warn("Drop error", e);
  }
}

// ======================
// Text Effect Drag & Drop
// ======================

function onTextEffectDragStart(event) {
  const item = event.target.parentElement.closest('.text-effect-layer-item');
  const layerIndex = parseInt(item.getAttribute('layerIndex'));
  const effectIndex = parseInt(item.getAttribute('effectIndex'));
  
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'textEffect',
    layerIndex: layerIndex,
    effectIndex: effectIndex
  }));
}

function onTextEffectDrop(event) {
  removeDragOver(event);
  event.preventDefault();

  try {
    console.log("Reached here 1", event);
    const data = JSON.parse(event.dataTransfer.getData('application/json'));
    if (data.type !== 'textEffect') return;
    console.log("Reached here 2", data);

    const putAtEnd = !event.target.parentElement.classList.contains('text-effect-layer-item');
    const targetItem = putAtEnd ? event.target : event.target.closest('.text-effect-layer-item');

    if (!targetItem) return;

    const targetLayerIndex   = Number(targetItem.getAttribute('layerIndex'));
    const targetEffectIndex  = putAtEnd ? projectConfig.textLayers[targetLayerIndex].effects.length : Number(targetItem.getAttribute('effectIndex'));


    console.log("Reached here 3", targetItem);

    console.log("Reached here 4", {
      data,
      targetLayerIndex,
      targetEffectIndex
    })

    // If Same Layer, we just need to move within that layer
    if(data.layerIndex == targetLayerIndex) {
      // If is the same effect, do nothing
      if(data.effectIndex === targetEffectIndex) return;
      // First we move the effect in the array
      moveInArray(projectConfig.textLayers[data.layerIndex].effects, data.effectIndex, targetEffectIndex);
      
      // Then we re-render the effect layers for that text layer only
      renderTextEffectLayersFor(data.layerIndex);
    } else {
      // Different layers: we need to move between layers
      const effectToMove = projectConfig.textLayers[data.layerIndex].effects[data.effectIndex];
      // Remove from original layer
      projectConfig.textLayers[data.layerIndex].effects.splice(data.effectIndex, 1);
      // Add to target layer
      projectConfig.textLayers[targetLayerIndex].effects.splice(targetEffectIndex, 0, effectToMove);
      // Re-render both affected layers
      renderTextEffectLayersFor(data.layerIndex);
      renderTextEffectLayersFor(targetLayerIndex);
    } 
    
    // Draw Canvas
    updateTextSettings();

  } catch (e) {
    console.warn("Text Effect Drop error", e);
  }
}





