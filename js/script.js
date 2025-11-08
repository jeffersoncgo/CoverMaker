if (typeof module != 'undefined') {
  utils = require("../../scripts/components/utils/common");
  Jellyfin = require("./jellyfin");
}


// ======================
// Global Variables
// ======================
const slotsImages = []; // Global array to store slotsImages for each slot

window.Tabs = {}; // Will store tab elements

const composite = { 
  canvas: new OffscreenCanvas(1920, 1080),
  size: {
    width: 1920,
    height: 1080
  }
 }; //Default to FullHD Canvas
composite.ctx = composite.canvas.getContext("2d");

var drawCompositeImageFun = drawCompositeImageLine;


// ======================
// Some Config Functions
// ======================

const Setup = {
  Banner: {
    width: 480,
    height: 270,
    quality: 80,
  },
  Poster: {
    width: 270,
    height: 480,
    quality: 60
  },
  Library: {
    loadedLibrary: null
  },
  Images: {
    loading: "images/loading.gif",
    error: "images/error.png",
  },
  loadingType: 'lazy',
  Settings: {
    text: {
      overlayText: "",
      font: {
        family: 'Arial',
        size: 36,
        color: 'white',
        opacity: 1,
        bold: false,
      },
      fontStyle: "",
      fillStyle: "",
      overlayOpacity: 0,
    },
    canvas: {
      type: "line",
      format: "Banner",
      opacity: 0,
      reflectionDistance: 0,
      reflectionScale: 0,
      baseScale: 1.5,
      blurAmount: 0,
      spacing: 0,
    }
  }
}

// ======================
// Initialization
// ======================
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");


// Templates
const template = document.getElementById('slot-template');
const bannerTemplate = document.getElementById('banner-template');
const coverTemplate = document.getElementById('cover-template');

// Slots
const imageSlots = document.getElementById('image-slots');

const RatioSelectElement = document.getElementById("RatioSelect");
const typeSelectElement = document.getElementById("typeSelect");

const overlayTextElement = document.getElementById("overlayText");
const fontFamilyElement = document.getElementById("fontSelect");
const fontSizeElement = document.getElementById("fontSize");
const fontColorElement = document.getElementById("fontColor");
const fontOpacityElement = document.getElementById("fontOpacity");
const boldElement = document.getElementById("boldCheckbox");

const overlayOpacityElement = document.getElementById("overlayOpacity");
const spacingElement = document.getElementById("spaceSize");
const blurAmountElement = document.getElementById("blurSize");
const reflectionScaleElement = document.getElementById("reflexDistance");
const reflectionDistanceElement = document.getElementById("reflexScale");
const baseScaleElement = document.getElementById("posterScale");


// Jellyfin Images
const jellyfinContainer = document.getElementById('jellyfinimages');

const jellyfinloadLibraryBtn = document.getElementById('loadLibraryBtn');
const jellyfinsearchInput = document.getElementById('searchInput');
const jellyfinCoversLimit = document.getElementById('coverslimit')
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
// Settings Handle Functions
// ======================

function updateTextSettings() {
  Setup.Settings.text.overlayText = overlayTextElement.value || "";
  Setup.Settings.text.font.family = fontFamilyElement.value;
  Setup.Settings.text.font.size = parseFloat(fontSizeElement.value) || 36;
  Setup.Settings.text.font.color = fontColorElement.value || "white";
  Setup.Settings.text.font.opacity = parseFloat(fontOpacityElement.value) || 0;
  Setup.Settings.text.font.bold = boldElement.checked;

  Setup.Settings.text.fontStyle = (Setup.Settings.text.font.bold ? "bold" : "normal") + " " + Setup.Settings.text.font.size + "px " + Setup.Settings.text.font.family;
  
  const r = parseInt(Setup.Settings.text.font.color.slice(1, 3), 16);
  const g = parseInt(Setup.Settings.text.font.color.slice(3, 5), 16);
  const b = parseInt(Setup.Settings.text.font.color.slice(5, 7), 16);
  Setup.Settings.text.fillStyle = `rgba(${r}, ${g}, ${b}, ${Setup.Settings.text.font.opacity})`;
  drawCompositeText();
}

function updateImageSettings() {
  Setup.Settings.canvas.format = RatioSelectElement.value;
  const _format = Setup[Setup.Settings.canvas.format]
  const ratio = _format.width / _format.height;

  if (ratio > 1) { // Banner
    _format.width = 1920;
    _format.height = 1920 / ratio;
  } else { // Poster
    _format.width = 1920 * ratio;
    _format.height = 1920;
  }
  
  Setup.Settings.canvas.type = typeSelectElement.value;
  if(Setup.Settings.canvas.type == 'Line')
    drawCompositeImageFun = drawCompositeImageLine;
  else
    drawCompositeImageFun = drawCompositeImageGrid;

  setCanvasSize(_format.width, _format.height);

  Setup.Settings.canvas.overlayOpacity = parseFloat(overlayOpacityElement.value) || 0;
  Setup.Settings.canvas.spacing = parseFloat(spacingElement.value) || 0;
  Setup.Settings.canvas.blurAmount = parseInt(blurAmountElement.value) || 0;
  Setup.Settings.canvas.reflectionDistance = parseFloat(reflectionScaleElement.value) || 0;
  Setup.Settings.canvas.reflectionScale = parseFloat(reflectionScaleElement.value) || 0;

  Setup.Settings.canvas.baseScale = parseFloat(baseScaleElement.value) || 1.5;
  Setup.Settings.canvas.reflectionDistance = parseFloat(reflectionDistanceElement.value) || 0;
  drawCompositeImage();
}

function updateSettings() {
  updateTextSettings();
  updateImageSettings();
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
    SlotImageOnError(preview);
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

function SlotImageOnError(preview) {
  jellyfin.findByItemId(preview.getAttribute('item-id')).then(async resp => {
    const { Library, Item } = resp;
    if (Library && Item) {
      jellyfin.removeLibraryItem(Library.Id, Item.Id);
      preview.parentElement.remove();
      jellyfin.searchItems(jellyfin.searchParams.Name, jellyfin.searchParams.Library, jellyfin.searchParams.query).then(covers => {
        if (covers)
          fillCovers(covers);
      })
    } else {
      preview.src = Setup.Images.error;
    }
  })
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
  if (!item) return;
  
  const clone = coverTemplate.content.cloneNode(true);
  const preview = clone.querySelector('.preview');
  const label = clone.querySelector('label');
  label.innerHTML = item.Name;
  const image = jellyfin.makeImageUrl(item.Id, Setup.Poster.width, Setup.Poster.height, Setup.Poster.quality)
  preview.setAttribute('item-id', item.Id);
  preview.setAttribute('item-name', item.Name);
  preview.setAttribute('loading', Setup.loadingType)
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
  preview.setAttribute('loading', Setup.loadingType);
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
// Slot Buttons Click Functions
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

function setCanvasSize(width, height) {
  composite.size.width = width;
  composite.size.height = height;
  composite.canvas.width = width;
  composite.canvas.height = height;
  canvas.width = width;
  canvas.height = height;
  canvas.style.aspectRatio = width / height;
  drawComposite();
}

function drawCompositeImage() {
  drawCompositeImageFun();
}

function drawCompositeImageLine() {
  // set the composite.canvas the same size as the composite.size.width and composite.size.height
  composite.canvas.width = canvas.width;
  composite.canvas.height = canvas.height;

  // Clear the canvas
  composite.ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Fill background with black
  composite.ctx.fillStyle = "black";
  composite.ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Define overall dimensions for each slot
  const slotWidth = canvas.width / slotsImages.length;
  const slotTotalHeight = canvas.height / 2;
  const realHeight = slotTotalHeight * Setup.Settings.canvas.baseScale;
  const reflectionHeight = slotTotalHeight * Setup.Settings.canvas.reflectionDistance;
  const targetRatio = slotWidth / realHeight;
  
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
      
      const dx = i * (slotWidth + Setup.Settings.canvas.spacing) - Setup.Settings.canvas.spacing;
      const dy = 0;
      
      sWidth -= Setup.Settings.canvas.spacing * 2;
      sHeight -= Setup.Settings.canvas.spacing * 2;
      
      // Draw the "real" image
      composite.ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, slotWidth, realHeight);
      
      // Draw the Reflection
      const blurredImg = blurImage(img, Setup.Settings.canvas.blurAmount);
      composite.ctx.save();
      composite.ctx.translate(dx, realHeight + reflectionHeight);
      composite.ctx.scale(1, -1);
      composite.ctx.drawImage(blurredImg, sx, sy, sWidth, sHeight, 0, 0, slotWidth, reflectionHeight);
      composite.ctx.restore();
      
      // Apply Reflection Fade Effect
      const gradient = composite.ctx.createLinearGradient(0, realHeight, 0, realHeight + reflectionHeight);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.12)");
      gradient.addColorStop(Setup.Settings.canvas.reflectionScale, "rgba(0, 0, 0, 1)");
      composite.ctx.fillStyle = gradient;
      composite.ctx.fillRect(dx, realHeight, slotWidth, reflectionHeight);
    }
  });
}

function drawCompositeImageGrid() {
  const ctx = composite.ctx;
  composite.canvas.width = canvas.width;
  composite.canvas.height = canvas.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const N = slotsImages.length;
  if (!N) return;

  const { spacing = 0, baseScale = 1 } = Setup.Settings.canvas;
  const aspectRatio = canvas.width / canvas.height;

  // 🔹 Step 1: Estimate grid layout
  // Landscape canvas → more columns, Portrait → more rows
  const idealCols = aspectRatio > 1 ? Math.ceil(Math.sqrt(N * aspectRatio)) : Math.ceil(Math.sqrt(N / aspectRatio));
  const idealRows = Math.ceil(N / idealCols);

  // 🔹 Step 2: Distribute images into rows
  const rows = [];
  let remaining = N;
  for (let r = 0; r < idealRows; r++) {
    const remainingRows = idealRows - r;
    const colsInRow = Math.ceil(remaining / remainingRows);
    rows.push(colsInRow);
    remaining -= colsInRow;
  }

  // 🔹 Step 3: Compute base row height
  const totalSpacingY = spacing * (rows.length - 1);
  const rowHeight = (canvas.height - totalSpacingY) / rows.length;

  // 🔹 Step 4: Draw each image per row
  let imgIndex = 0;
  let dy = 0;

  for (let r = 0; r < rows.length; r++) {
    const cols = rows[r];
    const totalSpacingX = spacing * (cols - 1);
    const cellWidth = (canvas.width - totalSpacingX) / cols;
    const realHeight = rowHeight * baseScale;

    for (let c = 0; c < cols && imgIndex < N; c++, imgIndex++) {
      const img = slotsImages[imgIndex];
      if (!img) continue;

      const dx = c * (cellWidth + spacing);
      const targetRatio = cellWidth / realHeight;
      const imgRatio = img.width / img.height;

      // Crop image to fit target cell ratio
      let sx, sy, sWidth, sHeight;
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

      ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, cellWidth, realHeight);
    }

    dy += rowHeight + spacing;
  }
}



function drawCompositeText() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(composite.canvas, 0, 0);
  ctx.fillStyle = `rgba(0, 0, 0, ${Setup.Settings.text.overlayOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = Setup.Settings.text.fontStyle;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = Setup.Settings.text.fillStyle;
  ctx.fillText(Setup.Settings.text.overlayText, canvas.width / 2, canvas.height / 2);
}

function drawComposite() {
  drawCompositeImage();
  drawCompositeText();
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

  const previewHTML = `<!-- start a simple html page -->
 
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        display: flex;
        margin:0; 
        background-color:#121212;
        align-items:center; 
        justify-content:center;
      }
      img {
        object-fit: scale-down;
        max-width: calc(100vw - 20px);
        max-height: 100vh;
        min-height: 100vh;
        cursor: zoom-in;
        overflow-x: hidden;
      }
      img[zoomed] {
        cursor: zoom-out;
      }
    </style>
</head>
<body>
    <img id="preview" onload="window.stop()" src="${dataURL}">
</body>
<script>
      const img = document.getElementById("preview");
      img.addEventListener("click", () => {
        if (img.getAttribute('zoomed')) {
          img.removeAttribute('zoomed');
          img.style.maxHeight = '100vh'; 
          img.style.minWidth =  'unset';
          img.style.objectFit =  'scale-down';
        } else {
          img.setAttribute('zoomed', 'true');
          img.style.maxHeight = 'unset';
          img.style.minWidth =  'calc(100vw - 20px)';
          img.style.objectFit =  'contain';
        }
      });
    </script>
</html>`

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
      setTimeout(() => Setup.loadingType = window.jellyfin.Server.Speed.time > 100 ? 'lazy' : 'eager', 200);
    },
    onLibraryLoad: () => {
      makeDetailList(jellyfinsearchInput, jellyfin.searchParams.Genres);
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
  return new Promise((resolve) => {
    clearJellyfinWindow();
    
    const coverPromises = items.map(cover => {
      return new Promise(resolveCover => {
        addVideoCover(cover);
        resolveCover();
      });
    });
    
    Promise.all(coverPromises).then(() => {
      jellyfinContainer.scrollTop = 0;
      resolve();
    });
  });
}

function setCoversLimit(limit) {
  limit = parseInt(limit);
  if (isNaN(limit))
    return;
  jellyfin.searchParams.limit = limit;
  jellyfin.searchParamsToRestore.limit = limit;
  if(jellyfinContainer.hasAttribute("search-limit"))
    jellyfinContainer.setAttribute("search-limit", limit)
  searchOnLibrary(null, null);
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
  jellyfin.searchParams.limit = jellyfin.searchParamsToRestore.limit;
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

// searchOnLibrary = Controller.wrap(searchOnLibrary);
const searchController = new Controller(searchOnLibrary);
searchOnLibrary = searchController;
searchOnLibrary.Controller = searchController;
searchOnLibrary = searchOnLibrary.exec.bind(searchOnLibrary);

drawCompositeText = Controller.wrap(drawCompositeText);
drawCompositeText.Controller.startDelayMs = 100;

drawCompositeImage = Controller.wrap(drawCompositeImage);
drawCompositeImage.Controller.startDelayMs = 100;

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

function addSettingListeners() {
  [
    overlayTextElement,
    fontFamilyElement,
    fontSizeElement,
    fontColorElement,
    fontOpacityElement,
    boldElement
  ].forEach((el) => {
    el.addEventListener("input", updateTextSettings);
  });

  [
    RatioSelectElement,
    typeSelectElement,
    overlayOpacityElement,
    spacingElement,
    blurAmountElement,
    reflectionScaleElement,
    reflectionDistanceElement,
    baseScaleElement
  ].forEach((el) => {
    el.addEventListener("input", () => {
      updateImageSettings();
      drawComposite();
    });
  });
}

// Export buttons
document.getElementById("exportBtn").addEventListener("click", exportAsPNG);
document.getElementById("openTabBtn").addEventListener("click", openInNewTab);

function dummyStart() {
  // Add initial slots
  // Load default slotsImages
  const imagesToLoad = {
    "final_destination_bloodlines": "https://m.media-amazon.com/images/M/MV5BMzc3OWFhZWItMTE2Yy00N2NmLTg1YTktNGVlNDY0ODQ5YjNlXkEyXkFqcGc@._V1_FMjpg_UY4096_.jpg",
    "conclave": "https://m.media-amazon.com/images/M/MV5BYjgxMDI5NmMtNTU3OS00ZDQxLTgxZmEtNzY1ZTBmMDY4NDRkXkEyXkFqcGc@._V1_FMjpg_UX1080_.jpg",
    "oppenheimer": "https://m.media-amazon.com/images/M/MV5BN2JkMDc5MGQtZjg3YS00NmFiLWIyZmQtZTJmNTM5MjVmYTQ4XkEyXkFqcGc@._V1_FMjpg_UY3454_.jpg",
    "interestellar": "https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_FMjpg_UY3600_.jpg"
  }

  const values = Object.values(imagesToLoad);
  setSlots(values.length);

  values.forEach((src, i) => {
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

  window.memoryLoaded = false;
  window.memory = new pageMemory();
  window.memory.addEvent('onMemoryIsEmpty', () => dummyStart())
  window.memory.addEvent('onRestoreSucess', () => window.memoryLoaded = true)
  window.memory.addEvent('onRestoreSucess', updateSettings)
  window.memory.addEvent('onRestoreError', () =>  window.memoryLoaded = true)
  window.memory.init();
  addSettingListeners();
});


function cleanMemory() {
  memory.reset().then(() => jellyfin.cleanDb());
}

// Others
function  makeDetailList(inputTarget, list) {
  const datalist = document.createElement('datalist');
  datalist.id = `${inputTarget.id}-list`;

  list.forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    datalist.appendChild(option);
  });

  inputTarget.setAttribute('list', datalist.id);
  inputTarget.parentNode.insertBefore(datalist, inputTarget.nextSibling);
}

