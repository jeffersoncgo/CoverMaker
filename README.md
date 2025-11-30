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

## 🌐 Try It Online

**[Launch CoverMaker →](https://jeffersoncgo.github.io/CoverMaker/)**

No installation required! Open the link and start creating stunning collection posters immediately in your browser.

---

## 🧩 Overview

**CoverMaker** is a sophisticated web-based canvas tool designed for creating custom collection posters for Jellyfin media servers. Built with pure vanilla JavaScript and modern browser APIs, it provides real-time poster composition with advanced text effects (3D, gradients, strokes, shadows, glow), multiple layout engines (18 modes), per-image filters and transforms, custom backgrounds (solid, gradient, patterns), and seamless Jellyfin integration.

The application runs entirely in the browser with **zero build tools** required. Features OffscreenCanvas rendering for performance, IndexedDB for persistent caching, and optional Meilisearch integration for fast library searches.

### ✨ Key Features

- **🎨 Advanced Canvas Rendering**: Real-time poster generation with OffscreenCanvas
- **📚 Jellyfin Integration**: Direct server authentication and library browsing
- **🔍 Intelligent Search**: Dual-mode search with Meilisearch auto-detection
- **✏️ Multi-Layer Text System**: Unlimited text layers with 3D effects, gradients, strokes, and shadows
- **🖼️ Per-Image Filters**: Individual transform, rotation, and scale for each image
- **🎭 18 Layout Modes**: Line, Grid, Mosaic, Circle, Collage, Italic Line, Carousel, Fan Spread, Scattered Stack, Spiral, Waves, Book Stack, Polaroid Wall, Shrink, Scattered Photos, Card Fan, Mondrian's Grid, and Framed Grid
- **🎨 Custom Backgrounds**: Solid colors, gradient overlays, and patterns (checkerboard, stripes, dots)
- **💾 Project Management**: Save/load complete projects as JSON files
- **🎯 Drag & Drop**: Intuitive slot management with reordering and pin protection
- **🌐 No Backend Required**: Fully client-side with localStorage and IndexedDB persistence

---

## 🚀 Quick Start

1. **[Open CoverMaker](https://jeffersoncgo.github.io/CoverMaker/)** in your browser
2. **Add Image Slots**: Click the `+` button to add poster positions
3. **Load Images**:
   - **From Jellyfin**: Login and browse your media library
   - **From Local Files**: Click the folder icon on any slot to upload
   - **Via Drag & Drop**: Drop images directly onto slots
4. **Choose Layout**: Select from 18 different layout modes (Settings tab)
5. **Add Text**: Create text layers with advanced effects
6. **Export**: Download as PNG/JPEG or save project for later editing

> 💡 Dica: em controles numéricos (slider/number) na interface de parâmetros, você pode dar **duplo clique** para alternar entre o controle por slider (`range`) e o campo numérico (`number`).

### Jellyfin Integration

The app seamlessly connects to your Jellyfin server:
- Automatic server authentication with credential persistence
- Meilisearch plugin auto-detection for fast library search
- IndexedDB caching for instant offline access
- Smart incremental updates when your library changes
- Advanced filtering by tags, genres, studios, ratings, and years

---

## 🎨 Gallery & Examples

See what you can create with CoverMaker! Each example includes a downloadable project file.

### Example 1: Line Layout - Film Collection
![Line Layout Example](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_line_movies_app.png)

**Features Used:** 
- Line layout mode with reflection effects (distance: 0.7, scale: 0.8)
- Single text layer ("MOVIES") with Francois One font (382px)
- Multiple strokes: white outline (35px), yellow border (28px), black inner stroke (14px)
- 4 directional shadows in red (#ff7a7a) for glow effect
- Cover format (1920x1080)

📦 **[Download Project](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_line_movies_project.zip)**

<details>
<summary>🖼️ <b>View Final Result</b> (Click to expand)</summary>

![Final Result](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_line_movies_reulst.png)

</details>

---

### Example 2: Scattered Photos Layout - Scary Movie Collection
![Scattered Photos Layout Example](https://jeffersoncgo.github.io/CoverMaker/images/demo/poster_scatared-photos_collecion-scary-movie_app.png)

**Features Used:**
- Scattered Photos layout mode with 26 image slots
- 3 independent text layers with Paytone One font (168px title, 120px subtitle)
- Layer 1: "SCARY" - rotated -17°, left-aligned
- Layer 2: "MOVIE" - rotated 24°, right-aligned
- Layer 3: "COLLECTION" - bottom positioned
- Each layer with white stroke (2px) and white offset shadow
- Poster format (1080x1920)
- Salt value: 20 for controlled randomization

📦 **[Download Project](https://jeffersoncgo.github.io/CoverMaker/images/demo/poster_scatared-photos_collecion-scary-movie_project.zip)**

<details>
<summary>🖼️ <b>View Final Result</b> (Click to expand)</summary>

![Final Result](https://jeffersoncgo.github.io/CoverMaker/images/demo/poster_scatared-photos_collecion-scary-movie_reulst.png)

</details>

---

### Example 3: Collage Layout - Anime Collection
![Anime Collection Example](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_collage_animes_app.png)

**Features Used:**
- Collage layout mode with 20 image slots
- Single text layer ("ANIMES") with Akaya Kanadaka font (462px, italic)
- Thick black stroke (18px) for high contrast
- Dual shadows: white glow (45px blur) + black depth (8px blur, 20px offset)
- Gradient overlay (opacity 0.1-0.4) for subtle darkening
- Cover format (1920x1080)
- Salt value: 3

📦 **[Download Project](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_collage_animes_project.zip)**

<details>
<summary>🖼️ <b>View Final Result</b> (Click to expand)</summary>

![Final Result](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_collage_animes_reulst.png)

</details>

---

### Example 4: Collage Layout - War Collection
![War Collection Example](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_collage_war_project_app.png)

**Features Used:**
- Collage layout mode with multiple image slots
- Custom text layers with professional styling
- Strategic use of frames (strokes) and blooms (shadows)
- Cover format (1920x1080)
- Optimized salt value for balanced composition

📦 **[Download Project](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_collage_war_project.covermaker.zip)**

<details>
<summary>🖼️ <b>View Final Result</b> (Click to expand)</summary>

![Final Result](https://jeffersoncgo.github.io/CoverMaker/images/demo/cover_collage_war_project_reulst.png)

</details>

---

### 🎨 Share Your Creations!

We'd love to see what you create with CoverMaker! If you design posters or covers you're proud of, please share them with the community.

**How to contribute to the gallery:**
1. Create your design and export the final image (PNG or JPG)
2. Export your project as a ZIP file (use the export feature in the app)
3. [Open an issue](https://github.com/jeffersoncgo/CoverMaker/issues/new) or [submit a pull request](https://github.com/jeffersoncgo/CoverMaker/pulls) including:
   - Your final image file
   - Your project ZIP file
   - Brief description of your collection (optional)

Your examples will be featured here and help inspire other users!

---

## 🎭 Layout Modes

CoverMaker offers 18 distinct layout algorithms to arrange your images:

### **Line**
Arranges images in a horizontal or vertical line with optional reflection effects. Perfect for classic collection banners with professional reflections. Images are evenly spaced with customizable reflection distance (0-1) and scale (0-1).

### **Grid**
Intelligently distributes images in an optimal grid pattern. Automatically calculates the best row/column arrangement based on canvas aspect ratio and number of images. Ideal for large collections.

### **Mosaic**
Creates professional mosaic arrangements using Binary Space Partitioning for 100% canvas coverage. Images are arranged in varied sizes with deterministic randomization based on salt value. Features polaroid-style white borders and subtle rotations.

### **Circle**
Arranges images in a circular "pizza slice" pattern. Single images appear as circles; multiple images create pie chart style compositions. Each slice fills its wedge section perfectly.

### **Collage**
Scatters images with varied sizes and positions. First image serves as full background, remaining images arranged in grid-based positions with random scatter. Features polaroid-style frames with shadows and rotations for scrapbook aesthetic.

### **Italic Line**
Line layout with adjustable skew angle (controlled by salt 0-720). Creates dynamic slanted arrangements with properly aligned reflections. Maintains all line layout features (reflections, spacing, blur) while adding perspective tilt.

### **Carousel**
3D carousel effect with first image as background. Remaining images rotate in elliptical pattern with perspective scaling (closer = larger). Features depth-based shadows and opacity. Salt value controls rotation offset.

### **Fan Spread**
Cards spread in fan pattern from center. First image as background, remaining cards arranged in arc with increasing opacity toward front. Lateral offset and vertical wave pattern controlled by salt. Maximum spread angle: 20-50 degrees based on count.

### **Scattered Stack**
Book-like stack with controlled scatter. First image fills canvas as background, remaining cards stack with size reduction per layer (3% per card). Position and rotation influenced by salt for deterministic randomization.

### **Spiral**
Images arranged in logarithmic spiral from center outward. First image as background, remaining images follow spiral path with decreasing size. Spiral tightness (0.15-0.30) and rotation speed (2.5-4.5 rotations) controlled by salt.

### **Waves**
Wave pattern arrangement with first image as background. Remaining images alternate left-right positions while following sinusoidal wave path. Wave frequency (1.5-3 waves) and amplitude (8-20% of width) controlled by salt.

### **Book Stack**
Physical stacking grid with 30% overlap. Calculates optimal rows/columns based on canvas ratio. Portrait aspect (0.70) with rounded corners and shadows. Subtle rotations per poster influenced by salt. Maximizes canvas coverage.

### **Polaroid Wall**
Scattered polaroid-style photos on textured background. First image as darkened background, remaining images in grid-based positions with organic scatter. Features tape pieces (top or corner, chosen by salt), realistic shadows, and varied rotations.

### **Shrink**
Concentric layers shrinking toward center. Each layer 85% of previous (15% reduction ensures 20%+ of previous layer visible). No salt influence—pure geometric progression. Front layers have scaled shadows and optional white borders.

### **Scattered Photos**
First image fills canvas as background, remaining images scattered as polaroid-style photos. Deterministic randomization based on salt controls position, rotation, and scale. Features white borders, realistic shadows, and varied aspect ratios (portrait, square, landscape).

### **Shrink**
Concentric layers shrinking toward center. Each layer 85% of previous (15% reduction ensures 20%+ of previous layer visible). No salt influence—pure geometric progression. Front layers have scaled shadows and optional white borders.

### **Card Fan**
Playing card fan spread effect. First image as background, remaining cards arranged in arc from bottom-center. Features depth-based opacity, progressive shadows, and smooth rotation spread. Maximum angle controlled by card count.

### **Mondrian's Grid**
Inspired by Piet Mondrian's compositions. Creates artistic grid with varied rectangle sizes using Binary Space Partitioning. Each region filled with solid color or image. Salt controls split ratios and color selection for geometric variety.

### **Framed Grid**
Professional gallery-style grid with thick white frames. Portrait orientation (2:3 aspect) with consistent spacing. Calculates optimal rows/columns based on canvas ratio. Features subtle shadows and clean borders for museum-quality presentation.

---

## ⚙️ Configuration Options

### Canvas Settings

**Aspect Ratio Options:**
- **Cover** (16:9): Wide horizontal format, perfect for collection banners
- **Poster** (9:16): Vertical format, ideal for movie/series posters  
- **Square** (1:1): Balanced format for social media
- **Custom**: Define any dimensions (width/height in pixels)

**Salt Value:**
- Controls deterministic randomization in applicable layouts
- Range: 1+ (affects positioning, rotation, scatter patterns)

**Base Scale:**
- Controls overall image sizing within layout
- Range: 0.1-10 (default 1.4)

**Effects (Line/Italic Line layouts only):**
- **Blur Amount**: 0-100 (default 5)
- **Reflection Distance**: 0-1 (default 0.8)
- **Reflection Scale**: 0-1 (default 0.7)

**Overlay:**
- Start Color & Opacity (0-1, default 0.5)
- End Color & Opacity (0-1, default 0.9)

**Export:**
- Format: PNG or JPEG
- JPEG Quality: 0-1 (default 1.0)

---

### Text Layer Effects

Create unlimited text layers with professional typography:

**Basic Settings:**
- 800+ Google Fonts available
- Custom font size, weight, and style
- Solid color or gradient fills (linear/radial with multiple color stops)
- Opacity control (0-1)
- Position (X, Y) and alignment controls (left, center, right / top, middle, bottom)

**3D Effects:**
- Depth control (0-50 pixels)
- Angle control (0-360°)
- Custom 3D layer color
- Optional shadow projection

**Stroke/Outline:**
- Width: 0-20+ pixels
- Custom color with opacity (0-1)
- Multiple strokes per layer supported

**Shadow Effects:**
- Blur radius: 0+ (default 5)
- X and Y offset controls
- Custom shadow color with RGBA support
- Multiple shadows per layer supported

**Glow Effects:**
- Blur radius control
- Intensity adjustment (0-3)
- Custom glow color
- Perfect for neon/glowing text

**Transform Options:**
- Rotation (-180° to 180°)
- Scale X and Y independently
- Skew X and Y for perspective effects

**Advanced:**
- Blend modes (normal, multiply, screen, overlay, etc.)
- Layer visibility toggle
- Layer reordering (drag or up/down buttons)
- 8 text presets: Classic, Neon, Gold 3D, Chrome, Fire, Ice, Retro, Comic

---

## 🧠 Current Features

**Core Rendering:**
- ✅ OffscreenCanvas rendering for non-blocking UI
- ✅ 18 unique layout algorithms
- ✅ Custom canvas dimensions and aspect ratios
- ✅ PNG and JPEG export with quality control

**Text System:**
- ✅ Unlimited independent text layers
- ✅ 800+ Google Fonts with async loading
- ✅ 3D effects with adjustable depth and angle
- ✅ Gradient fills (linear and radial) with multiple color stops
- ✅ Multiple strokes and shadows per layer
- ✅ Glow effects with customizable intensity
- ✅ Transform controls (rotation, scale, skew)
- ✅ Blend modes and opacity control
- ✅ Layer visibility toggle and reordering
- ✅ 8 professional text presets

**Image Management:**
- ✅ Unlimited image slots with drag-and-drop reordering
- ✅ Per-image filters (brightness, contrast, saturation, hue, blur, grayscale, sepia, invert, vignette, pixelate, sharpen, drop shadow, opacity, overlay)
   - Overlay: per-effect linear gradient overlay with Start/End colors + opacities
- ✅ Per-image transforms (rotation, scale X/Y, flip, position offset)
- ✅ Image cropping and masking
- ✅ Border controls (width, color, style)
- ✅ Pin protection to lock specific images
- ✅ Random image selection from library
- ✅ 8 image filter presets (Normal, Vivid, B&W, Sepia, Cool, Warm, Dreamy, Dramatic)
- ✅ Loading placeholders and error handling

**Background System:**
- ✅ Solid colors with color picker
- ✅ Gradient backgrounds (linear/radial) with angle control
- ✅ Pattern backgrounds (checkerboard, stripes, dots)
- ✅ 8 canvas background presets
- ✅ Gradient overlay with adjustable opacity

**Jellyfin Integration:**
- ✅ Server authentication with fastest-address auto-detection
- ✅ Multiple library support with metadata caching
- ✅ IndexedDB persistent cache for offline access
- ✅ Incremental cache updates (delta sync)
- ✅ Meilisearch plugin auto-detection
- ✅ Advanced search filters (tags, genres, studios, ratings, years)
- ✅ Pagination with configurable page size

**Project Management:**
- ✅ Complete project save/load as JSON files
- ✅ Automatic localStorage persistence for settings
- ✅ Session restore on page reload

**User Interface:**
- ✅ Tabbed interface with responsive design
- ✅ Draggable floating windows
- ✅ Toast notifications
- ✅ Real-time preview updates
- ✅ Collapsible sections

---

## 🧱 Technical Architecture

### Technology Stack

**Core Technologies:**
- Pure Vanilla JavaScript (ES6+)
- HTML5 Canvas API with OffscreenCanvas
- CSS3 with Grid and Flexbox
- IndexedDB for data caching
- localStorage for preferences

**External Integrations:**
- Jellyfin Server API (optional)
- Meilisearch Plugin (optional)
- Google Fonts API

### Performance

**Rendering:**
- OffscreenCanvas prevents UI thread blocking
- Incremental redraw pipeline
- Image preprocessing and caching

**Data Management:**
- IndexedDB stores 50MB+ of library metadata
- Smart delta sync for library updates
- Debounced search prevents redundant API calls

---

## 🌐 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full Support |
| Firefox | 88+ | ✅ Full Support |
| Safari | 14.1+ | ✅ Full Support |
| Edge | 90+ | ✅ Full Support |
| IE 11 | - | ❌ Not Supported |

**Required APIs:** Canvas, OffscreenCanvas, Fetch, IndexedDB, localStorage

---

## 🐛 Troubleshooting

### Connection Issues

**"Cannot connect to Jellyfin server"**
- Verify server URL is correct (include port: `http://192.168.1.100:8096`)
- Check Jellyfin server is online and accessible
- For HTTPS, ensure valid SSL certificate

**"CORS or network error"**
- Access via online URL or local HTTP server (not `file://` protocol)

### Library & Search

**"Library not loading"**
- First login takes 10-30 seconds to cache metadata
- Clear browser cache/IndexedDB and retry
- Check browser console (F12) for errors

**"Images not displaying"**
- Verify images exist in Jellyfin library
- Try refresh icon on slot
- Check image permissions in Jellyfin

### Rendering

**"Canvas not updating"**
- Click canvas to trigger manual refresh

**"Text not visible"**
- Check layer visibility (eye icon)
- Verify opacity is not 0
- Ensure text color contrasts with background

### Export

**"Downloaded image is blank"**
- Ensure at least one image is loaded before exporting

**"Export quality is low"**
- Adjust quality in Settings → Export Options

### Performance

**"App is slow or laggy"**
- Reduce number of text layers
- Use simpler layout modes
- Reduce canvas dimensions
- Close other browser tabs

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🚧 Features In Development

The following features have backend implementation ready but are pending UI integration:

**Image Effects - Advanced Controls:**
- [ ] **Image Cropping**: Backend supports crop with X, Y, Width, Height controls (0-1 range) - UI controls needed
- [ ] **Image Masking**: Backend supports mask types (none, circle, rounded) with borderRadius (0-50) - UI controls needed
- [ ] **Border Controls**: Backend supports borders with width (0-20), color, and style (solid, dashed, dotted) - UI controls needed
- [ ] **Invert Filter**: Backend supports invert (0-100) - UI slider needed to complete filter set

**Text Effects:**
 - ✅ **Seed Parameter**: Many text effects now support an optional `Seed` parameter for deterministic randomness — use the same seed to reproduce the same effect across renders. Set seed to `0` (default) to use non-deterministic randomness (Math.random) like before.

Example usage:
```js
// Apply grunge effect with deterministic randomness (seed > 0)
applyTextEffect(ctx, canvas, 'grunge', 'Hello', 0, 0, { strength: 0.6, seed: 12345 });
// Use seed=0 (default) to fall back to Math.random behavior for non-deterministic randomness
applyTextEffect(ctx, canvas, 'grunge', 'Hello', 0, 0, { strength: 0.6, seed: 0 });
```
- [ ] **3D Effect**: Backend fully implemented with depth and angle controls - UI integration pending
- [ ] **Glow Effect**: Backend supports glow with blur and intensity - UI controls pending
- [ ] **Gradient Fills**: Backend supports linear/radial gradients - UI controls pending
- [ ] **Blend Modes**: Backend supports multiple blend modes - UI dropdown pending
- [ ] **Transform Controls**: Backend supports scale, skew, advanced positioning - UI controls pending

---

## 🙏 Contributing

Contributions welcome! Areas of interest:
- Performance optimizations
- UI/UX improvements
- New layout algorithms
- Jellyfin API extensions
- Implementing planned features listed above

---

## 💬 Support & Issues

📧 **GitHub Issues:** [Report bugs here](https://github.com/jeffersoncgo/CoverMaker/issues)

---

**Made with ❤️ for Jellyfin enthusiasts**
