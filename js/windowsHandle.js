// Windows stay above everything else, as with the old z-index = Date.now() (which the browser clamped to the 32-bit
// maximum, so every window got the same value and "bring to front" did nothing). A counter keeps the click order.
let floatWindowZ = 2147483000;
function bringWindowToFront(windowEl) {
  floatWindowZ = Math.min(floatWindowZ + 1, 2147483647);
  windowEl.style.zIndex = floatWindowZ;
}

function makeDraggable(windowEl) {
  const bar = windowEl.querySelector('.windowBar');
  const closeBtn = windowEl.querySelector('.closeBtn');
  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  // Pointer events: the same for the mouse, and dragging also works with touch and pens
  bar.style.touchAction = 'none';
  bar.addEventListener('pointerdown', (e) => {
    if (e.target === closeBtn) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return; // like before: only the main button drags

    isDragging = true;
    try { bar.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    const rect = windowEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // Reset transform to avoid positional conflicts
    windowEl.style.transform = 'none';
    windowEl.style.position = 'absolute';
    bringWindowToFront(windowEl);
    windowEl.style.cursor = 'grabbing';
    windowEl.style.userSelect = 'none';
  });

  document.addEventListener('pointermove', (e) => {
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

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    windowEl.style.cursor = '';
    windowEl.style.userSelect = '';
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

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
  bringWindowToFront(windowEl);
  windowEl.style.display = 'block';
  // Opened by the user (click/key): move focus into the window for keyboard and screen reader users. Not when the
  // page opens it by itself (e.g. the login window at startup), so a phone keyboard does not pop up uninvited.
  if (navigator.userActivation?.isActive) {
    const first = windowEl.querySelector('input:not([type="hidden"]), select, textarea, button:not(.closeBtn)');
    first?.focus({ preventScroll: true });
  }
}

function hideWindow(windowId) {
  const windowEl = document.getElementById(windowId);
  if (!windowEl) return;
  windowEl.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  // (the element was called `window`, hiding the global one: window.innerWidth was undefined here)
  document.querySelectorAll('.floatWindow').forEach(win => {
    makeDraggable(win);
    // Ensure fit to viewport
    const margin = 32; // pixels
    const maxW = Math.max(200, window.innerWidth - margin);
    const maxH = Math.max(200, window.innerHeight - margin);
    win.style.maxWidth = `calc(100vw - 2rem)`;
    win.style.maxHeight = `calc(100vh - 2rem)`;
    const cw = win.offsetWidth;
    const ch = win.offsetHeight;
    if (cw > maxW) win.style.width = `${maxW}px`;
    if (ch > maxH) win.style.height = `${maxH}px`;
    win.style.left = '50%';
    win.style.top = '50%';
    win.style.transform = 'translate(-50%, -50%)';
  });
});