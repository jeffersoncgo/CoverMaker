function makeDraggable(windowEl) {
  const bar = windowEl.querySelector('.windowBar');
  const closeBtn = windowEl.querySelector('.closeBtn');
  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  bar.addEventListener('mousedown', (e) => {
    if (e.target === closeBtn) return;

    isDragging = true;
    const rect = windowEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // Reset transform to avoid positional conflicts
    windowEl.style.transform = 'none';
    windowEl.style.position = 'absolute';
    windowEl.style.zIndex = Date.now(); // bring to front
    windowEl.style.cursor = 'grabbing';
    windowEl.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;

    // Constrain within viewport
    const maxX = window.innerWidth - windowEl.offsetWidth;
    const maxY = window.innerHeight - windowEl.offsetHeight;

    x = Math.min(Math.max(0, x), maxX);
    y = Math.min(Math.max(0, y), maxY);

    windowEl.style.left = `${x}px`;
    windowEl.style.top = `${y}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    windowEl.style.cursor = '';
    windowEl.style.userSelect = '';
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      windowEl.style.display = 'none';
    });
  }
}

function showWindow(windowId) {
  const windowEl = document.getElementById(windowId);
  if (!windowEl) return;
  // Ensure maximum size fits into viewport before showing
  const margin = 32; // pixels
  const maxWidth = Math.max(200, window.innerWidth - margin);
  const maxHeight = Math.max(200, window.innerHeight - margin);

  // If the element's defined width is larger than our viewport, clamp it
  const currentWidth = windowEl.offsetWidth;
  const currentHeight = windowEl.offsetHeight;
  if (currentWidth > maxWidth) {
    windowEl.style.width = `${maxWidth}px`;
  }
  if (currentHeight > maxHeight) {
    windowEl.style.height = `${maxHeight}px`;
    windowEl.style.overflow = 'auto';
  }
  windowEl.style.left = '50%';
  windowEl.style.top = '50%';
  windowEl.style.transform = 'translate(-50%, -50%)';
  windowEl.style.zIndex = Date.now(); // bring to front
  windowEl.style.display = 'block';
}

function hideWindow(windowId) {
  const windowEl = document.getElementById(windowId);
  if (!windowEl) return;
  windowEl.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.floatWindow').forEach(window => {
    makeDraggable(window);
    // Ensure fit to viewport
    const margin = 32; // pixels
    const maxW = Math.max(200, window.innerWidth - margin);
    const maxH = Math.max(200, window.innerHeight - margin);
    window.style.maxWidth = `calc(100vw - 2rem)`;
    window.style.maxHeight = `calc(100vh - 2rem)`;
    const cw = window.offsetWidth;
    const ch = window.offsetHeight;
    if (cw > maxW) window.style.width = `${maxW}px`;
    if (ch > maxH) window.style.height = `${maxH}px`;
    window.style.left = '50%';
    window.style.top = '50%';
    window.style.transform = 'translate(-50%, -50%)';
  });
});