// ======================
// Slot Management
// ======================
function loadImageIntoSlot(image, slotIndex) {
  slotIndex ??= slotsImages.findIndex(img => !img);
  if (slotIndex === -1)
    alert('All slots filled! Remove an image or add more slots.');
  
  // Store reference to old image to revoke AFTER new one is fully set
  const oldImage = slotsImages[slotIndex];
  
  const preview = getSlotPreviewByIndex(slotIndex);
  preview.src = Setup.Images.loading;
  loadImage(image).then(img => {
    slotsImages[slotIndex] = img;
    setSlotImage(slotIndex, img);
    
    // Revoke old Blob URL only AFTER everything is set up
    // Use setTimeout to ensure preview has updated first
    if (oldImage && oldImage !== img) {
      setTimeout(() => revokeBlobUrl(oldImage), 100);
    }
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
  
  // Store reference to old image
  const oldImage = slotsImages[index];
  
  if (!imgOrSrc) {
    // Only revoke when clearing (setting to null)
    if (oldImage) {
      revokeBlobUrl(oldImage);
    }
    slotsImages[index] = null;
    updatePreview(slot, null);
    return;
  }
  
  // If imgOrSrc is already an Image object, just use it directly
  if (imgOrSrc instanceof Image) {
    slotsImages[index] = imgOrSrc;
    updatePreview(slot, imgOrSrc);
    
    // Revoke old Blob URL after update
    if (oldImage && oldImage !== imgOrSrc) {
      setTimeout(() => revokeBlobUrl(oldImage), 100);
    }
    return;
  }
  
  // Otherwise load the image from source
  loadImage(imgOrSrc).then(img => {
    slotsImages[index] = img;
    updatePreview(slot, img);
    
    // Revoke old Blob URL only AFTER preview updates
    if (oldImage && oldImage !== img) {
      setTimeout(() => revokeBlobUrl(oldImage), 100);
    }
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
    
    // Revoke Blob URL before deleting
    if (slotsImages[index]) {
      revokeBlobUrl(slotsImages[index]);
    }
    
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

function swapImageSlots(indexA, indexB) {
  if (indexA === indexB || indexA < 0 || indexA >= slotsImages.length || indexB < 0 || indexB >= slotsImages.length) return;
  
  console.log(`Swapping slots ${indexA} <-> ${indexB}`);
  console.log(`Before swap: [${indexA}] = ${slotsImages[indexA]?.src?.substring(0, 60)}, [${indexB}] = ${slotsImages[indexB]?.src?.substring(0, 60)}`);
  
  // Swap DOM elements correctly
  const slotA = getSlotByIndex(indexA);
  const slotB = getSlotByIndex(indexB);
  const parent = slotA.parentNode;
  
  // Create a temporary marker to hold slotB's position
  const tempMarker = document.createElement('div');
  parent.insertBefore(tempMarker, slotB);
  
  // Move slotA to where slotB was
  parent.insertBefore(slotA, slotB);
  
  // Move slotB to where slotA was (now marked by tempMarker)
  parent.insertBefore(slotB, tempMarker);
  
  // Remove the temporary marker
  parent.removeChild(tempMarker);
  
  // Swap images in the array to keep data synchronized with UI
  const tempImage = slotsImages[indexA];
  slotsImages[indexA] = slotsImages[indexB];
  slotsImages[indexB] = tempImage;
  
  console.log(`After swap: [${indexA}] = ${slotsImages[indexA]?.src?.substring(0, 60)}, [${indexB}] = ${slotsImages[indexB]?.src?.substring(0, 60)}`);
  
  // Redraw canvas with new order
  drawComposite();
}

function clearImageSlot(index) {
  // Revoke Blob URL before clearing
  if (slotsImages[index]) {
    revokeBlobUrl(slotsImages[index]);
  }
  slotsImages[index] = null;
  setSlotImage(index, null)
}

function clearAllSlots() {
  // Revoke all Blob URLs at once for better performance
  revokeAllBlobUrls(slotsImages);
  
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

function isSlotPinned(index) {
  const slot = getSlotByIndex(index);
  return slot.classList.contains('pinned');
}

async function fillSlotsRandomly() {
  const previews = []
  previews.length = slotsImages.length;
  for (let i = 0; i < slotsImages.length; i++) {
    if (!isSlotPinned(i)) {
      // Don't revoke here - loadImageIntoSlot will handle it after loading new image
      const preview = getSlotPreviewByIndex(i);
      previews[i] = preview
      preview.src = Setup.Images.loading;
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
  
  // Don't revoke here - setSlotImage will handle it after loading new image
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

function pinSlot(el) {
  const slot = getSlotByIndex(getIndexFromButtonClick(el));
  slot.classList.add('pinned');
  el.classList.add('fa-thumbtack-slash');
  el.classList.remove('fa-thumbtack');
}

function unpinSlot(el) {
  const slot = getSlotByIndex(getIndexFromButtonClick(el));
  slot.classList.remove('pinned');
  el.classList.add('fa-thumbtack');
  el.classList.remove('fa-thumbtack-slash');
}

function toggleSlotPin(el) {
  if (isSlotPinned(getIndexFromButtonClick(el))) {
    unpinSlot(el);
  } else {
    pinSlot(el);
  }
}

function localImageInputChanged(el) {
  const index = getIndexBySlot(el.parentElement);
  if(el.files.length == 0)
    return
  if (el.files && el.files[0]) {
    // Store reference to old image
    const oldImage = slotsImages[index];
    
    loadImage(el.files[0])
      .then((img) => {
        slotsImages[index] = img;
        setSlotImage(index, img);
        
        // Revoke old Blob URL only AFTER everything is updated
        if (oldImage && oldImage !== img) {
          setTimeout(() => revokeBlobUrl(oldImage), 100);
        }
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
  // Revoke all Blob URLs before deleting
  revokeAllBlobUrls(slotsImages);
  
  while (slotsImages.length > 0)
    deleteImageSlot(0);
}

/**
 * Cleanup function to revoke all Blob URLs
 * Should be called when closing the app or resetting everything
 */
function cleanupAllBlobUrls() {
  revokeAllBlobUrls(slotsImages);
}

function moveSlotsRandomly() {
  const N = slotsImages.length;
  
  // Create a copy of the images array
  const newOrder = [...slotsImages];
  
  // Fisher-Yates shuffle algorithm, respecting pinned slots
  for (let i = N - 1; i >= 1; i--) {
    // Skip if current slot is pinned
    if (isSlotPinned(i))
      continue;
    
    // Find a random slot that isn't pinned (from 0 to i)
    let attempts = 0;
    let j;
    do {
      j = Math.floor(Math.random() * (i + 1));
      attempts++;
      if (attempts > 100) break; // Prevent infinite loop if all slots are pinned
    } while (isSlotPinned(j) && attempts < 100);
    
    if (isSlotPinned(j))
      continue;
    
    // Swap in the copy array
    const temp = newOrder[i];
    newOrder[i] = newOrder[j];
    newOrder[j] = temp;
  }
  
  // Now update the actual array and DOM in one pass
  for (let i = 0; i < N; i++) {
    if (slotsImages[i] !== newOrder[i]) {
      slotsImages[i] = newOrder[i];
      const preview = getSlotPreviewByIndex(i);
      if (newOrder[i]) {
        preview.src = newOrder[i].src;
      } else {
        preview.src = '';
      }
    }
  }
  
  // Redraw canvas with new order
  drawComposite();
}

function moveSlotsReverse() {
  const N = slotsImages.length;
  
  // Create a copy of the images array
  const newOrder = [...slotsImages];
  
  // Reverse by swapping in the copy (not touching DOM yet)
  for (let i = 0; i < Math.floor(N / 2); i++) {
    const j = N - 1 - i;
    
    // Skip if either slot is pinned
    if (isSlotPinned(i) || isSlotPinned(j))
      continue;
    
    // Swap in the copy array
    const temp = newOrder[i];
    newOrder[i] = newOrder[j];
    newOrder[j] = temp;
  }
  
  // Now update the actual array and DOM in one pass
  for (let i = 0; i < N; i++) {
    if (slotsImages[i] !== newOrder[i]) {
      slotsImages[i] = newOrder[i];
      const preview = getSlotPreviewByIndex(i);
      if (newOrder[i]) {
        preview.src = newOrder[i].src;
      } else {
        preview.src = '';
      }
    }
  }
  
  // Redraw canvas with new order
  drawComposite();
}

function pinAllSlots() {
  for (let i = 0; i < imageSlots.childElementCount; i++) {
    const slot = getSlotByIndex(i);
    // use pinSlot to change the pin state
    if (!isSlotPinned(i)) {
      const pinButton = slot.querySelector('.pin-button');
      pinSlot(pinButton);
    }

  }
}

function unpinAllSlots() {
  for (let i = 0; i < imageSlots.childElementCount; i++) {
    const slot = getSlotByIndex(i);
    // use unpinSlot to change the pin state
    if (isSlotPinned(i)) {
      const pinButton = slot.querySelector('.pin-button');
      unpinSlot(pinButton);
    }
  }
}