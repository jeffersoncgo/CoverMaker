// Gallery UI: loads gallery.json and renders a gallery window.

async function fetchGalleryItems() {
  try {
    const res = await fetch('gallery/gallery.json');
    if (!res.ok) throw new Error('Failed to load gallery.json');
    return await res.json();
  } catch (err) {
    console.error('Error fetching gallery:', err);
    return [];
  }
}

// Keep gallery items in memory for search / filtering
let _galleryItemsCache = [];

function debounce(fn, wait) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function makeGalleryCard(item) {
  const el = document.createElement('div');
  el.className = 'gallery-card poster';
  el.dataset.itemId = item.id || '';

  const img = document.createElement('img');
  img.className = 'preview';
  img.src = item.image || '';
  img.loading = 'lazy';
  img.alt = item.title || '';
  
  // const title = document.createElement('div');
  // title.className = 'card-title';
  // title.textContent = item.title || '';
  
  el.appendChild(img);
  // el.appendChild(title);
  
  // Open modal on click and handle selection
  el.addEventListener('click', () => {
    // Remove selected class from all other cards
    document.querySelectorAll('.gallery-card.selected').forEach(card => card.classList.remove('selected'));
    // Add to this one
    el.classList.add('selected');
    openGalleryModal(item);
  });

  return el;
}

function openGalleryModal(item) {
  const modal = document.getElementById('galleryModal');
  if (!modal) return;
  modal.style.zIndex = Date.now(); // bring to front
  
  // Populate modal content
  const modalImg = modal.querySelector('.gallery-modal-image');
  const modalTitle = modal.querySelector('.gallery-modal-title');
  const modalDesc = modal.querySelector('.gallery-modal-description');
  const modalAuthor = modal.querySelector('.gallery-modal-author span');
  const modalAuthorLink = modal.querySelector('.gallery-modal-author a');
  const setupBtn = modal.querySelector('.gallery-modal-setup-btn');
  const projectBtn = modal.querySelector('.gallery-modal-project-btn');
  
  if (modalImg) {
    modalImg.src = item.image || '';
    modalImg.style.cursor = 'pointer';
    modalImg.title = 'Click to open full image';
    modalImg.onclick = () => {
      if (item.image) window.open(item.image, '_blank');
    };
  }
  if (modalTitle) modalTitle.textContent = item.title || '';
  if (modalDesc) modalDesc.textContent = item.shortDescription || '';
  if (modalAuthor) modalAuthor.textContent = item.author || '';
  
  if (modalAuthorLink) {
    if (item.page) {
      modalAuthorLink.href = item.page;
      modalAuthorLink.style.display = 'inline-flex';
    } else {
      modalAuthorLink.style.display = 'none';
    }
  }
  
  // Setup button
  if (setupBtn) {
    setupBtn.onclick = async () => {
      try {
        setupBtn.disabled = true;
        closeGalleryModal();
        hideWindow('galleryBox');
        await useSetup(item.setup || item.project);
      } finally {
        setupBtn.disabled = false;
      }
    };
    setupBtn.disabled = !item.setup && !item.project;
  }
  
  // Project button
  if (projectBtn) {
    projectBtn.onclick = async () => {
      try {
        projectBtn.disabled = true;
        closeGalleryModal();
        hideWindow('galleryBox');
        await useFullProject(item.project);
      } finally {
        projectBtn.disabled = false;
      }
    };
    projectBtn.disabled = !item.project;
  }
  
  modal.style.display = 'flex';
}

function closeGalleryModal() {
  const modal = document.getElementById('galleryModal');
  if (modal) modal.style.display = 'none';
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('galleryModal');
    if (modal && modal.style.display !== 'none') {
      closeGalleryModal();
    }
  }
});

async function useFullProject(url) {
  if (!url) return toastMessage('No project URL specified', { position: 'bottomCenter', type: 'warning' });
  const loadingToast = toastMessage('Importing project...', { position: 'bottomCenter', type: 'loading', duration: 0 });
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch project zip');
    const blob = await resp.blob();
    const fileName = url.split('/').pop() || 'project.zip';
    const file = new File([blob], fileName, { type: blob.type || 'application/zip' });
    if (typeof importProjectFromZip === 'function') {
      hideWindow('galleryBox');
      await importProjectFromZip(file);
      // Close gallery window
      // Close loading toast and show success msg
      if (typeof closeToast === 'function') closeToast(loadingToast);
      toastMessage('Project imported successfully!', { position: 'bottomCenter', type: 'success' });
    } else {
      throw new Error('importProjectFromZip isn\'t available');
    }
  } catch (err) {
    console.error(err);
    if (typeof closeToast === 'function') closeToast(loadingToast);
    toastMessage('Failed to import project: ' + err.message, { position: 'bottomCenter', type: 'danger' });
  }
}

async function useSetup(url) {
  if (!url) return toastMessage('No setup URL specified', { position: 'bottomCenter', type: 'warning' });
  const loadingToast = toastMessage('Importing setup...', { position: 'bottomCenter', type: 'loading', duration: 0 });
  try {
    // If the url is a zip, try to extract project.json
    if (url.endsWith('.zip')) {
      if (typeof JSZip !== 'undefined') {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch zip');
        const blob = await resp.blob();
        const zip = new JSZip();
        const contents = await zip.loadAsync(blob);
        const projectFile = contents.file('project.json');
        if (projectFile) {
          const jsonText = await projectFile.async('string');
          const file = new File([jsonText], 'project.json', { type: 'application/json' });
          if (typeof importProjectFromJson === 'function') {
            hideWindow('galleryBox');
            await importProjectFromJson(file);
            if (typeof closeToast === 'function') closeToast(loadingToast);
            toastMessage('Setup imported successfully!', { position: 'bottomCenter', type: 'success' });
            return;
          }
        } else {
          // fallback: import the full project
          if (typeof closeToast === 'function') closeToast(loadingToast);
          await useFullProject(url);
          return;
        }
      } else {
        // no JSZip available, import full zip
        if (typeof closeToast === 'function') closeToast(loadingToast);
        await useFullProject(url);
        return;
      }
    }

    // If the url ends with .json or anything else, try fetching as JSON and import
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch setup JSON');
    const text = await res.text();
    const file = new File([text], 'project.json', { type: 'application/json' });
    if (typeof importProjectFromJson === 'function') {
      hideWindow('galleryBox');
      await importProjectFromJson(file, true); // true = setup only, ignore assets
      if (typeof closeToast === 'function') closeToast(loadingToast);
      toastMessage('Setup imported successfully!', { position: 'bottomCenter', type: 'success' });
      return;
    }

    throw new Error('importProjectFromJson is not available');
  } catch (err) {
    console.error(err);
    if (typeof closeToast === 'function') closeToast(loadingToast);
    toastMessage('Failed to import setup: ' + err.message, { position: 'bottomCenter', type: 'danger' });
  }
}

function renderGalleryItems(items, containerId) {
  const list = document.getElementById(containerId);
  if (!list) return;
  list.innerHTML = '';
  items.forEach(item => list.appendChild(makeGalleryCard(item)));
}

async function renderGallery() {
  const items = await fetchGalleryItems();
  _galleryItemsCache = items; // cache for search
  renderGroupedGallery(items);
}

function renderGroupedGallery(items) {
  const container = document.getElementById('galleryGroupsContainer');
  if (!container) return;

  // Clear existing groups (except no-results div)
  const noResults = document.getElementById('galleryNoResults');
  container.innerHTML = '';
  if (noResults) container.appendChild(noResults);

  if (!items || items.length === 0) {
    if (noResults) noResults.style.display = 'block';
    return;
  } else {
    if (noResults) noResults.style.display = 'none';
  }

  // Group items by type
  const groups = {};
  items.forEach(item => {
    const type = item.type || 'Other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(item);
  });

  // Create DOM for each group
  Object.keys(groups).sort().forEach(type => {
    const groupItems = groups[type];
    const groupId = `galleryGroup-${type.replace(/\s+/g, '-')}`;
    
    const groupDiv = document.createElement('div');
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `expand-${groupId}`;
    checkbox.className = 'expand-checkbox';
    checkbox.checked = true; // Default expanded
    // checkbox.setAttribute('save', ''); // Optional: save state

    const label = document.createElement('label');
    label.htmlFor = `expand-${groupId}`;
    label.className = 'expand-label expand-btn relative gallery-group-title';
    label.dataset.for = type;
    // Capitalize first letter
    const displayType = type.charAt(0).toUpperCase() + type.slice(1);
    label.textContent = `${displayType} (${groupItems.length})`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'gallery-group expand-content gallery-grid scroll-container';
    contentDiv.id = `${groupId}-list`;

    groupDiv.appendChild(checkbox);
    groupDiv.appendChild(label);
    groupDiv.appendChild(contentDiv);
    container.insertBefore(groupDiv, noResults);

    // Render items
    renderGalleryItems(groupItems, `${groupId}-list`);
  });
}

// Wait until app.js has loaded (import functions may be defined there).
window.addEventListener('load', () => {
  renderGallery();
  // Wire search input
  const searchInput = document.getElementById('gallerySearch');
  const clearBtn = document.getElementById('gallerySearchClear');
  if (searchInput) {
    const doSearch = debounce((e) => {
      const q = (e.target?.value || '').trim().toLowerCase();
      if (!q) {
        renderGroupedGallery(_galleryItemsCache || []);
        return;
      }
      // filter _galleryItemsCache
      const filtered = (_galleryItemsCache || []).filter(item => {
        const title = (item.title || '').toLowerCase();
        const author = (item.author || '').toLowerCase();
        const desc = (item.shortDescription || '').toLowerCase();
        return title.includes(q) || author.includes(q) || desc.includes(q);
      });
      // Render filtered
      renderGroupedGallery(filtered);
    }, 200);
    searchInput.addEventListener('input', doSearch);
  }
  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
    });
  }
});
