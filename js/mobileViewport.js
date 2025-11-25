/**
 * Mobile Viewport Height Fix
 * Handles the dynamic address bar on mobile browsers
 * that causes 100vh to be inconsistent
 */

(function() {
  // Function to set the actual viewport height as a CSS custom property
  function setViewportHeight() {
    // Get the actual viewport height
    const vh = window.innerHeight * 0.01;
    
    // Set the custom property --app-height on the document root
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    
    // Also set --vh for other uses
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  // Set on initial load
  setViewportHeight();

  // Update on resize (includes orientation change)
  let resizeTimeout;
  window.addEventListener('resize', function() {
    // Debounce to avoid excessive updates
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(setViewportHeight, 100);
  });

  // Update on orientation change
  window.addEventListener('orientationchange', function() {
    // Wait a bit for the browser to complete the orientation change
    setTimeout(setViewportHeight, 200);
  });

  // iOS Safari specific: handle scroll events (address bar hide/show)
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    let scrollTimeout;
    window.addEventListener('scroll', function() {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(setViewportHeight, 100);
    }, { passive: true });
  }

  // Also listen for Visual Viewport API if available (better for iOS)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setViewportHeight);
  }
})();
