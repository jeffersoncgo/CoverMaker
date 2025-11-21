// ======================
// Slot Management
// ======================
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

function SlotImageOnLoad(el) {
  // el.src = Setup.Images.loading
};

function amountImagesNeeded() {
  return jellyfin.searchParams.limit - document.querySelector('#jellyfinimages').childElementCount
}

function shouldGetMoreCovers() {
  return amountImagesNeeded() > 0;
}

function SlotImageOnError(preview) {
  jellyfin.findByItemId(preview.getAttribute('item-id')).then(async resp => {
    const { Library, Item } = resp;
    if (Library && Item) {
      jellyfin.removeLibraryItem(Library.Id, Item.Id);
      preview.parentElement.remove();
      const needed = amountImagesNeeded();
      if(needed > 0) {
        jellyfin.searchItems(null, null, null, needed).then(posters => { 
          if (posters)
            fillposters(posters, false)
        })
      }
    } else {
      preview.src = Setup.Images.error;
    }
  })
};

// ======================
// Slot Getters / Setters
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

function getSlotImageUrl(el) {
  const src = el.getAttribute('src');
  if (!src)
    return;
  return src;
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

// ======================
// Slot Actions
// ======================

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

    items = await jellyfin.searchItems(null, null, null, null);
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
    if (data.type == "poster") {
      loadImageIntoSlot(value, index);
    }
  } catch (error) {}
}

function onposterDragStart(event) {
  const imageUrl = jellyfin.makeImageUrl(event.target.getAttribute("item-id"), null, null, 100);
  event.dataTransfer.setData("application/json", JSON.stringify({type: "poster", value: imageUrl}));
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
function deleteAllSlots() {
  while (slotsImages.length > 0)
    deleteImageSlot(0);
}