// ======================
// Jellyfin Functions
// ======================
function CreateJellyfin() {
  const server = document.getElementById("Server").value;
  const username = document.getElementById("Username").value;
  const password = document.getElementById("Password").value;
  const OnFail = (message) => {
    jellyfinloginActionBtn.removeAttribute('inactive')
    showWindow("loginBox");
    document.querySelector("#rightSide").style.display = "none";
    document.getElementById("loginBtn").setAttribute('logged-in', 'false')
    document.querySelector("#jellyfinContent").style.display = "none";
    document.getElementById('loginErrorMessage').innerText = message;
  }
  window.jellyfin = new Jellyfin(server, username, password, {
    onLoginError: () => {
      OnFail("Authentication failed. Please check your credentials.")
    },
    onServerSetupError: () => {
      OnFail("Server is offline. Please check the address.")
    },
    onLoginSuccess: () => {
      hideWindow("loginBox");

      document.getElementById("loginBtn").setAttribute('logged-in', 'true')      
      document.querySelector("#rightSide").style.display = "block";
      document.querySelector("#jellyfinContent").style.display = "block";
      setTimeout(() => Setup.loadingType = window.jellyfin.Server.Speed.time > 100 ? 'lazy' : 'eager', 200);
    },
    onLibraryLoad: () => {
      makeDetailList(jellyfinsearchInput, jellyfin.searchParams.Genres, true);
      searchOnLibrary(null, null);
    },
    onSearchFinish: () => {
      fillJellyfinContainerAttr();
      jellyfinPreviousPageBtn?.setAttribute('disabled', !jellyfin.searchParams.hasPreviousPage);
      jellyfinNextPageBtn?.setAttribute('disabled', !jellyfin.searchParams.hasNextPage)
    }
  });
  return window.jellyfin;
}

function Login() {
  // if jellyfinloginActionBtn is inactive, just skip
  if (jellyfinloginActionBtn.getAttribute('inactive'))
    return;
  const server = document.getElementById("Server").value
  const username = document.getElementById("Username").value
  const password = document.getElementById("Password").value
  jellyfinloginActionBtn.setAttribute('inactive', 'true')
  jellyfin.UpdateConfig(server, username, password)
}

function loadLibraries(el) {
  jellyfinsearchInput.value = "";
  Setup.Library.loadedLibrary = "";
  jellyfin.searchParams.Library = "";
  if(el instanceof HTMLElement) {
    jellyfinContainer.removeAttribute("search-name");
    jellyfinContainer.removeAttribute("search-library");
    jellyfinContainer.removeAttribute("search-page");
    jellyfinContainer.removeAttribute("search-limit");
    jellyfinContainer.removeAttribute("search-offset");
    jellyfinContainer.removeAttribute("search-hasNextPage");
  }
  
  clearJellyfinWindow();
  for (const lName in jellyfin.Libraries)
    addLibrarycover(jellyfin.Libraries[lName].Id, jellyfin.Libraries[lName].Name)
}

function clearJellyfinWindow() {
  jellyfinContainer.innerHTML = "";
}

function libraryImagetoCanvas(el) {
  img = new Image()
  img.crossOrigin = "anonymous"; // Add this line
  const id = el.getAttribute('library-id')
  img.src = jellyfin.makeImageUrl(id, canvas.width, canvas.height, 100)
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
}

function selectLibrary(el) {
  //["Random", "Name", "OfficialRating", "CommunityRating", "ProductionYear", "PremiereDate"]
  jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[1]
  Setup.Library.loadedLibrary = el.getAttribute('library-name');
  jellyfin.searchParams.Name = ""
  jellyfin.searchParams.Library = Setup.Library.loadedLibrary
  jellyfin.searchParams.page = 1
  jellyfin.searchParams.offset = 0
  jellyfin.searchParams.hasNextPage = true
  jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[1]
  clearJellyfinWindow();
  jellyfinsearchInput.value = "";
  searchOnLibrary(null, null);
}

function fillposters(items, clear = true) {
  return new Promise((resolve) => {
    if(clear)
      clearJellyfinWindow();
    
    if(amountImagesNeeded() <= 0)
      return resolve();
    
    const posterPromises = items.map(poster => {
      return new Promise(resolveposter => {
        addVideoposter(poster);
        resolveposter();
      });
    });
    
    Promise.all(posterPromises).then(() => {
      jellyfinContainer.scrollTop = 0;
      resolve();
    });
  });
}

function setpostersLimit(limit) {
  const customInput = document.getElementById('customPostersLimit');
  const selectElement = document.getElementById('posterslimit');
  
  if(limit === null || limit === undefined)
    limit = selectElement.value;
  
  // Show/hide custom input based on selection
  if (limit === 'custom') {
    customInput.style.display = 'inline-block';
    customInput.focus(); // Focus on input for better UX
    return; // Don't trigger search yet
  } else {
    customInput.style.display = 'none';
    limit = parseInt(limit);
  }
  
  if (isNaN(limit))
    return;
    
  jellyfin.searchParams.limit = limit;
  jellyfin.searchParamsToRestore.limit = limit;
  if(jellyfinContainer.hasAttribute("search-limit"))
    jellyfinContainer.setAttribute("search-limit", limit)
  searchOnLibrary(null, null);
}

function saveCustomPostersLimits() {
  const selectElement = document.getElementById('posterslimit');
  const defaultValues = ['10', '20', '50', '100', 'custom'];
  
  // Get all custom numeric options (not in default list)
  const customOptions = Array.from(selectElement.options)
    .filter(opt => !defaultValues.includes(opt.value))
    .map(opt => parseInt(opt.value))
    .filter(val => !isNaN(val));
  
  localStorage.setItem('customPostersLimits', JSON.stringify(customOptions));
}

function loadCustomPostersLimits() {
  const selectElement = document.getElementById('posterslimit');
  const saved = localStorage.getItem('customPostersLimits');
  
  if (!saved) return;
  
  try {
    const customLimits = JSON.parse(saved);
    customLimits.forEach(limit => {
      addCustomLimitOption(limit, false); // false = don't save again
    });
  } catch (e) {
    console.error('Failed to load custom posters limits:', e);
  }
}

function addCustomLimitOption(customValue, shouldSave = true) {
  const selectElement = document.getElementById('posterslimit');
  
  // Check if this custom value already exists in options
  const existingOption = Array.from(selectElement.options).find(option => option.value === customValue.toString());
  
  if (existingOption) return; // Already exists
  
  // Get all numeric options (excluding 'custom')
  const numericOptions = Array.from(selectElement.options)
    .filter(opt => opt.value !== 'custom' && !isNaN(parseInt(opt.value)))
    .map(opt => parseInt(opt.value));
  
  // Add the new value and sort
  numericOptions.push(customValue);
  numericOptions.sort((a, b) => a - b);
  
  // Find the correct position to insert
  const insertIndex = numericOptions.indexOf(customValue);
  const customOption = selectElement.querySelector('option[value="custom"]');
  
  // Create new option
  const newOption = document.createElement('option');
  newOption.value = customValue.toString();
  newOption.text = customValue.toString();
  
  // Insert at the correct sorted position
  if (insertIndex === numericOptions.length - 1) {
    // Insert before 'custom' if it's the largest value
    selectElement.insertBefore(newOption, customOption);
  } else {
    // Insert before the next larger value
    const nextValue = numericOptions[insertIndex + 1];
    const nextOption = selectElement.querySelector(`option[value="${nextValue}"]`);
    selectElement.insertBefore(newOption, nextOption);
  }
  
  // Save to localStorage if needed
  if (shouldSave) {
    saveCustomPostersLimits();
  }
}

function applyCustomPostersLimit() {
  const customInput = document.getElementById('customPostersLimit');
  const selectElement = document.getElementById('posterslimit');
  const customValue = parseInt(customInput.value);
  
  if (isNaN(customValue) || customValue <= 0) {
    return; // Invalid value, do nothing
  }
  
  // Add the option (will save to localStorage)
  addCustomLimitOption(customValue, true);
  
  // Select the new/existing custom value
  selectElement.value = customValue.toString();
  customInput.style.display = 'none';
  
  // Apply the limit
  setpostersLimit(customValue);
}

async function searchOnLibrary(Qry, force = false, useDelay = false) {
  if (!jellyfin.areLibrariesLoaded)
    return;
  jellyfin.setDelay(useDelay == true ? 400 : 0)
  const searchQuery = typeof Qry == "string" ? Qry : jellyfinsearchInput.value;
  jellyfin.searchParams.Name = searchQuery;
  if(!force) {
    if (!searchQuery) {
      if(!Setup.Library.loadedLibrary || Setup.Library.loadedLibrary == "null")
        return loadLibraries()
    } else
      jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[1]
  }
  fillposters(await jellyfin.searchItems(searchQuery, Setup.Library.loadedLibrary, null, null), true)
}

function filterRandom() {
  //["Random", "Name", "OfficialRating", "CommunityRating", "ProductionYear", "PremiereDate"]
  jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[0]
  jellyfin.searchParams.offset = 0;
  jellyfin.searchParams.limit = jellyfin.searchParamsToRestore.limit;
  searchOnLibrary(null, true, false);
}

async function nextPage() {
  jellyfin.setDelay(0)
  const posters = await jellyfin.nextPage();
  if (posters)
    fillposters(posters, true);
}

async function previousPage() {
  jellyfin.setDelay(0)
  const posters = await jellyfin.previousPage();
  if (posters)
    fillposters(posters, true);
}

async function returnToSearch() {
  if(jellyfinContainer.hasAttribute("search-name"))
    jellyfin.searchParams.Name = jellyfinContainer.getAttribute("search-name")
  if(jellyfinContainer.hasAttribute("search-library"))
    jellyfin.searchParams.Library = jellyfinContainer.getAttribute("search-library")
  if(jellyfinContainer.hasAttribute("search-page"))
    jellyfin.searchParams.page = parseInt(jellyfinContainer.getAttribute("search-page"))
  if(jellyfinContainer.hasAttribute("search-limit"))
    jellyfin.searchParams.limit = parseInt(jellyfinContainer.getAttribute("search-limit"))
  if(jellyfinContainer.hasAttribute("search-offset"))
    jellyfin.searchParams.offset = parseInt(jellyfinContainer.getAttribute("search-offset"))
  if(jellyfinContainer.hasAttribute("search-hasNextPage"))
    jellyfin.searchParams.hasNextPage = jellyfinContainer.getAttribute("search-hasNextPage") == "true"
  jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[1]
  Setup.Library.loadedLibrary = jellyfin.searchParams.Library;
  clearJellyfinWindow();
  jellyfinContainer.value = jellyfin.searchParams.Name;
  searchOnLibrary(null, null);
}

function fillJellyfinContainerAttr() {
  jellyfinContainer.setAttribute("search-name", jellyfin.searchParams.Name);
  jellyfinContainer.setAttribute("search-library", jellyfin.searchParams.Library);
  jellyfinContainer.setAttribute("search-page", jellyfin.searchParams.page);
  jellyfinContainer.setAttribute("search-limit", jellyfin.searchParams.limit);
  jellyfinContainer.setAttribute("search-offset", jellyfin.searchParams.offset);
}

function selectImageToSlot(poster) {
  if (!poster) return;
  const imageUrl = jellyfin.makeImageUrl(poster.getAttribute("item-id"), null, null, 100)
  if (!imageUrl) return;
  loadImageIntoSlot(imageUrl)
}

function addVideoposter(item) {
  if (!item) return;
  
  const clone = posterTemplate.content.cloneNode(true);
  const preview = clone.querySelector('.preview');
  const label = clone.querySelector('span');
  label.innerHTML = item.Name;
  const image = jellyfin.makeImageUrl(item.Id, Setup.Sizes.poster.width, Setup.Sizes.poster.height, Setup.Sizes.poster.quality)
  preview.setAttribute('item-id', item.Id);
  preview.setAttribute('item-name', item.Name);
  preview.setAttribute('loading', Setup.loadingType)
  preview.src = image;
  preview.onclick = () => selectImageToSlot(preview);
  jellyfinContainer.appendChild(clone);
}

function addLibrarycover(id, name) {
  const clone = coverTemplate.content.cloneNode(true);
  const preview = clone.querySelector('.preview');
  const label = clone.querySelector('span');
  label.innerHTML = name;
  const image = jellyfin.makeImageUrl(id, Setup.Sizes.cover.width, Setup.Sizes.cover.height, Setup.Sizes.cover.quality)
  preview.setAttribute('library-id', id);
  preview.setAttribute('library-name', name);
  preview.setAttribute('loading', Setup.loadingType);
  preview.src = image;

  preview.onclick = () => selectLibrary(preview);
  jellyfinContainer.appendChild(clone);
}