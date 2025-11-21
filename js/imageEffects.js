class ImageSlot {
  constructor(index) {
    this.index = index;
    this.image = null;
    this.pinned = false;
    this.transform = {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false
    };
    this.crop = {
      enabled: false,
      x: 0,
      y: 0,
      width: 1,
      height: 1
    };
    this.filters = {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      opacity: 100
    };
    this.mask = {
      enabled: false,
      type: 'none',
      borderRadius: 0
    };
    this.border = {
      enabled: false,
      width: 0,
      color: '#000000',
      style: 'solid'
    };
  }

  getFilterString() {
    const f = this.filters;
    return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hue}deg) blur(${f.blur}px) grayscale(${f.grayscale}%) sepia(${f.sepia}%) invert(${f.invert}%)`;
  }

  reset() {
    this.transform = {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flipX: false,
      flipY: false
    };
    this.crop = {
      enabled: false,
      x: 0,
      y: 0,
      width: 1,
      height: 1
    };
    this.filters = {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      opacity: 100
    };
  }

  toJSON() {
    return {
      index: this.index,
      pinned: this.pinned,
      transform: this.transform,
      crop: this.crop,
      filters: this.filters,
      mask: this.mask,
      border: this.border
    };
  }

  static fromJSON(data) {
    const slot = new ImageSlot(data.index);
    Object.assign(slot, data);
    return slot;
  }
}

class ImageEffectsRenderer {
  constructor() {
    this.offscreenCanvas = new OffscreenCanvas(100, 100);
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }

  applyFiltersToImage(img, slot) {
    if (!img || !slot) return img;

    const hasFilters = Object.values(slot.filters).some((val, idx) => {
      const defaults = [100, 100, 100, 0, 0, 0, 0, 0, 100];
      return val !== defaults[idx];
    });

    if (!hasFilters && slot.filters.opacity === 100) return img;

    this.offscreenCanvas.width = img.width;
    this.offscreenCanvas.height = img.height;

    this.offscreenCtx.clearRect(0, 0, img.width, img.height);
    this.offscreenCtx.filter = slot.getFilterString();
    this.offscreenCtx.globalAlpha = slot.filters.opacity / 100;
    this.offscreenCtx.drawImage(img, 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.offscreenCanvas, 0, 0);

    const filteredImg = new Image();
    filteredImg.src = canvas.toDataURL();
    return filteredImg;
  }

  getCropRect(img, slot) {
    if (!slot.crop.enabled) {
      return { sx: 0, sy: 0, sWidth: img.width, sHeight: img.height };
    }

    return {
      sx: slot.crop.x * img.width,
      sy: slot.crop.y * img.height,
      sWidth: slot.crop.width * img.width,
      sHeight: slot.crop.height * img.height
    };
  }

  drawImageWithEffects(ctx, img, slot, dx, dy, dWidth, dHeight) {
    if (!img || !slot) return;

    ctx.save();

    const centerX = dx + dWidth / 2;
    const centerY = dy + dHeight / 2;

    ctx.translate(centerX, centerY);

    ctx.rotate((slot.transform.rotation * Math.PI) / 180);

    const scaleX = slot.transform.scaleX * (slot.transform.flipX ? -1 : 1);
    const scaleY = slot.transform.scaleY * (slot.transform.flipY ? -1 : 1);
    ctx.scale(scaleX, scaleY);

    ctx.translate(slot.transform.x, slot.transform.y);

    if (slot.mask.enabled && slot.mask.borderRadius > 0) {
      this.applyRoundedMask(ctx, -dWidth / 2, -dHeight / 2, dWidth, dHeight, slot.mask.borderRadius);
    }

    if (slot.border.enabled && slot.border.width > 0) {
      ctx.strokeStyle = slot.border.color;
      ctx.lineWidth = slot.border.width;
      if (slot.border.style === 'dashed') {
        ctx.setLineDash([10, 5]);
      } else if (slot.border.style === 'dotted') {
        ctx.setLineDash([2, 3]);
      }
      ctx.strokeRect(-dWidth / 2, -dHeight / 2, dWidth, dHeight);
      ctx.setLineDash([]);
    }

    const crop = this.getCropRect(img, slot);
    ctx.filter = slot.getFilterString();
    ctx.globalAlpha = slot.filters.opacity / 100;

    ctx.drawImage(
      img,
      crop.sx, crop.sy, crop.sWidth, crop.sHeight,
      -dWidth / 2, -dHeight / 2, dWidth, dHeight
    );

    ctx.restore();
  }

  applyRoundedMask(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
  }
}

class CanvasBackground {
  constructor() {
    this.type = 'solid';
    this.solid = '#000000';
    this.gradient = {
      type: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#333333' }
      ]
    };
    this.pattern = {
      type: 'none',
      size: 20,
      color1: '#000000',
      color2: '#111111'
    };
  }

  render(ctx, width, height) {
    ctx.save();

    if (this.type === 'solid') {
      ctx.fillStyle = this.solid;
      ctx.fillRect(0, 0, width, height);
    } else if (this.type === 'gradient') {
      ctx.fillStyle = this.createGradient(ctx, width, height);
      ctx.fillRect(0, 0, width, height);
    } else if (this.type === 'pattern' && this.pattern.type !== 'none') {
      this.renderPattern(ctx, width, height);
    }

    ctx.restore();
  }

  createGradient(ctx, width, height) {
    let gradient;

    if (this.gradient.type === 'linear') {
      const angle = (this.gradient.angle * Math.PI) / 180;
      const x1 = width / 2 - Math.cos(angle) * width / 2;
      const y1 = height / 2 - Math.sin(angle) * height / 2;
      const x2 = width / 2 + Math.cos(angle) * width / 2;
      const y2 = height / 2 + Math.sin(angle) * height / 2;

      gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    } else if (this.gradient.type === 'radial') {
      gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
    }

    this.gradient.stops.forEach(stop => {
      gradient.addColorStop(stop.offset, stop.color);
    });

    return gradient;
  }

  renderPattern(ctx, width, height) {
    const size = this.pattern.size;

    if (this.pattern.type === 'checkerboard') {
      for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
          ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? this.pattern.color1 : this.pattern.color2;
          ctx.fillRect(x, y, size, size);
        }
      }
    } else if (this.pattern.type === 'stripes-horizontal') {
      for (let y = 0; y < height; y += size) {
        ctx.fillStyle = ((y / size) % 2 === 0) ? this.pattern.color1 : this.pattern.color2;
        ctx.fillRect(0, y, width, size);
      }
    } else if (this.pattern.type === 'stripes-vertical') {
      for (let x = 0; x < width; x += size) {
        ctx.fillStyle = ((x / size) % 2 === 0) ? this.pattern.color1 : this.pattern.color2;
        ctx.fillRect(x, 0, size, height);
      }
    } else if (this.pattern.type === 'dots') {
      ctx.fillStyle = this.pattern.color1;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = this.pattern.color2;
      for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
          ctx.beginPath();
          ctx.arc(x + size / 2, y + size / 2, size / 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  toJSON() {
    return {
      type: this.type,
      solid: this.solid,
      gradient: this.gradient,
      pattern: this.pattern
    };
  }

  static fromJSON(data) {
    const bg = new CanvasBackground();
    Object.assign(bg, data);
    return bg;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageSlot, ImageEffectsRenderer, CanvasBackground };
}
