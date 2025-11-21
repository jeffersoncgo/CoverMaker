class PresetManager {
  constructor() {
    this.presets = {
      text: {
        'Classic': {
          color: { type: 'solid', solid: '#ffffff' },
          stroke: { enabled: true, width: 3, color: '#000000' },
          shadow: { enabled: true, offsetX: 2, offsetY: 2, blur: 4, color: 'rgba(0,0,0,0.5)' },
          effects3d: { enabled: false },
          glow: { enabled: false }
        },
        'Neon': {
          color: { type: 'solid', solid: '#00ffff' },
          stroke: { enabled: false },
          shadow: { enabled: false },
          effects3d: { enabled: false },
          glow: { enabled: true, blur: 20, color: '#00ffff', intensity: 2 }
        },
        'Gold 3D': {
          color: {
            type: 'gradient',
            gradient: {
              type: 'linear',
              angle: 90,
              stops: [
                { offset: 0, color: '#FFD700' },
                { offset: 0.5, color: '#FFA500' },
                { offset: 1, color: '#FF8C00' }
              ]
            }
          },
          stroke: { enabled: true, width: 2, color: '#8B4513' },
          shadow: { enabled: true, offsetX: 3, offsetY: 3, blur: 5, color: 'rgba(0,0,0,0.6)' },
          effects3d: { enabled: true, depth: 15, angle: 135, color: '#CD7F32', shadowColor: 'rgba(0,0,0,0.4)' },
          glow: { enabled: false }
        },
        'Chrome': {
          color: {
            type: 'gradient',
            gradient: {
              type: 'linear',
              angle: 180,
              stops: [
                { offset: 0, color: '#e0e0e0' },
                { offset: 0.3, color: '#ffffff' },
                { offset: 0.5, color: '#c0c0c0' },
                { offset: 0.7, color: '#f0f0f0' },
                { offset: 1, color: '#d0d0d0' }
              ]
            }
          },
          stroke: { enabled: true, width: 2, color: '#606060' },
          shadow: { enabled: true, offsetX: 0, offsetY: 0, blur: 10, color: 'rgba(255,255,255,0.8)' },
          effects3d: { enabled: false },
          glow: { enabled: false }
        },
        'Fire': {
          color: {
            type: 'gradient',
            gradient: {
              type: 'linear',
              angle: 270,
              stops: [
                { offset: 0, color: '#ffff00' },
                { offset: 0.5, color: '#ff4500' },
                { offset: 1, color: '#8b0000' }
              ]
            }
          },
          stroke: { enabled: true, width: 2, color: '#000000' },
          shadow: { enabled: true, offsetX: 0, offsetY: 0, blur: 20, color: 'rgba(255,69,0,0.8)' },
          effects3d: { enabled: false },
          glow: { enabled: true, blur: 15, color: '#ff4500', intensity: 1.5 }
        },
        'Ice': {
          color: {
            type: 'gradient',
            gradient: {
              type: 'radial',
              angle: 0,
              stops: [
                { offset: 0, color: '#ffffff' },
                { offset: 0.5, color: '#e0f7ff' },
                { offset: 1, color: '#87ceeb' }
              ]
            }
          },
          stroke: { enabled: true, width: 2, color: '#4682b4' },
          shadow: { enabled: true, offsetX: 0, offsetY: 0, blur: 15, color: 'rgba(135,206,235,0.6)' },
          effects3d: { enabled: false },
          glow: { enabled: true, blur: 10, color: '#b0e0e6', intensity: 1 }
        },
        'Retro': {
          color: {
            type: 'gradient',
            gradient: {
              type: 'linear',
              angle: 45,
              stops: [
                { offset: 0, color: '#ff00ff' },
                { offset: 0.5, color: '#00ffff' },
                { offset: 1, color: '#ffff00' }
              ]
            }
          },
          stroke: { enabled: true, width: 5, color: '#000000' },
          shadow: { enabled: true, offsetX: 5, offsetY: 5, blur: 0, color: '#ff00ff' },
          effects3d: { enabled: false },
          glow: { enabled: false }
        },
        'Comic': {
          color: { type: 'solid', solid: '#ffff00' },
          stroke: { enabled: true, width: 8, color: '#000000' },
          shadow: { enabled: false },
          effects3d: { enabled: false },
          glow: { enabled: false }
        }
      },
      image: {
        'Normal': {
          brightness: 100,
          contrast: 100,
          saturation: 100,
          hue: 0,
          blur: 0,
          grayscale: 0,
          sepia: 0,
          invert: 0
        },
        'Vivid': {
          brightness: 110,
          contrast: 120,
          saturation: 150,
          hue: 0,
          blur: 0,
          grayscale: 0,
          sepia: 0,
          invert: 0
        },
        'Black & White': {
          brightness: 100,
          contrast: 110,
          saturation: 0,
          hue: 0,
          blur: 0,
          grayscale: 100,
          sepia: 0,
          invert: 0
        },
        'Sepia': {
          brightness: 100,
          contrast: 90,
          saturation: 80,
          hue: 0,
          blur: 0,
          grayscale: 0,
          sepia: 100,
          invert: 0
        },
        'Cool': {
          brightness: 100,
          contrast: 100,
          saturation: 120,
          hue: 200,
          blur: 0,
          grayscale: 0,
          sepia: 0,
          invert: 0
        },
        'Warm': {
          brightness: 105,
          contrast: 100,
          saturation: 120,
          hue: 30,
          blur: 0,
          grayscale: 0,
          sepia: 0,
          invert: 0
        },
        'Dreamy': {
          brightness: 110,
          contrast: 85,
          saturation: 130,
          hue: 10,
          blur: 2,
          grayscale: 0,
          sepia: 0,
          invert: 0
        },
        'Dramatic': {
          brightness: 90,
          contrast: 140,
          saturation: 110,
          hue: 0,
          blur: 0,
          grayscale: 0,
          sepia: 0,
          invert: 0
        }
      },
      canvas: {
        'Solid Black': {
          type: 'solid',
          solid: '#000000'
        },
        'Solid White': {
          type: 'solid',
          solid: '#ffffff'
        },
        'Dark Gray': {
          type: 'solid',
          solid: '#1a1a1a'
        },
        'Sunset': {
          type: 'gradient',
          gradient: {
            type: 'linear',
            angle: 90,
            stops: [
              { offset: 0, color: '#ff6b6b' },
              { offset: 0.5, color: '#feca57' },
              { offset: 1, color: '#ff9ff3' }
            ]
          }
        },
        'Ocean': {
          type: 'gradient',
          gradient: {
            type: 'linear',
            angle: 180,
            stops: [
              { offset: 0, color: '#1e3c72' },
              { offset: 1, color: '#2a5298' }
            ]
          }
        },
        'Forest': {
          type: 'gradient',
          gradient: {
            type: 'linear',
            angle: 135,
            stops: [
              { offset: 0, color: '#134e5e' },
              { offset: 1, color: '#71b280' }
            ]
          }
        },
        'Purple Dream': {
          type: 'gradient',
          gradient: {
            type: 'radial',
            angle: 0,
            stops: [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' }
            ]
          }
        },
        'Checkerboard': {
          type: 'pattern',
          pattern: {
            type: 'checkerboard',
            size: 20,
            color1: '#333333',
            color2: '#444444'
          }
        }
      }
    };
  }

  getTextPreset(name) {
    return this.presets.text[name];
  }

  getImagePreset(name) {
    return this.presets.image[name];
  }

  getCanvasPreset(name) {
    return this.presets.canvas[name];
  }

  getAllTextPresets() {
    return Object.keys(this.presets.text);
  }

  getAllImagePresets() {
    return Object.keys(this.presets.image);
  }

  getAllCanvasPresets() {
    return Object.keys(this.presets.canvas);
  }

  applyTextPreset(layer, presetName) {
    const preset = this.getTextPreset(presetName);
    if (!preset) return false;

    Object.assign(layer.color, preset.color);
    Object.assign(layer.stroke, preset.stroke);
    Object.assign(layer.shadow, preset.shadow);
    Object.assign(layer.effects3d, preset.effects3d);
    Object.assign(layer.glow, preset.glow);

    return true;
  }

  applyImagePreset(slot, presetName) {
    const preset = this.getImagePreset(presetName);
    if (!preset) return false;

    Object.assign(slot.filters, preset);

    return true;
  }

  applyCanvasPreset(background, presetName) {
    const preset = this.getCanvasPreset(presetName);
    if (!preset) return false;

    background.type = preset.type;
    if (preset.type === 'solid') {
      background.solid = preset.solid;
    } else if (preset.type === 'gradient') {
      Object.assign(background.gradient, preset.gradient);
    } else if (preset.type === 'pattern') {
      Object.assign(background.pattern, preset.pattern);
    }

    return true;
  }

  createPresetUI(type, onApply) {
    const container = document.createElement('div');
    container.className = 'preset-grid';

    let presets = [];
    if (type === 'text') presets = this.getAllTextPresets();
    else if (type === 'image') presets = this.getAllImagePresets();
    else if (type === 'canvas') presets = this.getAllCanvasPresets();

    presets.forEach(name => {
      const item = document.createElement('div');
      item.className = 'preset-item';
      item.innerHTML = `<i class="fa-solid fa-palette"></i><br>${name}`;
      item.addEventListener('click', () => onApply(name));
      container.appendChild(item);
    });

    return container;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PresetManager };
}
