window.textLayerManager = new TextLayerManager();
window.textEffectsRenderer = new TextEffectsRenderer(ctx);
window.imageEffectsRenderer = new ImageEffectsRenderer();
window.canvasBackground = new CanvasBackground();
window.layoutManager = new LayoutManager();
window.presetManager = new PresetManager();

const imageSlots = [];
let selectedSlotIndex = null;

function initializeEnhancedFeatures() {
  window.Tabs['textLayers'] = {
    tab: document.querySelector('#textLayersTab'),
    content: document.querySelector('#textLayersContent')
  };
  window.Tabs['imageEffects'] = {
    tab: document.querySelector('#imageEffectsTab'),
    content: document.querySelector('#imageEffectsContent')
  };

  setupTextLayersUI();
  setupImageEffectsUI();
  setupCanvasBackgroundControls();
  setupLayoutControls();

  const firstLayer = textLayerManager.addLayer('Collection Title');
  firstLayer.font.size = 150;
  firstLayer.position = { x: 0.5, y: 0.5 };

  drawEnhancedComposite();
}

function setupTextLayersUI() {
  const panel = document.getElementById('textLayersPanel');
  if (!panel) return;

  panel.innerHTML = '';
  panel.appendChild(UIBuilder.createTextLayerPanel(textLayerManager, drawEnhancedComposite));

  const textPresetsGrid = document.getElementById('textPresetsGrid');
  if (textPresetsGrid) {
    textPresetsGrid.innerHTML = '';
    textPresetsGrid.appendChild(presetManager.createPresetUI('text', (presetName) => {
      const activeLayer = textLayerManager.getActiveLayer();
      if (activeLayer) {
        presetManager.applyTextPreset(activeLayer, presetName);
        updateTextEffectsPanel();
        drawEnhancedComposite();
      }
    }));
  }

  updateTextEffectsPanel();
}

function updateTextEffectsPanel() {
  const panel = document.getElementById('textEffectsPanel');
  if (!panel) return;

  const activeLayer = textLayerManager.getActiveLayer();
  panel.innerHTML = '';

  if (activeLayer) {
    const effectsPanel = UIBuilder.createTextEffectsPanel(activeLayer, drawEnhancedComposite);
    if (effectsPanel) {
      panel.appendChild(effectsPanel);

      const fontSelect = effectsPanel.querySelector('#layerFontFamily');
      if (fontSelect && window.fontSelectElement) {
        fontSelect.innerHTML = window.fontSelectElement.innerHTML;
        fontSelect.value = activeLayer.font.family;
      }
    }
  } else {
    panel.innerHTML = '<p style="padding: 1rem; text-align: center; color: #9ca3af;">No text layer selected</p>';
  }
}

function setupImageEffectsUI() {
  const imagePresetsGrid = document.getElementById('imagePresetsGrid');
  if (imagePresetsGrid) {
    imagePresetsGrid.innerHTML = '';
    imagePresetsGrid.appendChild(presetManager.createPresetUI('image', (presetName) => {
      if (selectedSlotIndex !== null && imageSlots[selectedSlotIndex]) {
        presetManager.applyImagePreset(imageSlots[selectedSlotIndex], presetName);
        updateImageEffectsPanel();
        drawEnhancedComposite();
      }
    }));
  }

  updateImageEffectsPanel();
}

function updateImageEffectsPanel() {
  const controls = document.getElementById('imageEffectsControls');
  const info = document.getElementById('selectedSlotInfo');

  if (!controls || !info) return;

  if (selectedSlotIndex === null || !imageSlots[selectedSlotIndex]) {
    info.innerHTML = '<p>Select an image slot to edit its effects</p>';
    controls.innerHTML = '';
    return;
  }

  const slot = imageSlots[selectedSlotIndex];
  info.innerHTML = `<p><strong>Editing Slot ${selectedSlotIndex + 1}</strong></p>`;

  controls.innerHTML = `
    <div class="settings scroll-container" style="max-height: 600px;">
      <h4>Transform</h4>
      <div class="slider-row">
        <label>Rotation:</label>
        <input type="range" id="slotRotation" min="-180" max="180" value="${slot.transform.rotation}">
        <input type="number" id="slotRotationNum" min="-180" max="180" value="${slot.transform.rotation}">
      </div>
      <div class="slider-row">
        <label>Scale X:</label>
        <input type="range" id="slotScaleX" min="0.1" max="3" step="0.1" value="${slot.transform.scaleX}">
        <input type="number" id="slotScaleXNum" min="0.1" max="3" step="0.1" value="${slot.transform.scaleX}">
      </div>
      <div class="slider-row">
        <label>Scale Y:</label>
        <input type="range" id="slotScaleY" min="0.1" max="3" step="0.1" value="${slot.transform.scaleY}">
        <input type="number" id="slotScaleYNum" min="0.1" max="3" step="0.1" value="${slot.transform.scaleY}">
      </div>
      <div class="slider-row">
        <label>Position X:</label>
        <input type="range" id="slotPosX" min="-200" max="200" value="${slot.transform.x}">
        <input type="number" id="slotPosXNum" min="-200" max="200" value="${slot.transform.x}">
      </div>
      <div class="slider-row">
        <label>Position Y:</label>
        <input type="range" id="slotPosY" min="-200" max="200" value="${slot.transform.y}">
        <input type="number" id="slotPosYNum" min="-200" max="200" value="${slot.transform.y}">
      </div>
      <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <label><input type="checkbox" id="slotFlipX" ${slot.transform.flipX ? 'checked' : ''}> Flip X</label>
        <label><input type="checkbox" id="slotFlipY" ${slot.transform.flipY ? 'checked' : ''}> Flip Y</label>
      </div>

      <h4>Filters</h4>
      <div class="slider-row">
        <label>Brightness:</label>
        <input type="range" id="slotBrightness" min="0" max="200" value="${slot.filters.brightness}">
        <input type="number" id="slotBrightnessNum" min="0" max="200" value="${slot.filters.brightness}">
      </div>
      <div class="slider-row">
        <label>Contrast:</label>
        <input type="range" id="slotContrast" min="0" max="200" value="${slot.filters.contrast}">
        <input type="number" id="slotContrastNum" min="0" max="200" value="${slot.filters.contrast}">
      </div>
      <div class="slider-row">
        <label>Saturation:</label>
        <input type="range" id="slotSaturation" min="0" max="200" value="${slot.filters.saturation}">
        <input type="number" id="slotSaturationNum" min="0" max="200" value="${slot.filters.saturation}">
      </div>
      <div class="slider-row">
        <label>Hue:</label>
        <input type="range" id="slotHue" min="0" max="360" value="${slot.filters.hue}">
        <input type="number" id="slotHueNum" min="0" max="360" value="${slot.filters.hue}">
      </div>
      <div class="slider-row">
        <label>Blur:</label>
        <input type="range" id="slotBlur" min="0" max="20" value="${slot.filters.blur}">
        <input type="number" id="slotBlurNum" min="0" max="20" value="${slot.filters.blur}">
      </div>
      <div class="slider-row">
        <label>Grayscale:</label>
        <input type="range" id="slotGrayscale" min="0" max="100" value="${slot.filters.grayscale}">
        <input type="number" id="slotGrayscaleNum" min="0" max="100" value="${slot.filters.grayscale}">
      </div>
      <div class="slider-row">
        <label>Sepia:</label>
        <input type="range" id="slotSepia" min="0" max="100" value="${slot.filters.sepia}">
        <input type="number" id="slotSepiaNum" min="0" max="100" value="${slot.filters.sepia}">
      </div>
      <div class="slider-row">
        <label>Opacity:</label>
        <input type="range" id="slotOpacity" min="0" max="100" value="${slot.filters.opacity}">
        <input type="number" id="slotOpacityNum" min="0" max="100" value="${slot.filters.opacity}">
      </div>

      <div class="btn-group">
        <button class="btn-small" onclick="resetSlotEffects()">Reset All</button>
      </div>
    </div>
  `;

  attachImageEffectsListeners(slot);
}

function attachImageEffectsListeners(slot) {
  const syncSliders = (rangeId, numberId, category, prop) => {
    const range = document.getElementById(rangeId);
    const number = document.getElementById(numberId);

    if (!range || !number) return;

    const update = (value) => {
      slot[category][prop] = parseFloat(value);
      drawEnhancedComposite();
    };

    range.addEventListener('input', (e) => {
      number.value = e.target.value;
      update(e.target.value);
    });

    number.addEventListener('input', (e) => {
      range.value = e.target.value;
      update(e.target.value);
    });
  };

  syncSliders('slotRotation', 'slotRotationNum', 'transform', 'rotation');
  syncSliders('slotScaleX', 'slotScaleXNum', 'transform', 'scaleX');
  syncSliders('slotScaleY', 'slotScaleYNum', 'transform', 'scaleY');
  syncSliders('slotPosX', 'slotPosXNum', 'transform', 'x');
  syncSliders('slotPosY', 'slotPosYNum', 'transform', 'y');
  syncSliders('slotBrightness', 'slotBrightnessNum', 'filters', 'brightness');
  syncSliders('slotContrast', 'slotContrastNum', 'filters', 'contrast');
  syncSliders('slotSaturation', 'slotSaturationNum', 'filters', 'saturation');
  syncSliders('slotHue', 'slotHueNum', 'filters', 'hue');
  syncSliders('slotBlur', 'slotBlurNum', 'filters', 'blur');
  syncSliders('slotGrayscale', 'slotGrayscaleNum', 'filters', 'grayscale');
  syncSliders('slotSepia', 'slotSepiaNum', 'filters', 'sepia');
  syncSliders('slotOpacity', 'slotOpacityNum', 'filters', 'opacity');

  const flipX = document.getElementById('slotFlipX');
  const flipY = document.getElementById('slotFlipY');

  if (flipX) flipX.addEventListener('change', (e) => {
    slot.transform.flipX = e.target.checked;
    drawEnhancedComposite();
  });

  if (flipY) flipY.addEventListener('change', (e) => {
    slot.transform.flipY = e.target.checked;
    drawEnhancedComposite();
  });
}

function setupCanvasBackgroundControls() {
  const typeSelect = document.getElementById('canvasBgType');
  const controlsDiv = document.getElementById('canvasBgControls');

  if (!typeSelect || !controlsDiv) return;

  const updateControls = () => {
    const type = typeSelect.value;
    canvasBackground.type = type;

    let html = '';

    if (type === 'solid') {
      html = `
        <div class="color-picker-group">
          <label>Color:</label>
          <input type="color" id="bgSolidColor" value="${canvasBackground.solid}">
        </div>
      `;
    } else if (type === 'gradient') {
      html = `
        <div class="field">
          <label>Gradient Type:</label>
          <select id="bgGradientType">
            <option value="linear" ${canvasBackground.gradient.type === 'linear' ? 'selected' : ''}>Linear</option>
            <option value="radial" ${canvasBackground.gradient.type === 'radial' ? 'selected' : ''}>Radial</option>
          </select>
        </div>
        <div class="slider-row">
          <label>Angle:</label>
          <input type="range" id="bgGradientAngle" min="0" max="360" value="${canvasBackground.gradient.angle}">
          <input type="number" id="bgGradientAngleNum" min="0" max="360" value="${canvasBackground.gradient.angle}">
        </div>
      `;
    } else if (type === 'pattern') {
      html = `
        <div class="field">
          <label>Pattern Type:</label>
          <select id="bgPatternType">
            <option value="none">None</option>
            <option value="checkerboard">Checkerboard</option>
            <option value="stripes-horizontal">Horizontal Stripes</option>
            <option value="stripes-vertical">Vertical Stripes</option>
            <option value="dots">Dots</option>
          </select>
        </div>
        <div class="slider-row">
          <label>Size:</label>
          <input type="range" id="bgPatternSize" min="5" max="100" value="${canvasBackground.pattern.size}">
          <input type="number" id="bgPatternSizeNum" min="5" max="100" value="${canvasBackground.pattern.size}">
        </div>
        <div class="color-picker-group">
          <label>Color 1:</label>
          <input type="color" id="bgPatternColor1" value="${canvasBackground.pattern.color1}">
        </div>
        <div class="color-picker-group">
          <label>Color 2:</label>
          <input type="color" id="bgPatternColor2" value="${canvasBackground.pattern.color2}">
        </div>
      `;
    }

    controlsDiv.innerHTML = html;
    attachBackgroundListeners();
    drawEnhancedComposite();
  };

  typeSelect.addEventListener('change', updateControls);
  updateControls();
}

function attachBackgroundListeners() {
  const solidColor = document.getElementById('bgSolidColor');
  const gradientType = document.getElementById('bgGradientType');
  const gradientAngle = document.getElementById('bgGradientAngle');
  const gradientAngleNum = document.getElementById('bgGradientAngleNum');
  const patternType = document.getElementById('bgPatternType');
  const patternSize = document.getElementById('bgPatternSize');
  const patternSizeNum = document.getElementById('bgPatternSizeNum');
  const patternColor1 = document.getElementById('bgPatternColor1');
  const patternColor2 = document.getElementById('bgPatternColor2');

  if (solidColor) {
    solidColor.addEventListener('input', (e) => {
      canvasBackground.solid = e.target.value;
      drawEnhancedComposite();
    });
  }

  if (gradientType) {
    gradientType.addEventListener('change', (e) => {
      canvasBackground.gradient.type = e.target.value;
      drawEnhancedComposite();
    });
  }

  if (gradientAngle && gradientAngleNum) {
    gradientAngle.addEventListener('input', (e) => {
      gradientAngleNum.value = e.target.value;
      canvasBackground.gradient.angle = parseFloat(e.target.value);
      drawEnhancedComposite();
    });
    gradientAngleNum.addEventListener('input', (e) => {
      gradientAngle.value = e.target.value;
      canvasBackground.gradient.angle = parseFloat(e.target.value);
      drawEnhancedComposite();
    });
  }

  if (patternType) {
    patternType.addEventListener('change', (e) => {
      canvasBackground.pattern.type = e.target.value;
      drawEnhancedComposite();
    });
  }

  if (patternSize && patternSizeNum) {
    patternSize.addEventListener('input', (e) => {
      patternSizeNum.value = e.target.value;
      canvasBackground.pattern.size = parseFloat(e.target.value);
      drawEnhancedComposite();
    });
    patternSizeNum.addEventListener('input', (e) => {
      patternSize.value = e.target.value;
      canvasBackground.pattern.size = parseFloat(e.target.value);
      drawEnhancedComposite();
    });
  }

  if (patternColor1) {
    patternColor1.addEventListener('input', (e) => {
      canvasBackground.pattern.color1 = e.target.value;
      drawEnhancedComposite();
    });
  }

  if (patternColor2) {
    patternColor2.addEventListener('input', (e) => {
      canvasBackground.pattern.color2 = e.target.value;
      drawEnhancedComposite();
    });
  }
}

function setupLayoutControls() {
  const typeSelect = document.getElementById('typeSelect');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      layoutManager.setLayout(e.target.value);
      drawEnhancedComposite();
    });
  }
}

function enhancedAddImageSlot() {
  const slot = new ImageSlot(imageSlots.length);
  imageSlots.push(slot);
  slotsImages.push(null);

  const clone = template.content.cloneNode(true);
  const slotElement = clone.querySelector('.slot');

  slotElement.addEventListener('click', () => {
    selectedSlotIndex = imageSlots.indexOf(slot);
    updateImageEffectsPanel();
  });

  imageSlots.querySelector('.slots')?.appendChild(clone);
  drawEnhancedComposite();
}

function drawEnhancedComposite() {
  composite.ctx.clearRect(0, 0, composite.canvas.width, composite.canvas.height);

  canvasBackground.render(composite.ctx, composite.canvas.width, composite.canvas.height);

  const positions = layoutManager.calculatePositions(
    imageSlots,
    composite.canvas.width,
    composite.canvas.height,
    Setup.Settings.canvas
  );

  imageSlots.forEach((slot, i) => {
    const img = slotsImages[i];
    if (!img || !positions[i]) return;

    const pos = positions[i];
    imageEffectsRenderer.drawImageWithEffects(
      composite.ctx,
      img,
      slot,
      pos.dx,
      pos.dy,
      pos.dWidth,
      pos.dHeight
    );
  });

  textLayerManager.layers.forEach(layer => {
    textEffectsRenderer.renderLayer(layer, composite.canvas.width, composite.canvas.height);
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(composite.canvas, 0, 0);
}

function resetSlotEffects() {
  if (selectedSlotIndex !== null && imageSlots[selectedSlotIndex]) {
    imageSlots[selectedSlotIndex].reset();
    updateImageEffectsPanel();
    drawEnhancedComposite();
  }
}

if (typeof window !== 'undefined') {
  window.initializeEnhancedFeatures = initializeEnhancedFeatures;
  window.enhancedAddImageSlot = enhancedAddImageSlot;
  window.drawEnhancedComposite = drawEnhancedComposite;
  window.updateTextEffectsPanel = updateTextEffectsPanel;
  window.resetSlotEffects = resetSlotEffects;
}
