class TextLayer {
  constructor(id, text = "Text Layer") {
    this.id = id;
    this.text = text;
    this.visible = true;
    this.position = { x: 0.5, y: 0.5 };
    this.font = {
      family: 'Arial',
      size: 100,
      weight: 'bold',
      style: 'normal'
    };
    this.color = {
      type: 'solid',
      solid: '#ffffff',
      gradient: {
        type: 'linear',
        angle: 0,
        stops: [
          { offset: 0, color: '#ffffff' },
          { offset: 1, color: '#000000' }
        ]
      }
    };
    this.stroke = {
      enabled: false,
      width: 2,
      color: '#000000'
    };
    this.shadow = {
      enabled: false,
      offsetX: 2,
      offsetY: 2,
      blur: 4,
      color: 'rgba(0,0,0,0.5)'
    };
    this.effects3d = {
      enabled: false,
      depth: 10,
      angle: 45,
      color: '#666666',
      shadowColor: 'rgba(0,0,0,0.3)'
    };
    this.outline = {
      enabled: false,
      width: 1,
      color: '#000000'
    };
    this.glow = {
      enabled: false,
      blur: 10,
      color: '#ffffff',
      intensity: 1
    };
    this.transform = {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0
    };
    this.opacity = 1;
    this.blendMode = 'normal';
  }

  clone() {
    const cloned = new TextLayer(Date.now(), this.text);
    Object.assign(cloned, JSON.parse(JSON.stringify(this)));
    cloned.id = Date.now();
    return cloned;
  }

  toJSON() {
    return {
      id: this.id,
      text: this.text,
      visible: this.visible,
      position: this.position,
      font: this.font,
      color: this.color,
      stroke: this.stroke,
      shadow: this.shadow,
      effects3d: this.effects3d,
      outline: this.outline,
      glow: this.glow,
      transform: this.transform,
      opacity: this.opacity,
      blendMode: this.blendMode
    };
  }

  static fromJSON(data) {
    const layer = new TextLayer(data.id, data.text);
    Object.assign(layer, data);
    return layer;
  }
}

class TextEffectsRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async renderLayer(layer, canvasWidth, canvasHeight) {
    if (!layer.visible || !layer.text) return;

    const ctx = this.ctx;
    ctx.save();

    const x = layer.position.x * canvasWidth;
    const y = layer.position.y * canvasHeight;

    ctx.translate(x, y);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.scale(layer.transform.scaleX, layer.transform.scaleY);

    if (layer.transform.skewX !== 0 || layer.transform.skewY !== 0) {
      ctx.transform(
        1,
        Math.tan((layer.transform.skewY * Math.PI) / 180),
        Math.tan((layer.transform.skewX * Math.PI) / 180),
        1,
        0,
        0
      );
    }

    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode;

    const fontString = `${layer.font.style} ${layer.font.weight} ${layer.font.size}px "${layer.font.family}"`;
    ctx.font = fontString;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (layer.effects3d.enabled) {
      this.render3DEffect(layer);
    }

    if (layer.glow.enabled) {
      this.renderGlow(layer);
    }

    if (layer.shadow.enabled) {
      ctx.shadowOffsetX = layer.shadow.offsetX;
      ctx.shadowOffsetY = layer.shadow.offsetY;
      ctx.shadowBlur = layer.shadow.blur;
      ctx.shadowColor = layer.shadow.color;
    }

    if (layer.outline.enabled) {
      ctx.strokeStyle = layer.outline.color;
      ctx.lineWidth = layer.outline.width * 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(layer.text, 0, 0);
    }

    if (layer.stroke.enabled) {
      ctx.strokeStyle = layer.stroke.color;
      ctx.lineWidth = layer.stroke.width;
      ctx.strokeText(layer.text, 0, 0);
    }

    if (layer.color.type === 'solid') {
      ctx.fillStyle = layer.color.solid;
    } else if (layer.color.type === 'gradient') {
      ctx.fillStyle = this.createGradient(layer.color.gradient, layer.text);
    }

    ctx.fillText(layer.text, 0, 0);

    ctx.restore();
  }

  render3DEffect(layer) {
    const ctx = this.ctx;
    const depth = layer.effects3d.depth;
    const angle = (layer.effects3d.angle * Math.PI) / 180;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    ctx.save();
    ctx.fillStyle = layer.effects3d.color;

    for (let i = depth; i > 0; i--) {
      const offsetX = dx * i;
      const offsetY = dy * i;
      const alpha = 1 - (i / depth) * 0.5;

      ctx.globalAlpha = alpha * layer.opacity;
      ctx.fillText(layer.text, offsetX, offsetY);
    }

    if (layer.effects3d.shadowColor) {
      ctx.shadowOffsetX = dx * depth * 1.5;
      ctx.shadowOffsetY = dy * depth * 1.5;
      ctx.shadowBlur = depth * 2;
      ctx.shadowColor = layer.effects3d.shadowColor;
      ctx.fillStyle = layer.effects3d.shadowColor;
      ctx.fillText(layer.text, dx * depth, dy * depth);
    }

    ctx.restore();
  }

  renderGlow(layer) {
    const ctx = this.ctx;
    const iterations = Math.ceil(layer.glow.intensity * 3);

    ctx.save();
    ctx.shadowBlur = layer.glow.blur;
    ctx.shadowColor = layer.glow.color;

    for (let i = 0; i < iterations; i++) {
      ctx.fillStyle = layer.glow.color;
      ctx.globalAlpha = (layer.opacity * layer.glow.intensity) / iterations;
      ctx.fillText(layer.text, 0, 0);
    }

    ctx.restore();
  }

  createGradient(gradientConfig, text) {
    const ctx = this.ctx;
    const metrics = ctx.measureText(text);
    const width = metrics.width;
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

    let gradient;

    if (gradientConfig.type === 'linear') {
      const angle = (gradientConfig.angle * Math.PI) / 180;
      const x1 = -width / 2;
      const y1 = -height / 2;
      const x2 = x1 + Math.cos(angle) * width;
      const y2 = y1 + Math.sin(angle) * height;

      gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    } else if (gradientConfig.type === 'radial') {
      gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(width, height) / 2);
    }

    gradientConfig.stops.forEach(stop => {
      gradient.addColorStop(stop.offset, stop.color);
    });

    return gradient;
  }
}

class TextLayerManager {
  constructor() {
    this.layers = [];
    this.activeLayerId = null;
    this.nextId = 1;
  }

  addLayer(text = "New Text") {
    const layer = new TextLayer(this.nextId++, text);
    this.layers.push(layer);
    this.activeLayerId = layer.id;
    return layer;
  }

  removeLayer(id) {
    const index = this.layers.findIndex(l => l.id === id);
    if (index !== -1) {
      this.layers.splice(index, 1);
      if (this.activeLayerId === id) {
        this.activeLayerId = this.layers.length > 0 ? this.layers[0].id : null;
      }
    }
  }

  getLayer(id) {
    return this.layers.find(l => l.id === id);
  }

  getActiveLayer() {
    return this.getLayer(this.activeLayerId);
  }

  setActiveLayer(id) {
    if (this.getLayer(id)) {
      this.activeLayerId = id;
    }
  }

  moveLayer(id, direction) {
    const index = this.layers.findIndex(l => l.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.layers.length) return;

    [this.layers[index], this.layers[newIndex]] = [this.layers[newIndex], this.layers[index]];
  }

  duplicateLayer(id) {
    const layer = this.getLayer(id);
    if (!layer) return null;

    const cloned = layer.clone();
    cloned.id = this.nextId++;
    cloned.text += ' (copy)';

    const index = this.layers.findIndex(l => l.id === id);
    this.layers.splice(index + 1, 0, cloned);

    this.activeLayerId = cloned.id;
    return cloned;
  }

  toJSON() {
    return {
      layers: this.layers.map(l => l.toJSON()),
      activeLayerId: this.activeLayerId,
      nextId: this.nextId
    };
  }

  fromJSON(data) {
    this.layers = data.layers.map(l => TextLayer.fromJSON(l));
    this.activeLayerId = data.activeLayerId;
    this.nextId = data.nextId;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TextLayer, TextEffectsRenderer, TextLayerManager };
}
