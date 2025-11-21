function toastMessage(message, options = {}) {
  // 1. Defaults
  const defaults = {
    position: 'topRight', // topLeft, topCenter, topRight, centerLeft, center, centerRight, bottomLeft, bottomCenter, bottomRight, cursorPos
    type: 'default',      // default, success, danger
    duration: 3000,       // Time in ms before disappearing
    x: 0,                 // Used only if position is 'cursorPos'
    y: 0                  // Used only if position is 'cursorPos'
  };

  const config = { ...defaults, ...options };

  // 2. Handle Container Logic (Unless cursor pos)
  let container;
  if (config.position !== 'cursorPos') {
    // Map simplified names to CSS class names
    const posClassMap = {
      'topLeft': 'tc-top-left',
      'topCenter': 'tc-top-center',
      'topRight': 'tc-top-right',
      'centerLeft': 'tc-center-left',
      'center': 'tc-center',
      'centerRight': 'tc-center-right',
      'bottomLeft': 'tc-bottom-left',
      'bottomCenter': 'tc-bottom-center',
      'bottomRight': 'tc-bottom-right'
    };

    const posClass = posClassMap[config.position] || 'tc-top-right';

    // Check if container exists, if not create it
    container = document.querySelector(`.${posClass}`);
    if (!container) {
      container = document.createElement('div');
      container.className = `toast-container ${posClass}`;
      document.body.appendChild(container);
    }
  }

  // 3. Create the Toast Element
  const toast = document.createElement('div');
  toast.className = `toast toast-accent-${config.type}`;

  // Optional: Add icon based on type
  let icon = '';
  if (config.type === 'success') icon = '<svg width="20" height="20" fill="none" stroke="var(--c-success)" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
  else if (config.type === 'danger') icon = '<svg width="20" height="20" fill="none" stroke="var(--c-danger)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>';
  else icon = '<svg width="20" height="20" fill="none" stroke="var(--c-primary)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>';

  toast.innerHTML = `${icon} <span>${message}</span>`;

  // 4. Insert into DOM
  if (config.position === 'cursorPos') {
    toast.classList.add('toast-cursor');
    toast.style.left = `${config.x}px`;
    toast.style.top = `${config.y}px`;
    document.body.appendChild(toast);
  } else {
    // Prepend or Append depending on position to make stacking look natural
    // (CSS flex-direction handles visual order, appendChild adds to DOM)
    container.appendChild(toast);
  }

  // 5. Trigger Animation (needs a slight delay to render first)
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // 6. Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    // Wait for CSS transition to finish before removing from DOM
    setTimeout(() => {
      toast.remove();
      // Cleanup empty containers
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    }, 300);
  }, config.duration);
}

// Helper for the demo to get cursor position
function triggerCursorToast(e) {
  toastMessage('Spawned at cursor!', {
    position: 'cursorPos',
    type: 'default',
    x: e.clientX,
    y: e.clientY
  });
}