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

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = item.title || '';

  const img = document.createElement('img');
  img.className = 'preview';
  img.src = item.image || '';
  img.loading = 'lazy';
  img.alt = item.title || '';
  img.addEventListener('click', () => {
    if (item.image) window.open(item.image, '_blank', 'noopener noreferrer');
  });

  const desc = document.createElement('div');
  desc.className = 'shortDescription';
  desc.textContent = item.shortDescription || '';

  const author = document.createElement('div');
  author.className = 'author';
  const authorName = document.createElement('span');
  authorName.textContent = item.author || '';
  author.appendChild(authorName);
  if (item.page) {
    const a = document.createElement('a');
    a.href = item.page;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = 'Open author page';
    a.className = 'icon-link';
    a.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i>';
    // Add small margin
    author.appendChild(a);
  }

  // Wrap content into a right-side content column
  const content = document.createElement('div');
  content.className = 'content';

  const actions = document.createElement('div');
  actions.className = 'gallery-actions';

  const setupBtn = document.createElement('button');
  setupBtn.className = 'button setup-button';
  setupBtn.textContent = 'Use Setup';
  setupBtn.addEventListener('click', async () => {
    try {
      hideWindow('galleryBox');
      setupBtn.disabled = true;
      await useSetup(item.setup || item.project);
    } finally {
      setupBtn.disabled = false;
    }
  });
  // If there's no setup or project, disable this action
  if (!item.setup && !item.project) setupBtn.disabled = true;

  const projectBtn = document.createElement('button');
  projectBtn.className = 'button project-button';
  projectBtn.textContent = 'Use Full Project';
  projectBtn.addEventListener('click', async () => {
    try {
      hideWindow('galleryBox');
      projectBtn.disabled = true;
      await useFullProject(item.project);
    } finally {
      projectBtn.disabled = false;
    }
  });
  if (!item.project) projectBtn.disabled = true;

  actions.appendChild(setupBtn);
  actions.appendChild(projectBtn);

  // Order: title, description, author, then actions (buttons)
  content.appendChild(title);
  content.appendChild(desc);
  content.appendChild(author);
  content.appendChild(actions);

  el.appendChild(img);
  el.appendChild(content);

  return el;
}

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
  const presets = (items || []).filter(item => !item.project);
  const projects = (items || []).filter(item => item.project);
  renderGalleryItems(presets, 'galleryPresetsList');
  renderGalleryItems(projects, 'galleryProjectsList');
  const noResults = document.getElementById('galleryNoResults');
  if (noResults) {
    const total = (presets.length || 0) + (projects.length || 0);
    noResults.style.display = total === 0 ? 'block' : 'none';
  }
  // Update group titles with counts
  const presetsTitle = document.querySelector('.gallery-group-title[data-for="presets"]') || document.querySelectorAll('.gallery-group-title')[0];
  const projectsTitle = document.querySelector('.gallery-group-title[data-for="projects"]') || document.querySelectorAll('.gallery-group-title')[1];
  if (presetsTitle) presetsTitle.textContent = `Presets (${presets.length})`;
  if (projectsTitle) projectsTitle.textContent = `Projects (${projects.length})`;
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
