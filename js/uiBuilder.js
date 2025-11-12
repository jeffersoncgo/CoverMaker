class UIBuilder {
  static createTextLayerPanel(textLayerManager, onUpdate) {
    const panel = document.createElement('div');
    panel.className = 'text-layers-panel';
    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0;">Text Layers</h3>
        <button class="btn-small btn-icon" id="addTextLayer" title="Add Text Layer">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
      <div id="textLayersList"></div>
    `;

    const addBtn = panel.querySelector('#addTextLayer');
    addBtn.addEventListener('click', () => {
      textLayerManager.addLayer();
      this.updateTextLayersList(textLayerManager, onUpdate);
      onUpdate();
    });

    this.updateTextLayersList(textLayerManager, onUpdate);

    return panel;
  }

  static updateTextLayersList(textLayerManager, onUpdate) {
    const list = document.getElementById('textLayersList');
    if (!list) return;

    list.innerHTML = '';

    textLayerManager.layers.forEach((layer, index) => {
      const item = document.createElement('div');
      item.className = `text-layer-item ${layer.id === textLayerManager.activeLayerId ? 'active' : ''}`;
      item.innerHTML = `
        <div>
          <i class="fa-solid ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}" style="margin-right: 0.5rem;"></i>
          <span>${layer.text || 'Empty Layer'}</span>
        </div>
        <div class="text-layer-controls">
          <i class="fa-solid fa-arrow-up" title="Move Up"></i>
          <i class="fa-solid fa-arrow-down" title="Move Down"></i>
          <i class="fa-solid fa-copy" title="Duplicate"></i>
          <i class="fa-solid fa-trash" title="Delete"></i>
        </div>
      `;

      item.querySelector('.fa-eye, .fa-eye-slash').addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        this.updateTextLayersList(textLayerManager, onUpdate);
        onUpdate();
      });

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.text-layer-controls')) {
          textLayerManager.setActiveLayer(layer.id);
          this.updateTextLayersList(textLayerManager, onUpdate);
          onUpdate();
        }
      });

      const controls = item.querySelectorAll('.text-layer-controls i');
      controls[0].addEventListener('click', (e) => {
        e.stopPropagation();
        textLayerManager.moveLayer(layer.id, 'up');
        this.updateTextLayersList(textLayerManager, onUpdate);
        onUpdate();
      });

      controls[1].addEventListener('click', (e) => {
        e.stopPropagation();
        textLayerManager.moveLayer(layer.id, 'down');
        this.updateTextLayersList(textLayerManager, onUpdate);
        onUpdate();
      });

      controls[2].addEventListener('click', (e) => {
        e.stopPropagation();
        textLayerManager.duplicateLayer(layer.id);
        this.updateTextLayersList(textLayerManager, onUpdate);
        onUpdate();
      });

      controls[3].addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this text layer?')) {
          textLayerManager.removeLayer(layer.id);
          this.updateTextLayersList(textLayerManager, onUpdate);
          onUpdate();
        }
      });

      list.appendChild(item);
    });
  }

  static createTextEffectsPanel(layer, onUpdate) {
    if (!layer) return null;

    const panel = document.createElement('div');
    panel.className = 'settings scroll-container';
    panel.style.maxHeight = '600px';
    panel.style.overflowY = 'auto';

    panel.innerHTML = `
      <div class="field">
        <label>Text Content</label>
        <input type="text" id="layerText" value="${layer.text}" placeholder="Enter text...">
      </div>

      <div class="field">
        <label>Position</label>
        <div class="slider-row">
          <label>X:</label>
          <input type="range" id="textPosX" min="0" max="1" step="0.01" value="${layer.position.x}">
          <input type="number" id="textPosXNum" min="0" max="1" step="0.01" value="${layer.position.x}">
        </div>
        <div class="slider-row">
          <label>Y:</label>
          <input type="range" id="textPosY" min="0" max="1" step="0.01" value="${layer.position.y}">
          <input type="number" id="textPosYNum" min="0" max="1" step="0.01" value="${layer.position.y}">
        </div>
      </div>

      <div class="field">
        <label>Font Family</label>
        <select id="layerFontFamily"></select>
      </div>

      <div class="slider-row">
        <label>Font Size:</label>
        <input type="range" id="layerFontSize" min="10" max="500" value="${layer.font.size}">
        <input type="number" id="layerFontSizeNum" min="10" max="500" value="${layer.font.size}">
      </div>

      <div class="field">
        <label>Font Weight</label>
        <select id="layerFontWeight">
          <option value="normal" ${layer.font.weight === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="bold" ${layer.font.weight === 'bold' ? 'selected' : ''}>Bold</option>
          <option value="lighter" ${layer.font.weight === 'lighter' ? 'selected' : ''}>Lighter</option>
          <option value="bolder" ${layer.font.weight === 'bolder' ? 'selected' : ''}>Bolder</option>
        </select>
      </div>

      <div class="field">
        <label>Font Style</label>
        <select id="layerFontStyle">
          <option value="normal" ${layer.font.style === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="italic" ${layer.font.style === 'italic' ? 'selected' : ''}>Italic</option>
          <option value="oblique" ${layer.font.style === 'oblique' ? 'selected' : ''}>Oblique</option>
        </select>
      </div>

      <div class="toggle-section">
        <div class="toggle-header" data-toggle="colorSettings">
          <i class="fa-solid fa-chevron-right"></i>
          <span>Color & Fill</span>
        </div>
        <div class="toggle-content" id="colorSettings">
          <div class="field">
            <label>Color Type</label>
            <select id="layerColorType">
              <option value="solid" ${layer.color.type === 'solid' ? 'selected' : ''}>Solid</option>
              <option value="gradient" ${layer.color.type === 'gradient' ? 'selected' : ''}>Gradient</option>
            </select>
          </div>
          <div id="solidColorControls">
            <div class="color-picker-group">
              <label>Color:</label>
              <input type="color" id="layerSolidColor" value="${layer.color.solid}">
            </div>
          </div>
          <div id="gradientControls" style="display: none;">
            <div class="field">
              <label>Gradient Type</label>
              <select id="layerGradientType">
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
              </select>
            </div>
            <div class="slider-row">
              <label>Angle:</label>
              <input type="range" id="layerGradientAngle" min="0" max="360" value="${layer.color.gradient.angle}">
              <input type="number" id="layerGradientAngleNum" min="0" max="360" value="${layer.color.gradient.angle}">
            </div>
            <div class="gradient-stops" id="gradientStops"></div>
          </div>
        </div>
      </div>

      <div class="toggle-section">
        <div class="toggle-header" data-toggle="strokeSettings">
          <i class="fa-solid fa-chevron-right"></i>
          <input type="checkbox" id="layerStrokeEnabled" ${layer.stroke.enabled ? 'checked' : ''} style="margin-right: 0.5rem;">
          <span>Stroke / Outline</span>
        </div>
        <div class="toggle-content" id="strokeSettings">
          <div class="slider-row">
            <label>Width:</label>
            <input type="range" id="layerStrokeWidth" min="0" max="20" value="${layer.stroke.width}">
            <input type="number" id="layerStrokeWidthNum" min="0" max="20" value="${layer.stroke.width}">
          </div>
          <div class="color-picker-group">
            <label>Color:</label>
            <input type="color" id="layerStrokeColor" value="${layer.stroke.color}">
          </div>
        </div>
      </div>

      <div class="toggle-section">
        <div class="toggle-header" data-toggle="shadowSettings">
          <i class="fa-solid fa-chevron-right"></i>
          <input type="checkbox" id="layerShadowEnabled" ${layer.shadow.enabled ? 'checked' : ''} style="margin-right: 0.5rem;">
          <span>Shadow</span>
        </div>
        <div class="toggle-content" id="shadowSettings">
          <div class="slider-row">
            <label>Offset X:</label>
            <input type="range" id="layerShadowX" min="-50" max="50" value="${layer.shadow.offsetX}">
            <input type="number" id="layerShadowXNum" min="-50" max="50" value="${layer.shadow.offsetX}">
          </div>
          <div class="slider-row">
            <label>Offset Y:</label>
            <input type="range" id="layerShadowY" min="-50" max="50" value="${layer.shadow.offsetY}">
            <input type="number" id="layerShadowYNum" min="-50" max="50" value="${layer.shadow.offsetY}">
          </div>
          <div class="slider-row">
            <label>Blur:</label>
            <input type="range" id="layerShadowBlur" min="0" max="50" value="${layer.shadow.blur}">
            <input type="number" id="layerShadowBlurNum" min="0" max="50" value="${layer.shadow.blur}">
          </div>
          <div class="color-picker-group">
            <label>Color:</label>
            <input type="color" id="layerShadowColor" value="${this.rgbaToHex(layer.shadow.color)}">
          </div>
        </div>
      </div>

      <div class="toggle-section">
        <div class="toggle-header" data-toggle="3dSettings">
          <i class="fa-solid fa-chevron-right"></i>
          <input type="checkbox" id="layer3DEnabled" ${layer.effects3d.enabled ? 'checked' : ''} style="margin-right: 0.5rem;">
          <span>3D Effect</span>
        </div>
        <div class="toggle-content" id="3dSettings">
          <div class="slider-row">
            <label>Depth:</label>
            <input type="range" id="layer3DDepth" min="0" max="50" value="${layer.effects3d.depth}">
            <input type="number" id="layer3DDepthNum" min="0" max="50" value="${layer.effects3d.depth}">
          </div>
          <div class="slider-row">
            <label>Angle:</label>
            <input type="range" id="layer3DAngle" min="0" max="360" value="${layer.effects3d.angle}">
            <input type="number" id="layer3DAngleNum" min="0" max="360" value="${layer.effects3d.angle}">
          </div>
          <div class="color-picker-group">
            <label>Color:</label>
            <input type="color" id="layer3DColor" value="${layer.effects3d.color}">
          </div>
        </div>
      </div>

      <div class="toggle-section">
        <div class="toggle-header" data-toggle="glowSettings">
          <i class="fa-solid fa-chevron-right"></i>
          <input type="checkbox" id="layerGlowEnabled" ${layer.glow.enabled ? 'checked' : ''} style="margin-right: 0.5rem;">
          <span>Glow</span>
        </div>
        <div class="toggle-content" id="glowSettings">
          <div class="slider-row">
            <label>Blur:</label>
            <input type="range" id="layerGlowBlur" min="0" max="50" value="${layer.glow.blur}">
            <input type="number" id="layerGlowBlurNum" min="0" max="50" value="${layer.glow.blur}">
          </div>
          <div class="slider-row">
            <label>Intensity:</label>
            <input type="range" id="layerGlowIntensity" min="0" max="3" step="0.1" value="${layer.glow.intensity}">
            <input type="number" id="layerGlowIntensityNum" min="0" max="3" step="0.1" value="${layer.glow.intensity}">
          </div>
          <div class="color-picker-group">
            <label>Color:</label>
            <input type="color" id="layerGlowColor" value="${layer.glow.color}">
          </div>
        </div>
      </div>

      <div class="toggle-section">
        <div class="toggle-header" data-toggle="transformSettings">
          <i class="fa-solid fa-chevron-right"></i>
          <span>Transform</span>
        </div>
        <div class="toggle-content" id="transformSettings">
          <div class="slider-row">
            <label>Rotation:</label>
            <input type="range" id="layerRotation" min="-180" max="180" value="${layer.transform.rotation}">
            <input type="number" id="layerRotationNum" min="-180" max="180" value="${layer.transform.rotation}">
          </div>
          <div class="slider-row">
            <label>Scale X:</label>
            <input type="range" id="layerScaleX" min="0.1" max="3" step="0.1" value="${layer.transform.scaleX}">
            <input type="number" id="layerScaleXNum" min="0.1" max="3" step="0.1" value="${layer.transform.scaleX}">
          </div>
          <div class="slider-row">
            <label>Scale Y:</label>
            <input type="range" id="layerScaleY" min="0.1" max="3" step="0.1" value="${layer.transform.scaleY}">
            <input type="number" id="layerScaleYNum" min="0.1" max="3" step="0.1" value="${layer.transform.scaleY}">
          </div>
          <div class="slider-row">
            <label>Skew X:</label>
            <input type="range" id="layerSkewX" min="-45" max="45" value="${layer.transform.skewX}">
            <input type="number" id="layerSkewXNum" min="-45" max="45" value="${layer.transform.skewX}">
          </div>
          <div class="slider-row">
            <label>Skew Y:</label>
            <input type="range" id="layerSkewY" min="-45" max="45" value="${layer.transform.skewY}">
            <input type="number" id="layerSkewYNum" min="-45" max="45" value="${layer.transform.skewY}">
          </div>
        </div>
      </div>

      <div class="slider-row">
        <label>Opacity:</label>
        <input type="range" id="layerOpacity" min="0" max="1" step="0.01" value="${layer.opacity}">
        <input type="number" id="layerOpacityNum" min="0" max="1" step="0.01" value="${layer.opacity}">
      </div>

      <div class="field">
        <label>Blend Mode</label>
        <select id="layerBlendMode">
          <option value="normal">Normal</option>
          <option value="multiply">Multiply</option>
          <option value="screen">Screen</option>
          <option value="overlay">Overlay</option>
          <option value="darken">Darken</option>
          <option value="lighten">Lighten</option>
          <option value="color-dodge">Color Dodge</option>
          <option value="color-burn">Color Burn</option>
        </select>
      </div>
    `;

    this.attachTextEffectsListeners(panel, layer, onUpdate);

    return panel;
  }

  static attachTextEffectsListeners(panel, layer, onUpdate) {
    const syncSliders = (rangeId, numberId, prop, nested = null) => {
      const range = panel.querySelector(`#${rangeId}`);
      const number = panel.querySelector(`#${numberId}`);

      if (!range || !number) return;

      const update = (value) => {
        if (nested) {
          layer[nested][prop] = parseFloat(value);
        } else {
          layer[prop] = parseFloat(value);
        }
        onUpdate();
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

    panel.querySelector('#layerText').addEventListener('input', (e) => {
      layer.text = e.target.value;
      if (window.textLayerManager) {
        UIBuilder.updateTextLayersList(window.textLayerManager, onUpdate);
      }
      onUpdate();
    });

    syncSliders('textPosX', 'textPosXNum', 'x', 'position');
    syncSliders('textPosY', 'textPosYNum', 'y', 'position');
    syncSliders('layerFontSize', 'layerFontSizeNum', 'size', 'font');
    syncSliders('layerStrokeWidth', 'layerStrokeWidthNum', 'width', 'stroke');
    syncSliders('layerShadowX', 'layerShadowXNum', 'offsetX', 'shadow');
    syncSliders('layerShadowY', 'layerShadowYNum', 'offsetY', 'shadow');
    syncSliders('layerShadowBlur', 'layerShadowBlurNum', 'blur', 'shadow');
    syncSliders('layer3DDepth', 'layer3DDepthNum', 'depth', 'effects3d');
    syncSliders('layer3DAngle', 'layer3DAngleNum', 'angle', 'effects3d');
    syncSliders('layerGlowBlur', 'layerGlowBlurNum', 'blur', 'glow');
    syncSliders('layerGlowIntensity', 'layerGlowIntensityNum', 'intensity', 'glow');
    syncSliders('layerRotation', 'layerRotationNum', 'rotation', 'transform');
    syncSliders('layerScaleX', 'layerScaleXNum', 'scaleX', 'transform');
    syncSliders('layerScaleY', 'layerScaleYNum', 'scaleY', 'transform');
    syncSliders('layerSkewX', 'layerSkewXNum', 'skewX', 'transform');
    syncSliders('layerSkewY', 'layerSkewYNum', 'skewY', 'transform');
    syncSliders('layerOpacity', 'layerOpacityNum', 'opacity');
    syncSliders('layerGradientAngle', 'layerGradientAngleNum', 'angle', null);

    const toggleHeaders = panel.querySelectorAll('.toggle-header');
    toggleHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;

        const toggleId = header.dataset.toggle;
        const content = panel.querySelector(`#${toggleId}`);
        const icon = header.querySelector('i.fa-chevron-right, i.fa-chevron-down');

        if (content) {
          content.classList.toggle('active');
          if (icon) {
            icon.classList.toggle('fa-chevron-right');
            icon.classList.toggle('fa-chevron-down');
          }
        }
      });
    });

    ['layerFontFamily', 'layerFontWeight', 'layerFontStyle', 'layerBlendMode', 'layerColorType', 'layerGradientType'].forEach(id => {
      const el = panel.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('change', (e) => {
          if (id === 'layerFontFamily') layer.font.family = e.target.value;
          if (id === 'layerFontWeight') layer.font.weight = e.target.value;
          if (id === 'layerFontStyle') layer.font.style = e.target.value;
          if (id === 'layerBlendMode') layer.blendMode = e.target.value;
          if (id === 'layerColorType') {
            layer.color.type = e.target.value;
            panel.querySelector('#solidColorControls').style.display = e.target.value === 'solid' ? 'block' : 'none';
            panel.querySelector('#gradientControls').style.display = e.target.value === 'gradient' ? 'block' : 'none';
          }
          if (id === 'layerGradientType') layer.color.gradient.type = e.target.value;
          onUpdate();
        });
      }
    });

    ['layerStrokeEnabled', 'layerShadowEnabled', 'layer3DEnabled', 'layerGlowEnabled'].forEach(id => {
      const el = panel.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('change', (e) => {
          if (id === 'layerStrokeEnabled') layer.stroke.enabled = e.target.checked;
          if (id === 'layerShadowEnabled') layer.shadow.enabled = e.target.checked;
          if (id === 'layer3DEnabled') layer.effects3d.enabled = e.target.checked;
          if (id === 'layerGlowEnabled') layer.glow.enabled = e.target.checked;
          onUpdate();
        });
      }
    });

    ['layerSolidColor', 'layerStrokeColor', 'layerShadowColor', 'layer3DColor', 'layerGlowColor'].forEach(id => {
      const el = panel.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('input', (e) => {
          if (id === 'layerSolidColor') layer.color.solid = e.target.value;
          if (id === 'layerStrokeColor') layer.stroke.color = e.target.value;
          if (id === 'layerShadowColor') layer.shadow.color = e.target.value;
          if (id === 'layer3DColor') layer.effects3d.color = e.target.value;
          if (id === 'layerGlowColor') layer.glow.color = e.target.value;
          onUpdate();
        });
      }
    });
  }

  static rgbaToHex(rgba) {
    if (!rgba || typeof rgba !== 'string') return '#000000';
    if (rgba.startsWith('#')) return rgba;

    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return '#000000';

    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIBuilder };
}
