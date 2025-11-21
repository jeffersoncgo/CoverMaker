# 🎬 CoverMaker

**A High-Performance, Client-Side Poster Design Tool for Jellyfin Media Collections**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow.svg)
![No Build Required](https://img.shields.io/badge/build-none-green.svg)
![Meilisearch](https://img.shields.io/badge/Meilisearch-Supported-blueviolet.svg)
![Tech](https://img.shields.io/badge/tech-Canvas_API-orange.svg)
![Cache](https://img.shields.io/badge/cache-IndexedDB-green.svg)
![State](https://img.shields.io/badge/state-localStorage-blue.svg)

---

## 🧩 Overview

**CoverMaker** is a sophisticated web-based canvas tool designed specifically for creating custom collection posters for Jellyfin media servers. Built with pure vanilla JavaScript and leveraging modern browser APIs, it provides real-time poster composition with support for multiple layout engines, text overlays with advanced styling, and seamless Jellyfin integration with intelligent caching.

The application runs entirely in the browser with **zero build tools** required—just clone and serve. It features OffscreenCanvas rendering for performance, IndexedDB for persistent caching, and optional Meilisearch integration for blazing-fast library searches.

### Key Capabilities

- **🎨 Canvas-Based Rendering**: Real-time poster generation using HTML5 Canvas API with OffscreenCanvas for non-blocking rendering
- **📚 Jellyfin Integration**: Direct authentication, library browsing, and poster fetching from Jellyfin media servers
- **🔍 Smart Search**: Dual-mode search with automatic Meilisearch detection and local IndexedDB fallback
- **💾 Intelligent Caching**: IndexedDB-powered persistent storage for library metadata with delta updates
- **✏️ Advanced Text Layers**: Multi-layer text system with custom fonts (Google Fonts), strokes, shadows, and positioning
- **🎭 Multiple Layouts**: 15+ layout engines including Line, Grid, Mosaic, Circle, Collage, Carousel, Stack variants
- **📦 Project Management**: Import/export project files (.json) with complete state preservation
- **🎯 Drag & Drop**: Intuitive image slot management with reordering and drag-to-position support
- **🌐 No Backend Required**: Fully client-side with localStorage and IndexedDB persistence

---

## ⚙️ Installation

### Requirements

- Modern web browser with Canvas API support (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+)
- Local HTTP server (for CORS compliance with Jellyfin API)
- Jellyfin media server (optional, for library integration)

### Setup

```bash
# Clone the repository
git clone https://github.com/jeffersoncgo/CoverMaker.git
cd CoverMaker

# Serve with any HTTP server
# Option 1: Python
python -m http.server 8080

# Option 2: Node.js (http-server)
npx http-server -p 8080

# Option 3: PHP
php -S localhost:8080

# Open in browser
# Navigate to http://localhost:8080
```

**No npm install, no build step, no transpilation—just serve and go.**

---

## 🚀 Usage

### Quick Start

1. **Launch the Application**: Open `index.html` in your browser via a local server
2. **Login to Jellyfin** (optional): Click "Login to Jellyfin" and enter your server credentials
3. **Add Image Slots**: Use the `+` button in the slots panel to add poster positions
4. **Load Images**:
   - **From Jellyfin**: Browse libraries and drag posters to slots
   - **From Local Files**: Click the folder icon on any slot to upload
   - **Via Drag & Drop**: Drop images directly onto slots
5. **Configure Layout**: Choose from 15+ layout types (Line, Grid, Stack, Mosaic, etc.)
6. **Add Text Overlays**: Create multi-layer text with custom fonts, strokes, shadows
7. **Export**: Download as PNG or save project as JSON for later editing

### Jellyfin Workflow

```javascript
// The app automatically:
// 1. Authenticates against Jellyfin server
// 2. Detects and configures Meilisearch plugin (if available)
// 3. Loads all libraries into IndexedDB with metadata caching
// 4. Enables incremental updates when library size changes
// 5. Provides filtered search with tags, genres, studios
```

### Project Management

```javascript
// Export current project
document.getElementById("exportProjectBtn").click();
// Creates: {Collection_Name}.json with all settings and image URLs

// Import saved project
document.getElementById("importProjectInput").files = [file];
// Restores: Slots, images, text layers, canvas settings, layout config
```

---

## 🧠 Features

Este README foi completamente reescrito para refletir as últimas mudanças implementadas no CoverMaker, incluindo:

### ✨ Principais Atualizações

**Sistema de Texto Multi-Camadas**:
- Múltiplas camadas de texto independentes com configuração completa
- Suporte a múltiplos contornos (strokes) por camada
- Suporte a múltiplas sombras/brilhos por camada
- Sistema de templates padrão para camadas, contornos e sombras
- IDs únicos dinâmicos para evitar conflitos
- Duplicação de camadas, contornos e sombras
- Integração com Google Fonts (800+ famílias)
- Carregamento assíncrono de fontes

**15+ Algoritmos de Layout**:
- Line (horizontal com reflexos)
- Grid (distribuição adaptativa)
- Mosaic (variação de tamanho)
- Circle (arranjo tipo pizza)
- Collage (posicionamento espalhado)
- Italic (linha inclinada com reflexos alinhados)
- Carousel (perspectiva 3D)
- Shrink (escala centro para borda)
- Stack 1-8 (8 variantes de empilhamento: livros, fotos, cartas)

**Integração Meilisearch**:
- Detecção automática do plugin Meilisearch
- Pesquisa do lado do servidor com filtros avançados
- Fallback automático para IndexedDB quando indisponível
- Suporte a filtros de caminho para bibliotecas separadas

**Melhorias de Performance**:
- Renderização com OffscreenCanvas (não bloqueia UI)
- Debouncing baseado em Controller para pesquisas
- Cache inteligente IndexedDB com atualizações delta
- Carregamento lazy de imagens baseado em velocidade do servidor
- Pré-processamento de blur para reflexos

---

## 🧱 Architecture

### File Structure & Module Dependencies

```
CoverMaker/
├── index.html              # DOM structure with templates
├── css/                    # Stylesheets (7 files)
│   ├── variables.css       # CSS custom properties
│   ├── base.css            # Typography & resets
│   ├── layout.css          # Grid & flexbox layouts
│   ├── components.css      # UI component styles
│   ├── toast.css           # Notification styles
│   ├── animations.css      # Transitions & keyframes
│   └── utilities.css       # Helper classes
├── js/
│   ├── app.js              # Main orchestrator (1076 lines)
│   ├── config.js           # Global state object (121 lines)
│   ├── drawing.js          # Canvas rendering (298 lines)
│   ├── jellyfin.js         # Jellyfin API wrapper (1239 lines)
│   ├── jellyfin_ui.js      # UI event handlers (239 lines)
│   ├── slots.js            # Image slot management (357 lines)
│   ├── toast.js            # Notification system (80 lines)
│   ├── windowsHandle.js    # Draggable window mgmt (50 lines)
│   └── vendor/
│       └── meilisearch_index.min.js  # Meilisearch client
├── fonts.json              # Google Fonts metadata
└── images/                 # Placeholder assets
```

### Core Modules Overview

#### 🎯 **app.js** - Application Orchestrator (1076 lines)
**Purpose:** Central DOM controller and state synchronizer

**Key Responsibilities:**
- DOM element reference management
- localStorage persistence via `[save]` attribute monitoring
- Text layer lifecycle (creation, update, deletion)
- Canvas configuration and preset switching
- Settings synchronization across all modules
- JSON workspace save/load functionality

**Critical Functions:**
```javascript
// Session Management
loadFieldsFromStorage()        // Restores Jellyfin credentials
saveFieldsToStorage()          // Persists login info
loadFullProjectFromJson()      // Imports workspace snapshots

// State Management
loadSetup()                    // Restores canvas config from storage
loadTextLayersFromStorage()    // Reconstructs text layers
saveSetup()                    // Persists canvas config

// Settings Pipeline
updateTextSettings()           // Rebuilds text layer object array
                               // Loads fonts asynchronously
                               // Recalculates fillStyle/fontStyle
```

**Global State Objects:**
- `Setup` - Configuration hub (sizes, canvas settings, text layers)
- `slotsImages[]` - Array of loaded Image objects
- `window.memoryLoaded` - Flag to prevent redundant saves during initialization

---

#### 🎬 **config.js** - Global Configuration (121 lines)
**Purpose:** Single source of truth for all configuration

**Structure:**
```javascript
Setup = {
  Sizes: {
    cover: { width: 480, height: 270, quality: 80 },
    poster: { width: 270, height: 480, quality: 60 },
    square: { width: 1, height: 1, quality: 100 },
    custom: { width: 1920, height: 1080, quality: 100 }
  },
  Library: { loadedLibrary: null },
  Images: { loading: "images/loading.gif", error: "images/error.png" },
  Settings: {
    canvas: {
      type: "line" | "grid",
      format: "cover" | "poster" | "square" | "custom",
      overlayColorStart: "#000000",
      overlayColorEnd: "#000000",
      overlayOpacityStart: 0-1,
      overlayOpacityEnd: 0-1,
      reflectionDistance: 0-500,
      reflectionScale: 0-1,
      baseScale: 1-5,
      blurAmount: 0-20,
      spacing: 0-50
    },
    textLayers: [ /* array of text layer objects */ ]
  }
}

// Global OffscreenCanvas for rendering
composite = {
  canvas: new OffscreenCanvas(1920, 1080),
  ctx: canvas.getContext("2d")
}
```

**Key Feature:** Dual RGB representation for colors (performance optimization)
```javascript
overlayColorStart: "#000000",
overlayColorStartRGB: { r: 0, g: 0, b: 0 }
// RGB is pre-computed for canvas fillStyle performance
```

---

#### 🎨 **drawing.js** - Canvas Rendering Engine (298 lines)
**Purpose:** OffscreenCanvas rendering with advanced effects

**Rendering Pipeline:**
```
drawComposite()
├─ drawCompositeImage()         // Render to OffscreenCanvas
│  ├─ drawCompositeImageLine()  // Line layout mode
│  └─ drawCompositeImageGrid()  // Grid layout mode
└─ drawCompositeText()          // Draw text overlay on main canvas
```

**Layout Algorithms:**

**Line Mode** - Horizontal/Vertical Arrangement:
```javascript
// For cover format (horizontal)
slotWidth = canvas.width / slotsImages.length
slotTotalHeight = canvas.height / 2
realHeight = slotTotalHeight * baseScale
reflectionHeight = slotTotalHeight * reflectionDistance

// Each image:
1. Crop to match target aspect ratio (preserves image content)
2. Draw main image
3. Apply blur filter
4. Draw reflection (scaled -1 on Y axis)
5. Apply gradient overlay on reflection for fade effect
```

**Grid Mode** - Optimal Space-Filling:
```javascript
// 1. Calculate ideal grid dimensions based on canvas aspect ratio
idealCols = Math.ceil(Math.sqrt(N * aspectRatio))
idealRows = Math.ceil(N / idealCols)

// 2. Distribute images across rows
// 3. Calculate cell dimensions for each row
// 4. Draw each image with aspect-ratio-preserving crop

// Result: Professionally arranged grid with optimal space usage
```

**Image Cropping Logic (Center Crop):**
```javascript
const targetRatio = slotWidth / realHeight
const imgRatio = img.width / img.height

if (imgRatio > targetRatio) {
  // Wider image: crop left/right equally
  sWidth = img.height * targetRatio
  sx = (img.width - sWidth) / 2  // Center crop
} else {
  // Taller image: crop top/bottom equally
  sHeight = img.width / targetRatio
  sy = (img.height - sHeight) / 2  // Center crop
}
```

**Text Rendering Pipeline:**
```
For each text layer:
1. Draw shadows (bottom layer)
2. Draw strokes/outlines (middle layer)
3. Draw main text fill (top layer)

Position calculation:
- textAlign: "left" | "center" | "right"  → sets X anchor
- textBaseline: "top" | "middle" | "bottom" → sets Y anchor
- Offset applied from anchor point to final position
```

**Utility Functions:**
```javascript
hexToRgb(hex)  // "#FF0000" → { r: 255, g: 0, b: 0 }

loadImage(file)  // Accepts: Image object, URL string, or File object
  → Returns Promise<Image>
  → Handles CORS with crossOrigin = "anonymous"
  → Converts Files to Data URLs via FileReader

blurImage(img, size)  // Canvas blur filter preprocessing
  → Returns canvas element with blur applied
  → Used for reflection blur effect
```

---

#### 🔌 **jellyfin.js** - Jellyfin API Integration (1239 lines)
**Purpose:** Complete Jellyfin server interface with intelligent caching

**Class Structure:**
```javascript
class Jellyfin {
  constructor(Host, Username, Pw, events, needsUserData)
  
  // Server management
  Server = {
    Address, LocalAddress, ExternalAddress,
    ServerName, Version, OperatingSystem, Id,
    Speed: { address, time, reachable }
  }
  
  // Authentication
  User = { Username, Pw, Token, Id }
  
  // Search parameters
  searchParams = {
    Tags[], Genres[], Studios[],
    Name, Library, OfficialRating,
    CommunityRating, ProductionYear, PremiereDate,
    limit, offset, page, hasNextPage,
    sortBy, order
  }
  
  // Caching
  Libraries = { [libraryId]: { Id, Name, Count, ... } }
  
  // Meilisearch support
  Meilisearch = {
    isAvailable, ApiKey, Index,
    TypeMap: { tvshows, movies, boxsets, ... }
  }
}
```

**Event System:**
```javascript
new Jellyfin(host, username, password, {
  onServerSetupError: (error) => {},    // Server offline/unreachable
  onLoginSuccess: (userData) => {},     // Authentication successful
  onLoginError: (error) => {},          // Bad credentials
  onLibraryLoad: () => {},              // Libraries loaded
  onSearchFinish: () => {}              // Search results ready
})
```

**Critical Workflows:**

**1. Initialization & Address Detection**
```javascript
async init()
  ├─ getPublicInfo()                 // Get server metadata
  ├─ setFastestAddress()             // Test external + local addresses
  │  └─ Select fastest reachable address (crucial for local networks)
  ├─ login()                         // Authenticate user
  ├─ setupMeiliSearch()              // Detect Meilisearch plugin
  └─ getLibraries()                  // Fetch libraries + cache metadata
```

**2. IndexedDB Caching System**
```javascript
saveData(dbName, storeName, key, data)
  → Creates database with server ID as name
  → Stores JSON-stringified data
  → One store per library/metadata type

loadData(dbName, storeName, key)
  → Retrieves and JSON-parses cached data
  → Returns null if missing or corrupted

// Stores:
- "Tags" → Array of all tags
- "Genres" → Array of all genres
- "Studios" → Array of all studios
- [libraryId] → All items in library
```

**3. Library Loading with Smart Cache Updates**
```javascript
async getLibraries()
  ├─ Fetch user views from /UserViews
  ├─ Get library size for each (item count)
  ├─ Check if library size changed since last session
  │  ├─ If changed: re-fetch from API
  │  └─ If unchanged: restore from IndexedDB (instant!)
  ├─ Load Tags, Genres, Studios from cache
  └─ Fire onLibraryLoad event
```

**4. Dual-Mode Search**

**If Meilisearch Plugin Detected:**
```javascript
async loadLibraryItemsMeiliSearch(query, libraryId, limit)
  ├─ Send query to Jellyfin's Meilisearch endpoint
  ├─ Returns pre-scored results from server
  ├─ Fast: O(log N) server-side
  └─ Best for large libraries (5000+ items)
```

**If Meilisearch Unavailable (Fallback):**
```javascript
async searchItems(query, library, filters)
  ├─ this.Controller.exec()           // Debounce handler
  ├─ Filter local IndexedDB cache
  ├─ Score results by:
  │  ├─ Name match (prefix > contains)
  │  ├─ Tag/Genre/Studio match count
  │  └─ Official rating
  ├─ Sort by score descending
  └─ Paginate with limit + offset
```

**Search Controller Pattern (Debouncing):**
```javascript
this.Controller = new Controller(this.searchItems.bind(this))

// Behavior:
// 1. User types search query
// 2. Input fires 'searchOnLibrary()' immediately
// 3. searchOnLibrary() calls Controller.exec()
// 4. Controller starts 400ms timer
// 5. If another input before timer: abort previous, restart timer
// 6. After timer expires: execute actual search
// Result: Only final search is executed, UI stays responsive
```

**5. Image URL Generation**
```javascript
makeImageUrl(itemId, width, height, quality)
  → Constructs /Items/{itemId}/Images/Primary
  → Adds query params: width, height, quality
  → Returns CORS-enabled URL to image

// Used for both:
// - Library browser (small previews)
// - Canvas rendering (larger, higher quality)
```

---

#### 🖼️ **slots.js** - Image Slot Management (357 lines)
**Purpose:** Handle image loading, arrangement, and user interactions

**Slot Lifecycle:**
```
Add Slot
  → addImageSlot()
     → Push null to slotsImages[]
     → Clone template and insert DOM
     → Initialize empty preview

Load Image into Slot
  → loadImageIntoSlot(image, index)
     → Show loading placeholder
     → loadImage(image)
     → Store in slotsImages[index]
     → Update preview and trigger render

Move Slot
  → moveImageSlot(source, target)
     → Reorder DOM elements
     → Reorder slotsImages array
     → Trigger render

Delete Slot
  → deleteImageSlot(index)
     → Remove from DOM
     → Remove from slotsImages
     → Adjust remaining indices
     → Trigger render
```

**Image Loading from Multiple Sources:**
```javascript
// Source 1: Jellyfin Library
selectImageToSlot(posterElement)
  → Extract item ID from element
  → Generate Jellyfin API URL
  → loadImageIntoSlot(url)

// Source 2: Local File Upload
localImageInputChanged(fileInputElement)
  → Extract File object
  → loadImage(file) converts to Data URL
  → loadImageIntoSlot(dataUrl)

// Source 3: Drag & Drop (from Jellyfin)
onposterDragStart(event)
  → Serialize poster data to JSON
  → setData("application/json", json)

slotOnDropImage(event, targetSlot)
  → Parse JSON from dataTransfer
  → loadImageIntoSlot(data.value)

// Source 4: Drag to Reorder Slots
onSlotDragToMove(event)
  → Serialize source slot index
  → Target slot receives drop
  → moveImageSlot(source, target)
```

**Smart Image Handling:**
```javascript
// Pin Protection
toggleSlotPin(element)
  → Toggles 'pinned' class on slot
  → Pinned slots excluded from randomization

// Randomization
fillSlotsRandomly()
  ├─ For each unpinned slot
  ├─ Load random image from current library
  └─ Respect current search filters

radomizeSlotImage(element)
  ├─ Single slot randomization
  ├─ Fetch 1 random item
  └─ Load into specified slot

// Error Recovery
SlotImageOnError(preview)
  ├─ Find item in IndexedDB
  ├─ Remove from cache (corrupted image)
  ├─ Fetch replacement image
  └─ Load into slot
```

**Utility Functions:**
```javascript
// Getters
getSlotByIndex(index) → DOM element
getSlotPreviewByIndex(index) → <img> preview element
getFileInputByIndex(index) → <input type="file"> element

// Utilities
getIndexBySlot(slot) → Find slot index
getIndexFromButtonClick(event) → Extract slot index from button click

// Batch Operations
setSlots(count)          // Add or remove slots to match count
deleteAllSlots()    // Clear all slots
clearAllSlots()          // Clear all images
```

---

#### 🎭 **jellyfin_ui.js** - UI Event Handlers (239 lines)
**Purpose:** Jellyfin-specific UI interactions and state updates

**Key Functions:**

```javascript
// Authentication
CreateJellyfin()         // Initialize Jellyfin class with login handlers
Login()                  // Authenticate with current credentials

// Library Navigation
loadLibraries(element)   // Reset filters, show all libraries
selectLibrary(element)   // Enter library, reset search
loadLibraryImage(element) // Preview library image on canvas

// Search & Filtering
searchOnLibrary(query)   // Execute search with current params
setpostersLimit(limit)   // Update results per page
filterRandom()           // Set sort to random

// Pagination
nextPage()               // Load next page of results
previousPage()           // Load previous page of results
returnToSearch()         // Restore search state from attributes

// Image Selection
selectImageToSlot(poster) // Add poster to active slot
addVideoposter(item)     // Create DOM for poster, add to browser
addLibrarycover(id, name) // Create DOM for library cover

// State Tracking
fillJellyfinContainerAttr() // Store search state in DOM attributes
                            // Used for pagination state restoration
```

**Search State Persistence (DOM Attributes):**
```html
<div id="jellyfinimages" 
     search-name="Sci-Fi"
     search-library="Movies"
     search-page="2"
     search-limit="20"
     search-offset="20"
     search-hasNextPage="true">
  <!-- Results -->
</div>
```

This approach preserves search context during pagination and navigation.

---

#### 🔔 **toast.js** - Notification System (80 lines)
**Purpose:** Non-intrusive, flexible toast notifications

**API:**
```javascript
toastMessage(message, {
  position: 'topRight' | 'topLeft' | 'bottomCenter' | 'cursorPos' | ...
  type: 'default' | 'success' | 'danger'
  duration: 3000  // milliseconds
  x: 0, y: 0      // For cursorPos
})
```

**Features:**
- Auto-stacking (multiple toasts arrange properly)
- Type-based icons (success ✓, danger ⚠️)
- CSS transitions for smooth appearance
- Auto-cleanup of empty containers

---

#### 🪟 **windowsHandle.js** - Draggable Windows (50 lines)
**Purpose:** Make floating dialogs draggable and repositionable

**Functions:**
```javascript
makeDraggable(windowElement)  // Attach drag handlers
showWindow(windowId)          // Make visible, centered
hideWindow(windowId)          // Hide window
```

**Features:**
- Viewport constraint (windows can't drag off-screen)
- Close button integration
- Z-index management (brings clicked window to front)

---

### State Management & Persistence

**Three-Layer Persistence Strategy:**

```
User Changes Setting
       ↓
[save] attribute detected
       ↓
localStorage.setItem()
       ↓
Page Reload
       ↓
loadFieldsFromStorage()
loadSetup()
loadTextLayersFromStorage()
       ↓
State Restored Exactly
```

**Specific Patterns:**

```javascript
// HTML with [save] attribute
<input id="fontSize" type="number" value="327" save>

// JavaScript monitoring
document.addEventListener('change', (e) => {
  if (e.target.hasAttribute('save')) {
    localStorage.setItem(e.target.id, e.target.value)
  }
})

// On reload
Setup.Settings.textLayers[0].font.size = 
  localStorage.getItem('fontSize') || 327
```

**JSON Project Format:**
```json
{
  "Setup": {
    "Sizes": { ... },
    "Settings": { ... },
    "Library": { ... }
  },
  "imageSlots": [
    "https://jellyfin.example.com/Items/.../Images/Primary?quality=100",
    "blob:https://...",
    null
  ]
}
```

---

## 🚀 Features in Depth

### 🎬 Canvas Rendering

#### Dual Layout Modes

**Line Mode:**
```
┌─────────────────────────────────────┐
│  [Image 1]  [Image 2]  [Image 3]    │
│     ✓           ✓          ✓        │
│  [Reflection] [Reflection] [Refl]   │
└─────────────────────────────────────┘

- Horizontal for cover format (16:9)
- Vertical for poster format (9:16)
- Equal width/height for all images
- Automatic calculation based on slot count
```

**Grid Mode:**
```
┌──────────────────────────┐
│ [I1] [I2] [I3] [I4]     │
│ [I5] [I6] [I7]          │
│ [I8] [I9]               │
└──────────────────────────┘

- Optimal row/column distribution
- Aspect-ratio aware
- Space-filling algorithm
- Perfect for varied library sizes
```

#### Advanced Effects

**Reflections:**
- Canvas context flip: `ctx.scale(1, -1)`
- Gradient fade overlay (optional blur)
- Distance & scale customizable

**Overlays:**
- Linear gradient (top to bottom)
- Color start/end customizable
- Opacity start/end (0-1 range)
- Full canvas coverage

**Text Rendering:**
- Multiple independent layers
- Per-layer font customization
- Shadows (blur + offset)
- Strokes/outlines with custom color
- Position anchoring (9-point grid)

---

### 🔍 Search & Filtering

**Search Scope:**
- Item name (title, prefix matching preferred)
- Tags (multi-select filter)
- Genres (multi-select filter)
- Studios (multi-select filter)
- Production year
- Rating (official + community)

**Result Scoring:**
1. Name match (exact > prefix > contains)
2. Tag/Genre/Studio match count
3. Official rating threshold

**Pagination:**
- Configurable page size (10-100)
- Previous/Next navigation
- Offline state tracking

---

### 💾 Session Persistence

**What's Saved:**
- ✅ Jellyfin credentials (HTTPS-only recommended)
- ✅ Canvas settings (format, layout type, effects)
- ✅ Text layers (all properties)
- ✅ Image URLs in slots
- ✅ UI state (tab selection, window positions)

**Storage Limits:**
- localStorage: ~5-10 MB per domain
- IndexedDB: 50 MB+ (browser dependent)
- Image URLs stored, not image data (saves space)

---

## 🛠 Advanced Usage & Customization

### Adding a New Canvas Setting

**Step 1: Update `config.js`**
```javascript
Setup.Settings.canvas.newSetting = 0
```

**Step 2: Create HTML Input**
```html
<input id="newSetting" type="range" value="0" min="0" max="100" save>
```

**Step 3: Listen in `app.js`**
```javascript
document.getElementById('newSetting').addEventListener('change', () => {
  Setup.Settings.canvas.newSetting = this.value
  drawComposite()
})
```

**Step 4: Use in `drawing.js`**
```javascript
// Inside drawCompositeImage*() functions
const newSetting = Setup.Settings.canvas.newSetting
// Apply effect...
```

---

### Extending Jellyfin Search

**Add a new filter:**
```javascript
// In config.js
searchParams.CustomField = ""

// In jellyfin.js search logic
if (this.searchParams.CustomField) {
  items = items.filter(item => 
    item.CustomField === this.searchParams.CustomField
  )
}
```

---

### Custom Layout Algorithm

Replace `drawCompositeImageFun`:
```javascript
function drawMyCustomLayout() {
  slotsImages.forEach((img, i) => {
    // Your custom positioning logic
    composite.ctx.drawImage(...)
  })
}

drawCompositeImageFun = drawMyCustomLayout
```

---

## 📊 Performance Characteristics

### Rendering Performance
- **OffscreenCanvas:** Non-blocking UI rendering
- **Image Caching:** Loaded images stored in memory
- **Lazy Rendering:** Only redraw on setting changes
- **Canvas Optimization:** Single composite → main canvas copy

### Search Performance
- **Meilisearch:** O(log N) server-side
- **IndexedDB:** O(N) local (but instant, no network latency)
- **Controller Debouncing:** Prevents redundant searches

### Memory Usage
- **Image Slots:** ~50-100 KB per Image object
- **IndexedDB Cache:** ~1 MB per 1000 items
- **Text Layers:** <1 MB (configuration data only)

---

## 🔒 Security Considerations

### CORS & Cross-Origin
- All requests to Jellyfin include `crossOrigin="anonymous"`
- localStorage stores credentials (HTTPS-only recommended)
- IndexedDB is origin-specific (same-origin policy applies)

### Best Practices
- Run on HTTPS when accessing production Jellyfin
- Don't share your device while logged in
- Use browser's "Clear Data" to remove credentials after use

### No Data Sent to Third Parties
- All processing client-side
- No analytics or telemetry
- Meilisearch requests go to your server only

---

## 🌐 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full Support |
| Firefox | 88+ | ✅ Full Support |
| Safari | 14.1+ | ✅ Full Support |
| Edge | 90+ | ✅ Full Support |
| IE 11 | - | ❌ Not Supported |

**Required APIs:**
- HTML5 Canvas & OffscreenCanvas
- Fetch API
- IndexedDB
- localStorage
- AbortController

---

## 🐛 Troubleshooting

### "CORS Error when connecting to Jellyfin"
**Cause:** Running from `file://` instead of HTTP server
**Solution:** Start local server (see Installation section)

### "Search results are empty"
**Cause 1:** First login - IndexedDB cache not populated
**Fix:** Wait 10-20 seconds for initial library load

**Cause 2:** Jellyfin server offline
**Fix:** Check server URL and credentials in login dialog

### "Images not loading in slots"
**Cause:** Invalid Jellyfin URL or image permissions
**Fix:** Verify item exists in Jellyfin, check image in browser console

### "Settings not persisting across reloads"
**Cause:** localStorage disabled or privacy mode
**Fix:** Enable localStorage or switch from private/incognito browsing

---

## 📝 Development Tips

### Adding Debug Output
```javascript
// In any function
console.log('Setup:', Setup)
console.log('Jellyfin Libraries:', jellyfin.Libraries)
console.log('Current Slots:', slotsImages.map(i => i?.src))
```

### Inspecting IndexedDB
```javascript
// In browser console
// See all cached libraries
await jellyfin.openDB(jellyfin.Server.Id, 'Movies')

// Export search parameters
JSON.stringify(jellyfin.searchParams, null, 2)
```

### Forcing Cache Clear
```javascript
localStorage.clear()
indexedDB.deleteDatabase(serverId)
location.reload()
```

---

## 🔄 Version History & Roadmap

### Current Features (v1.0+)
- ✅ Jellyfin authentication with server auto-detection
- ✅ Dual layout engines (line + grid)
- ✅ Advanced text layers with strokes and shadows
- ✅ Real-time effects (reflections, blur, overlays)
- ✅ IndexedDB intelligent caching
- ✅ Meilisearch plugin auto-detection with fallback
- ✅ Complete session persistence
- ✅ Responsive UI with draggable windows
- ✅ Multi-source image loading (Jellyfin, local, drag-drop)
- ✅ Pin protection and randomization

### Future Enhancements
- 🔄 Color grading and filters
- 🔄 Batch image processing
- 🔄 SVG text support

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🙏 Contributing

Contributions welcome! Areas of interest:
- Performance optimizations
- UI/UX improvements
- New layout algorithms
- Jellyfin API extensions
- Localization/translations

---

## 💬 Support & Issues

📧 **GitHub Issues:** [Report bugs here](https://github.com/jeffersoncgo/CoverMaker/issues)

---

**Made with ❤️ for Jellyfin enthusiasts**
