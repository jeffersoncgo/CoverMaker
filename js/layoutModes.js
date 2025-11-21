class LayoutMode {
  constructor(name) {
    this.name = name;
  }

  calculate(slots, canvasWidth, canvasHeight, settings) {
    throw new Error('calculate() must be implemented');
  }
}

class LineLayout extends LayoutMode {
  constructor() {
    super('line');
  }

  calculate(slots, canvasWidth, canvasHeight, settings) {
    const positions = [];
    const slotWidth = canvasWidth / slots.length;
    const slotTotalHeight = canvasHeight / 2;
    const realHeight = slotTotalHeight * settings.baseScale;
    const reflectionHeight = slotTotalHeight * settings.reflectionDistance;

    slots.forEach((slot, i) => {
      const dx = i * (slotWidth + settings.spacing) - settings.spacing;
      const dy = 0;

      positions.push({
        dx, dy,
        dWidth: slotWidth,
        dHeight: realHeight,
        reflectionHeight
      });
    });

    return positions;
  }
}

class GridLayout extends LayoutMode {
  constructor() {
    super('grid');
  }

  calculate(slots, canvasWidth, canvasHeight, settings) {
    const N = slots.length;
    if (!N) return [];

    const { spacing = 0, baseScale = 1 } = settings;
    const aspectRatio = canvasWidth / canvasHeight;

    const idealCols = aspectRatio > 1 ? Math.ceil(Math.sqrt(N * aspectRatio)) : Math.ceil(Math.sqrt(N / aspectRatio));
    const idealRows = Math.ceil(N / idealCols);

    const rows = [];
    let remaining = N;
    for (let r = 0; r < idealRows; r++) {
      const remainingRows = idealRows - r;
      const colsInRow = Math.ceil(remaining / remainingRows);
      rows.push(colsInRow);
      remaining -= colsInRow;
    }

    const totalSpacingY = spacing * (rows.length - 1);
    const rowHeight = (canvasHeight - totalSpacingY) / rows.length;

    const positions = [];
    let imgIndex = 0;
    let dy = 0;

    for (let r = 0; r < rows.length; r++) {
      const cols = rows[r];
      const totalSpacingX = spacing * (cols - 1);
      const cellWidth = (canvasWidth - totalSpacingX) / cols;
      const realHeight = rowHeight * baseScale;

      for (let c = 0; c < cols && imgIndex < N; c++, imgIndex++) {
        const dx = c * (cellWidth + spacing);

        positions.push({
          dx, dy,
          dWidth: cellWidth,
          dHeight: realHeight,
          reflectionHeight: 0
        });
      }

      dy += rowHeight + spacing;
    }

    return positions;
  }
}

class FreeLayout extends LayoutMode {
  constructor() {
    super('free');
  }

  calculate(slots, canvasWidth, canvasHeight, settings) {
    return slots.map((slot, i) => {
      const defaultSize = Math.min(canvasWidth, canvasHeight) * 0.3;

      return {
        dx: slot.freePosition?.x ?? (canvasWidth / 2 - defaultSize / 2),
        dy: slot.freePosition?.y ?? (canvasHeight / 2 - defaultSize / 2),
        dWidth: slot.freePosition?.width ?? defaultSize,
        dHeight: slot.freePosition?.height ?? defaultSize,
        reflectionHeight: 0
      };
    });
  }
}

class MosaicLayout extends LayoutMode {
  constructor() {
    super('mosaic');
  }

  calculate(slots, canvasWidth, canvasHeight, settings) {
    const N = slots.length;
    if (N === 0) return [];
    if (N === 1) {
      return [{
        dx: 0, dy: 0,
        dWidth: canvasWidth,
        dHeight: canvasHeight,
        reflectionHeight: 0
      }];
    }

    const positions = [];
    const { spacing = 0 } = settings;

    if (N === 2) {
      const halfWidth = (canvasWidth - spacing) / 2;
      positions.push(
        { dx: 0, dy: 0, dWidth: halfWidth, dHeight: canvasHeight, reflectionHeight: 0 },
        { dx: halfWidth + spacing, dy: 0, dWidth: halfWidth, dHeight: canvasHeight, reflectionHeight: 0 }
      );
    } else if (N === 3) {
      const halfWidth = (canvasWidth - spacing) / 2;
      const halfHeight = (canvasHeight - spacing) / 2;
      positions.push(
        { dx: 0, dy: 0, dWidth: halfWidth, dHeight: canvasHeight, reflectionHeight: 0 },
        { dx: halfWidth + spacing, dy: 0, dWidth: halfWidth, dHeight: halfHeight, reflectionHeight: 0 },
        { dx: halfWidth + spacing, dy: halfHeight + spacing, dWidth: halfWidth, dHeight: halfHeight, reflectionHeight: 0 }
      );
    } else if (N === 4) {
      const halfWidth = (canvasWidth - spacing) / 2;
      const halfHeight = (canvasHeight - spacing) / 2;
      positions.push(
        { dx: 0, dy: 0, dWidth: halfWidth, dHeight: halfHeight, reflectionHeight: 0 },
        { dx: halfWidth + spacing, dy: 0, dWidth: halfWidth, dHeight: halfHeight, reflectionHeight: 0 },
        { dx: 0, dy: halfHeight + spacing, dWidth: halfWidth, dHeight: halfHeight, reflectionHeight: 0 },
        { dx: halfWidth + spacing, dy: halfHeight + spacing, dWidth: halfWidth, dHeight: halfHeight, reflectionHeight: 0 }
      );
    } else {
      return new GridLayout().calculate(slots, canvasWidth, canvasHeight, settings);
    }

    return positions;
  }
}

class CircleLayout extends LayoutMode {
  constructor() {
    super('circle');
  }

  calculate(slots, canvasWidth, canvasHeight, settings) {
    const N = slots.length;
    if (N === 0) return [];

    const positions = [];
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.35;
    const size = Math.min(canvasWidth, canvasHeight) * 0.2;

    slots.forEach((slot, i) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius - size / 2;
      const y = centerY + Math.sin(angle) * radius - size / 2;

      positions.push({
        dx: x,
        dy: y,
        dWidth: size,
        dHeight: size,
        reflectionHeight: 0
      });
    });

    return positions;
  }
}

class CollageLayout extends LayoutMode {
  constructor() {
    super('collage');
  }

  calculate(slots, canvasWidth, canvasHeight, settings) {
    const N = slots.length;
    if (N === 0) return [];

    const positions = [];
    const padding = 20;
    const minSize = Math.min(canvasWidth, canvasHeight) * 0.15;
    const maxSize = Math.min(canvasWidth, canvasHeight) * 0.35;

    slots.forEach((slot, i) => {
      const randomSeed = (i * 2654435761) % 2147483647;
      const random = () => (randomSeed + i * 16807) / 2147483647;

      const size = minSize + random() * (maxSize - minSize);
      const x = padding + random() * (canvasWidth - size - padding * 2);
      const y = padding + random() * (canvasHeight - size - padding * 2);

      positions.push({
        dx: x,
        dy: y,
        dWidth: size,
        dHeight: size,
        reflectionHeight: 0
      });
    });

    return positions;
  }
}

class LayoutManager {
  constructor() {
    this.layouts = {
      line: new LineLayout(),
      grid: new GridLayout(),
      free: new FreeLayout(),
      mosaic: new MosaicLayout(),
      circle: new CircleLayout(),
      collage: new CollageLayout()
    };
    this.currentLayout = 'line';
  }

  setLayout(name) {
    if (this.layouts[name]) {
      this.currentLayout = name;
      return true;
    }
    return false;
  }

  getLayout() {
    return this.layouts[this.currentLayout];
  }

  calculatePositions(slots, canvasWidth, canvasHeight, settings) {
    return this.getLayout().calculate(slots, canvasWidth, canvasHeight, settings);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LayoutManager, LayoutMode };
}
