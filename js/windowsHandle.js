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
  windowEl.style.display = 'block';
  windowEl.style.left = '50%';
  windowEl.style.top = '50%';
  windowEl.style.zIndex = Date.now();
}

function hideWindow(windowId) {
  const windowEl = document.getElementById(windowId);
  if (!windowEl) return;
  windowEl.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.floatWindow').forEach(window => {
    makeDraggable(window);
    window.style.left = '50%';
    window.style.top = '50%';
    window.style.transform = 'translate(-50%, -50%)';
  });
});