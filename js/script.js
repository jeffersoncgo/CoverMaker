if (typeof module != 'undefined') {
  utils = require("../../scripts/components/utils/common");
  Jellyfin = require("./jellyfin");
}


// ======================
// Global Variables
// ======================
const slotsImages = []; // Global array to store slotsImages for each slot

window.Tabs = {}; // Will store tab elements

// ======================
// Some Config Functions
// ======================

const Setup = {
  "Banner": {
    width: 480,
    height: 270,
    quality: 80,
  },
  "Cover": {
    width: 270,
    height: 480,
    quality: 90,
  },
  "Library": {
    loadedLibrary: null
  },
  "Images": {
    "loading": "images/loading.gif",
    "error": "images/error.png",
  }
}

// ======================
// Initialization
// ======================
const canvas = document.getElementById("myCanvas");
const template = document.getElementById('slot-template');
const bannerTemplate = document.getElementById('banner-template');
const coverTemplate = document.getElementById('cover-template');
const imageSlots = document.getElementById('image-slots');
const jellyfinContainer = document.getElementById('jellyfinimages'); // container element in DOM
const jellyfinsearchInput = document.getElementById('searchInput');
const jellyfinloginActionBtn = document.getElementById('loginAction');
const jellyfinPreviousPageBtn = document.getElementById('previousPage');
const jellyfinNextPageBtn = document.getElementById('nextPage');

// ======================
// Storage Functions
// ======================
function saveFieldsToStorage() {
  if (document.getElementById("Server").value.endsWith("/")) {
    document.getElementById("Server").value = document.getElementById("Server").value.slice(0, -1);
  }
  const server = document.getElementById("Server").value;
  const username = document.getElementById("Username").value;
  const password = document.getElementById("Password").value;
  localStorage.setItem("server", server);
  localStorage.setItem("username", username);
  localStorage.setItem("password", password);
}

function loadFieldsFromStorage() {
  const server = localStorage.getItem("server");
  const username = localStorage.getItem("username");
  const password = localStorage.getItem("password");
  if (server) document.getElementById("Server").value = server;
  if (username) document.getElementById("Username").value = username;
  if (password) document.getElementById("Password").value = password;
}

// ======================
// Tab Functions
// ======================
function changeTab(e) {
  if (!e) return;
  for (const tabName in window.Tabs) {
    window.Tabs[tabName].tab.classList.remove("active");
    window.Tabs[tabName].content.classList.remove("active");
  }
  focusTabName = e.id.split("Tab")[0];
  window.Tabs[focusTabName].tab.classList.add("active");
  window.Tabs[focusTabName].content.classList.add("active");
}

// ======================
// Image Handling Functions
// ======================
function loadImage(file) {
  if(!file)
    return;
  file = file instanceof Image ? file.src : file;
  if (typeof file == "string") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = file;
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      loadImage(e.target.result).then(resolve).catch(reject)
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageIntoSlot(image, slotIndex) {
  slotIndex ??= slotsImages.findIndex(img => !img);
  if (slotIndex === -1)
    alert('All slots filled! Remove an image or add more slots.');
  const preview = getSlotPreviewByIndex(slotIndex);
  preview.src = Setup.Images.loading;
  loadImage(image).then(img => {
    slotsImages[slotIndex] = img;
    setSlotImage(slotIndex, img);
  }).catch(err => {
    preview.src = Setup.Images.error;
    console.error('Failed to load image:', err);
  })
}

function updatePreview(slot, img) {
  try {
    const preview = getSlotPreviewByIndex(slot);
    const fileInput = getFileInputByIndex(slot);
    fileInput.value = '';
    preview.src = img === null ? "" : img?.src || Setup.Images.error;
    drawComposite();
  } catch (error) {
    console.error(error);
  }
}

function blurImage(img, size) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  ctx.filter = `blur(${size}px)`;
  ctx.drawImage(canvas, 0, 0);
  return canvas;
}

function SlotImageOnLoad(el) {
  // el.src = Setup.Images.loading
};

function SlotImageOnError(el) {
  el.src = Setup.Images.error
};

// ======================
// Slot Management
// ======================
function getSlotByIndex(index) {
  return imageSlots.children[index];
}

function getIndexBySlot(slot) {
  return [...imageSlots.children].indexOf(slot);
}

function getSlotPreviewByIndex(indexOrSlot) {
  try {
    if (typeof indexOrSlot === 'number')
        indexOrSlot = getSlotByIndex(indexOrSlot)
    return indexOrSlot.querySelector('.preview');
  } catch (error) {
    console.error(error);
  }
}

function getFileInputByIndex(indexOrSlot) {
  if (typeof indexOrSlot === 'number')
    indexOrSlot = getSlotByIndex(indexOrSlot)
  return indexOrSlot.querySelector('.fileInput');
}

function addImageSlot() {
  slotsImages.push(null);
  const clone = template.content.cloneNode(true);
  imageSlots.appendChild(clone);
  imageSlots.setAttribute('slotsCount', slotsImages.length)
  drawComposite();
}

function deleteImageSlot(index = -1) {
  try {
    if (index < 0)
      index = slotsImages.length + index;
    slotsImages.splice(index, 1);
    const slot = getSlotByIndex(index);
    slot.remove();
    imageSlots.setAttribute('slotsCount', slotsImages.length)
    drawComposite();
  } catch (error) {
    console.error(error);
  }
}

function moveSlotUp(e) {
  const slotIndex = getIndexFromButtonClick(e);
  if(slotIndex === 0) 
    return;
  moveImageSlot(slotIndex, slotIndex - 1)
}

function moveSlotDown(e) {
  const slotIndex = getIndexFromButtonClick(e);
  if(slotIndex >= slotsImages.length - 1)
    return;
  moveImageSlot(slotIndex, slotIndex + 1)
}

function moveImageSlot(indexSource, indexTarget) {
  if (indexSource === indexTarget || indexSource < 0 || indexSource >= slotsImages.length || indexTarget < 0 || indexTarget >= slotsImages.length) return;
  
  const sourceEl = getSlotByIndex(indexSource);
  let targetEl = getSlotByIndex(indexTarget);
  
  if (indexSource < indexTarget)
    targetEl = targetEl.nextSibling;
  
  sourceEl.parentNode.insertBefore(sourceEl, targetEl);
  
  const img = slotsImages.splice(indexSource, 1)[0];
  slotsImages.splice(indexTarget, 0, img);
  drawComposite();
}

function clearImageSlot(index) {
  slotsImages[index] = null;
  setSlotImage(index, null)
}

function clearAllSlots() {
  slotsImages.forEach((_, index) => clearImageSlot(index));
  // drawComposite();
}

function setSlots(Destcount = parseInt(imageSlots.getAttribute('slotsCount'))) {
  Destcount = typeof Destcount !== "number" ? parseInt(Destcount.getAttribute('slotsCount')) : Destcount;
  const change = imageSlots.childElementCount - Destcount;
  const func = (change < 0) ? addImageSlot : deleteImageSlot;
  for (let i = 0; i < Math.abs(change); i++)
    func();
}

function setSlotImage(index, imgOrSrc) {
  if (index < 0 || index >= slotsImages.length) return;
  const slot = getSlotByIndex(index);
  if (!imgOrSrc) {
    slotsImages[index] = null;
    updatePreview(slot, null);
    return;
  }
  loadImage(imgOrSrc).then(img => {
    slotsImages[index] = img;
    updatePreview(slot, img);
  }).catch(err => {
    console.error('Failed to load image:', err);
  })
}

function getSlotImageUrl(el) {
  const src = el.getAttribute('src');
  if (!src)
    return;
  return src;
}

function reloadSlotImage(el) {
  const index = getIndexBySlot(el.parentElement);
  setSlotImage(index, getSlotImageUrl(el));
}

async function getRandomImages(count) {
  let items;
  try {
    if (!jellyfin.areLibrariesLoaded)
      return [];
    jellyfin.backupSearchParams();

    jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[0]
    jellyfin.searchParams.limit = count;
    jellyfin.searchParams.offset = 0;
    jellyfin.searchParams.page = 1;
    jellyfin.searchParams.hasNextPage = true;

    items = await jellyfin.searchItems(null, null, null);
    if (!items)
      throw new Error('')
  } catch (error) {
    console.error(error);
  } finally {
    jellyfin.restoreSearchParams();
    fillJellyfinContainerAttr()
    return items;
  }
}

async function fillSlotsRandomly() {
  const previews = []
  previews.length = slotsImages.length;
  for (let i = 0; i < slotsImages.length; i++) {
    const slot = getSlotByIndex(i);
    if (!slot?.classList.contains('pinned')) {
      const preview = getSlotPreviewByIndex(i);
      previews[i] = preview
      preview.src = Setup.Images.loading;
      slotsImages[i] = null
      drawComposite()
    }
  }
  const items = await getRandomImages(previews.length);
  if (!items || items.length == 0) {
    for (let i = 0; i < previews.length; i++) {
      if(previews[i])
        previews[i].src = Setup.Images.error
    }
    return jellyfin.restoreSearchParams();
  }
  for (let i = 0; i < previews.length; i++) {
    if(!previews[i])
      continue;
    const item = items[i];
    const imageUrl = jellyfin.makeImageUrl(item.Id, null, null, null);
    if (!imageUrl)
      continue;
    loadImageIntoSlot(imageUrl, i);
  }
}

async function radomizeSlotImage(el) {
  const index = getIndexFromButtonClick(el);
  slotsImages[index] = null
  drawComposite()
  const preview = getSlotPreviewByIndex(index);
  preview.src = Setup.Images.loading;
  const items = await getRandomImages(1);
  const item = items[0];
  if (!item) {
    jellyfin.restoreSearchParams();
    preview.src = Setup.Images.error;
  }
  setSlotImage(index, jellyfin.makeImageUrl(item.Id, null, null, null));
}

function toggleSlotPin(el) {
  const slot = getSlotByIndex(getIndexFromButtonClick(el));
  slot.classList.toggle('pinned');
  el.classList.toggle('fa-thumbtack');
  el.classList.toggle('fa-thumbtack-slash');
}

function localImageInputChanged(el) {
  const index = getIndexBySlot(el.parentElement);
  if(el.files.length == 0)
    return
  if (el.files && el.files[0]) {
    loadImage(el.files[0])
      .then((img) => {
        slotsImages[index] = img;
        setSlotImage(index, img);
      })
      .catch((err) => {
        console.error(err);
        alert("An error occurred loading the image.");
      }).finally(() => delete el.files[0])
  }

}
function loadLocalImage(el) {
  const index = getIndexFromButtonClick(el);
  const fileInput = getFileInputByIndex(index)
  fileInput.click();
}


function selectImageToSlot(cover) {
  if (!cover) return;
  const imageUrl = jellyfin.makeImageUrl(cover.getAttribute("item-id"), null, null, 100)
  if (!imageUrl) return;
  loadImageIntoSlot(imageUrl)
}

function addVideoCover(item) {
  const clone = coverTemplate.content.cloneNode(true);
  const preview = clone.querySelector('.preview');
  const label = clone.querySelector('label');
  label.innerHTML = item.Name;
  const image = jellyfin.makeImageUrl(item.Id, Setup.Cover.width, Setup.Cover.height, Setup.Cover.quality)
  preview.setAttribute('item-id', item.Id);
  preview.setAttribute('item-name', item.Name);
  preview.src = image;
  preview.onclick = () => selectImageToSlot(preview);
  jellyfinContainer.appendChild(clone);
}

function addLibraryBanner(id, name) {
  const clone = bannerTemplate.content.cloneNode(true);
  const preview = clone.querySelector('.preview');
  const label = clone.querySelector('label');
  label.innerHTML = name;
  const image = jellyfin.makeImageUrl(id, Setup.Banner.width, Setup.Banner.height, Setup.Banner.quality)
  preview.setAttribute('library-id', id);
  preview.setAttribute('library-name', name);
  preview.src = Setup.Images.loading;
  preview.src = image;

  preview.onclick = () => selectLibrary(preview);
  jellyfinContainer.appendChild(clone);
}

// ======================
// Drag and Drop Functions
// ======================

function slotAllowDrop(event) {
  event.preventDefault(); // 💥 Necessary to allow the drop
  event.currentTarget.classList.add('dragover');
}

function slotOnDropImage(event, el) {
  try {
    event.preventDefault();
    el.classList.remove('dragover');
    
    const data = JSON.parse(event.dataTransfer.getData("application/json"));
    if (!data)
      return;
    const index = getIndexBySlot(el);
    const value = data.value;
    if (data.type == "move") {
      moveImageSlot(value, index);
      return;
    }
    if (data.type == "cover") {
      loadImageIntoSlot(value, index);
    }
  } catch (error) {}
}

function onCoverDragStart(event) {
  const imageUrl = jellyfin.makeImageUrl(event.target.getAttribute("item-id"), null, null, 100);
  event.dataTransfer.setData("application/json", JSON.stringify({type: "cover", value: imageUrl}));
}

function onSlotDragToMove(event) {
  const index = getIndexBySlot(event.target.parentElement)
  event.dataTransfer.setData("application/json", JSON.stringify({type: "move", value: index}));
}

// ======================
// Slot Buttos Click Functions
// ======================
function getIndexFromButtonClick(e) {
  try {
    const slot = e.parentElement.parentElement;
    if (!slot.classList.contains('slot'))
      return;
    return [...imageSlots.children].indexOf(slot);
  } catch (error) {
    console.error(error);
  }
}

function clearButtonClick(e) {
  clearImageSlot(getIndexFromButtonClick(e));
}

function deleteButtonClick(e) {
  deleteImageSlot(getIndexFromButtonClick(e));
}

// ======================
// Canvas Drawing Functions
// ======================
function drawComposite() {
  const ctx = canvas.getContext("2d");
  
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Fill background with black
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const reflectionScale = parseFloat(document.getElementById("reflexDistance").value) || 0;
  const reflectionDistance = parseFloat(document.getElementById("reflexScale").value) || 0;
  const baseScale = parseFloat(document.getElementById("posterScale").value) || 1.5;
  
  // Define overall dimensions for each slot
  const slotWidth = canvas.width / slotsImages.length;
  const slotTotalHeight = canvas.height / 2;
  const realHeight = slotTotalHeight * baseScale;
  const reflectionHeight = slotTotalHeight * reflectionDistance;
  const targetRatio = slotWidth / realHeight;
  
  // Margin size
  const spacing = parseFloat(document.getElementById("spaceSize").value) || 0;
  const blurAmount = parseInt(document.getElementById("blurSize").value) || 0;
  
  slotsImages.forEach((img, i) => {
    if (img) {
      let sx, sy, sWidth, sHeight;
      const imgRatio = img.width / img.height;
      
      // Crop the image to match the target aspect ratio
      if (imgRatio > targetRatio) {
        sHeight = img.height;
        sWidth = sHeight * targetRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.width;
        sHeight = sWidth / targetRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
      }
      
      const dx = i * (slotWidth + spacing) - spacing;
      const dy = 0;
      
      sWidth -= spacing * 2;
      sHeight -= spacing * 2;
      
      // Draw the "real" image
      ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, slotWidth, realHeight);
      
      // Draw the Reflection
      const blurredImg = blurImage(img, blurAmount);
      ctx.save();
      ctx.translate(dx, realHeight + reflectionHeight);
      ctx.scale(1, -1);
      ctx.drawImage(blurredImg, sx, sy, sWidth, sHeight, 0, 0, slotWidth, reflectionHeight);
      ctx.restore();
      
      // Apply Reflection Fade Effect
      const gradient = ctx.createLinearGradient(0, realHeight, 0, realHeight + reflectionHeight);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.12)");
      gradient.addColorStop(reflectionScale, "rgba(0, 0, 0, 1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(dx, realHeight, slotWidth, reflectionHeight);
    }
  });

  // Draw Overlay
  const overlayOpacity = parseFloat(document.getElementById("overlayOpacity").value) || 0;
  ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Overlay Text
  const overlayText = document.getElementById("overlayText").value || "";
  const fontFamily = document.getElementById("fontSelect").value;
  const fontSize = document.getElementById("fontSize").value || 36;
  const fontColor = document.getElementById("fontColor").value || "white";
  const fontOpacity = parseFloat(document.getElementById("fontOpacity").value) || 0;
  const bold = document.getElementById("boldCheckbox").checked;
  const fontStyle = (bold ? "bold" : "normal") + " " + fontSize + "px " + fontFamily;
  
  ctx.font = fontStyle;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const r = parseInt(fontColor.slice(1, 3), 16);
  const g = parseInt(fontColor.slice(3, 5), 16);
  const b = parseInt(fontColor.slice(5, 7), 16);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fontOpacity})`;
  ctx.fillText(overlayText, canvas.width / 2, canvas.height / 2);
}

// ======================
// Export Functions
// ======================

function exportAsPNG() {
  const dataURL = canvas.toDataURL("image/png");
  const fileName = utils.safeWindowsFileName(document.getElementById("overlayText").value || "composite") + '.png'
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openInNewTab(source) {
  let dataURL = "";
  if (source?.target?.id == "openTabBtn")
    dataURL = canvas.toDataURL("image/png");
  else {
    const slotImage = getSlotPreviewByIndex(getIndexFromButtonClick(source))
    if (slotImage)
      dataURL = slotImage.getAttribute('src');
    else
      return;
  }
  const fileName = utils.safeWindowsFileName(document.getElementById("overlayText").value || "composite") + '.png'
  const tab = window.open();

  const previewHTML = `
  <body style="margin:0; background-color:#121212; overflow:auto; display:flex; align-items:center; justify-content:center;">
  <img id="preview" onload="window.stop()" src="${dataURL}" style="transform-origin: top center; transition: transform 0.15s ease-out; max-width: none; max-height: none; cursor: zoom-in;">
<script>
    const img = document.getElementById("preview");
    let scale = 1;
    let isToggled = false;

    img.addEventListener("click", () => {
      if (scale === 1) {
        scale = 2; // zoom in
        img.style.cursor = "zoom-out";
      } else {
        scale = 1; // reset
        img.style.cursor = "zoom-in";
      }
      img.style.transform = \`scale(\${scale})\`;
      isToggled = scale > 1;
    });
  </script>
  </body>
  `

  tab.document.write(previewHTML);
  tab.document.title = fileName;
}

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
    onLoginError: () => (OnFail("Authentication failed. Please check your credentials.")),
    onServerSetupError: () => (OnFail("Server is offline. Please check the address.")),
    onLoginSuccess: () => {
      hideWindow("loginBox");
      document.getElementById("loginBtn").setAttribute('logged-in', 'true')      
      document.querySelector("#rightSide").style.display = "block";
      document.querySelector("#jellyfinContent").style.display = "block";
    },
    onLibraryLoad: () => searchOnLibrary(null, null),
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
  Setup.Library.loadedLibrary = null;
  jellyfin.searchParams.Library = null;
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
    addLibraryBanner(jellyfin.Libraries[lName].Id, jellyfin.Libraries[lName].Name)
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

function fillCovers(items) {
  clearJellyfinWindow()
  items.forEach(addVideoCover)
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
  fillCovers(await jellyfin.searchItems(searchQuery, Setup.Library.loadedLibrary, null))
}

function filterRandom() {
  //["Random", "Name", "OfficialRating", "CommunityRating", "ProductionYear", "PremiereDate"]
  jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[0]
  jellyfin.searchParams.offset = 0;
  jellyfin.searchParams.limit = 10;
  searchOnLibrary(null, true, false);
}

async function nextPage() {
  jellyfin.setDelay(0)
  const covers = await jellyfin.nextPage();
  if (covers)
    fillCovers(covers);
}

async function previousPage() {
  jellyfin.setDelay(0)
  const covers = await jellyfin.previousPage();
  if (covers)
    fillCovers(covers);
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

const searchController = new Controller(searchOnLibrary);
searchOnLibrary = searchController;
searchOnLibrary.Controller = searchController;
searchOnLibrary = searchOnLibrary.exec.bind(searchOnLibrary);

// ======================
// Event Listeners
// ======================

document.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      loadImageIntoSlot(item.getAsFile());
      break;
    }
  }
});

jellyfinsearchInput.addEventListener('input', () => {
  jellyfin.backupSearchParams();
  jellyfin.searchParams.offset = 0;
  jellyfin.searchParams.page = 1;
  jellyfin.searchParams.sortBy = jellyfin.searchParams.choices.sortBy[1]
  searchOnLibrary(null, true, true).then(() => {
    // jellyfin.restoreSearchParams();
    fillJellyfinContainerAttr();
  })
})
jellyfinloginActionBtn.addEventListener('click', Login)

// Auto-update canvas when settings change
const settingsInputs = document.querySelectorAll("#overlayText, #fontSelect, #fontSize, #boldCheckbox, #overlayOpacity, #fontColor, #fontOpacity, #spaceSize, #reflexDistance, #reflexScale, #blurSize, #posterScale");
settingsInputs.forEach((input) => {
  input.addEventListener("input", drawComposite);
});

// Export buttons
document.getElementById("exportBtn").addEventListener("click", exportAsPNG);
document.getElementById("openTabBtn").addEventListener("click", openInNewTab);

function dummyStart() {
  // Add initial slots
  setSlots(4);
  // Load default slotsImages
  ["images/img_1.jpg", "images/img_2.jpg", "images/img_3.jpg", "images/img_4.jpg","images/img_1.jpg", "images/img_2.jpg", "images/img_3.jpg", "images/img_4.jpg","images/img_1.jpg", "images/img_2.jpg"].forEach((src, i) => {
    if (i >= slotsImages.length)
      return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      slotsImages[i] = img;
      setSlotImage(i, img)
    };
    img.src = src;
  });
}

// dummyStart();

// On window load
window.addEventListener('load', () => {
  loadFieldsFromStorage();
  document.getElementById("Server").addEventListener("change", saveFieldsToStorage);
  document.getElementById("Username").addEventListener("change", saveFieldsToStorage);
  document.getElementById("Password").addEventListener("change", saveFieldsToStorage);

  // Initialize tabs
  window.Tabs = {
    "imageslots": {
      "tab": document.querySelector("#imageslotsTab"),
      "content": document.querySelector("#imageslotsContent")
    },
    "settings": {
      "tab": document.querySelector("#settingsTab"),
      "content": document.querySelector("#settingsContent")
    }
  }

  // Set up tab events
  for (const tabName in window.Tabs)
    window.Tabs[tabName].tab.addEventListener("click", e => changeTab(e.target));
  
  // Set initial tab
  changeTab(window.Tabs["imageslots"].tab);
  
  // Initial draw and Jellyfin setup
  drawComposite();
  CreateJellyfin();

  window.temp1 = document.querySelector('#overlayText')

  window.memory = new pageMemory();
});


function cleanMemory() {
  memory.reset().then(() => location.reload());
}