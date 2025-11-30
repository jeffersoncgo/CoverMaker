# CoverMaker Features Documentation

## Current Features (Fully Implemented)

### Multiple Text Layers System

Create unlimited text layers with independent controls for each layer.

**Features:**
- Add, remove, duplicate text layers
- Show/hide layers independently (eye icon)
- Reorder layers via drag or buttons
- Set default layer styles

**Location:** Settings tab → Text section

### Text Layer Controls (UI Available)

Each text layer currently supports:

#### Basic Text
- Text content input
- Font selection (800+ Google Fonts)
- Font size (numeric input)
- Font style (normal, italic, oblique)
- Font weight (lighter, normal, bold, bolder)
- Font color (color picker)
- Font opacity (0-1 slider)

#### Position & Rotation
- Text alignment (left, center, right)
- Baseline (top, middle, bottom)
- Offset X and Y (numeric input)
- Rotation in degrees (numeric input)

#### Frame (Stroke)
- Multiple frames per layer
- Frame color with opacity
- Frame width control
- Enable/disable individual frames
- Duplicate and delete frames

#### Bloom (Shadow)
- Multiple bloom effects per layer
- Color selection
- Blur amount
- Offset X and Y controls
- Enable/disable individual blooms
- Duplicate and delete blooms

### Image Slot Management

**Slot Controls:**
- Add/remove slots
- Reorder via drag-and-drop or buttons
- Pin/unpin slots to protect from randomization
- Clear slot content
- Randomize individual or all slots
- Load local images via file picker
- View images in new tab

**Bulk Operations:**
- Pin/unpin all slots
- Clear all slots
- Delete all slots
- Reverse slot order
- Randomly shuffle slots

### Layout Modes (18 Total)

Select from 18 different layout algorithms:

1. **Line** - Horizontal line with optional reflections
2. **Grid** - Auto-calculated optimal grid
3. **Mosaic** - Binary space partitioning mosaic
4. **Circle** - Circular pizza-slice arrangement
5. **Collage** - Scattered polaroid-style
6. **Italic Line** - Skewed line layout
7. **Carousel** - 3D carousel effect
8. **Fan Spread** - Cards in fan pattern
9. **Scattered Stack** - Book-like stacking
10. **Spiral** - Logarithmic spiral
11. **Waves** - Sinusoidal wave pattern
12. **Book Stack** - Physical book stacking
13. **Polaroid Wall** - Photos with tape
14. **Shrink** - Concentric shrinking layers
15. **Scattered Photos** - Random polaroids
16. **Card Fan** - Playing card spread
17. **Mondrian** - Mondrian-inspired grid
18. **Framed Grid** - Gallery-style frames

**Location:** Settings tab → Image section → Type dropdown

### Canvas Settings

**Format Options:**
- Cover (16:9 landscape)
- Poster (9:16 portrait)
- Square (1:1)
- Custom (specify width/height)

**Layout Options:**
- Type: Select from 18 layout modes
- Margin Size: Spacing between elements
- Random Salt: Seed for randomization (layouts that support it)
- Poster Scale: Overall image sizing (0.1-10)

**Reflex Settings (Line layouts):**
- Blur Strength (0-100)
- Reflex Distance (0-1)
- Reflex Scale (0-1)

**Overlay Settings:**
- Start: Color and opacity
- End: Color and opacity
- Creates gradient overlay on final composition

**Export Options:**
- Format: PNG or JPEG
- JPEG Quality: 0-1 (for JPEG only)

**Location:** Settings tab → Image section

### Project Management

**Save/Load Projects:**
- Export Project: Saves complete project as .covermaker.zip
- Import Project: Load previously saved projects
- Projects include: all settings, text layers, slot images, and configurations

**Storage:**
- localStorage: Automatic save of current state
- IndexedDB: Jellyfin library cache
- Session restore on page reload

### Jellyfin Integration

**Features:**
- Direct server login
- Library browsing
- Meilisearch auto-detection for fast search
- IndexedDB caching for offline access
- Drag-and-drop images to slots
- Click images to load into first empty slot

**Search & Pagination:**
- Search bar for filtering
- Configurable page size (10, 20, 50, 100)
- Previous/Next page navigation
- Random filter button

## How to Use

### Creating Multi-Layer Text

1. Go to **Settings** tab
2. Expand **Text** section
3. Click **+** to add a new text layer
4. Enter your text and configure:
   - Font, size, color
   - Position and rotation
   - Add Frame (stroke) effects
   - Add Bloom (shadow) effects
5. Toggle layer visibility with eye icon
6. Duplicate successful layers

### Adding Multiple Frames

1. In a text layer, expand **Frame** section
2. Click **+** to add frames
3. Configure each frame:
   - Color and opacity
   - Width
4. Stack multiple frames for outlined effects
5. Toggle individual frames on/off

### Adding Multiple Blooms

1. In a text layer, expand **Bloom** section
2. Click **+** to add blooms
3. Configure each bloom:
   - Color
   - Blur amount
   - X and Y offsets
4. Create glow effects with multiple blooms
5. Use different colors for rainbow effects

### Trying Different Layouts

1. Go to **Settings** tab
2. Expand **Image** section
3. Select from **Type** dropdown
4. Adjust **Random Salt** to vary randomized layouts
5. Adjust **Poster Scale** to change image sizing
6. For Line layouts, configure **Reflex** settings

### Working with Jellyfin

1. Click **Login to Jellyfin** button
2. Enter server URL, username, password
3. Click library to browse
4. Use search bar to filter items
5. Drag images to slots OR click to auto-fill
6. Use pagination controls to browse pages

## Tips and Tricks

### Creating Layered Text Effects

1. Create base text layer with solid color
2. Add multiple frames of decreasing width for outline effect
3. Add bloom underneath for glow
4. Duplicate layer and rotate slightly for shadow

#### Text Effects Seed

- Many text effects that use randomness now expose a `Seed` parameter; using the same seed will produce deterministic, repeatable results across renders.
- Set `Seed` to 0 to fall back to non-deterministic Math.random behavior (default).

### Layout Salt Experimentation

- Change Random Salt value (1-100+) to get different variations
- Same salt = same result (deterministic)
- Works for: Mosaic, Collage, Spiral, Waves, Polaroid Wall, Scattered Photos, Mondrian

### Performance Optimization

- Hide layers you're not editing (eye icon)
- Reduce bloom blur values if slow
- Use fewer text layers for complex projects
- Choose simpler layouts for many images (Grid vs Collage)

### Saving Your Work

- Click **Save Project File** regularly
- Projects save as .covermaker.zip
- Include project filename in save dialog
- Can re-open and continue editing anytime

## Browser Compatibility

All features work in modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

**Required APIs:** Canvas, OffscreenCanvas, IndexedDB, localStorage

## Troubleshooting

### Text Issues

**Text not visible:**
- Check layer enabled (eye icon should show eye, not crossed)
- Verify opacity slider is not at 0
- Ensure text color contrasts with background
- Check position offsets aren't pushing text off canvas

**Font not loading:**
- Wait a few seconds for Google Fonts to load
- Check browser console for errors
- Try a different font

### Image Issues

**Slots not displaying images:**
- Check Jellyfin server is accessible
- Verify image loaded successfully (no error icon)
- Try refreshing the slot (rotate icon)

**Layout looks wrong:**
- Adjust Poster Scale slider
- Try different Random Salt value
- Check Margin Size isn't too large
- Verify enough slots exist for chosen layout

### Performance Issues

**Slow rendering:**
- Reduce number of text layers
- Lower bloom blur values
- Disable complex layouts (use Grid instead)
- Reduce canvas dimensions

**Browser freezing:**
- Use fewer image slots
- Clear browser cache
- Restart browser
- Try Chrome/Edge for better OffscreenCanvas support

## Features In Development

These features have backend code ready but need UI integration:

- **3D Text Effects**: Depth, angle, projection
- **Gradient Text Fills**: Linear/radial gradients
- **Text Glow Effects**: Advanced glow controls  
- **Blend Modes**: For text layers
- **Image Filters**: Brightness, contrast, saturation, etc.
- **Image Transforms**: Scale, skew, flip
- **Image Borders**: Custom border styles
- **Image Cropping**: Manual crop controls
- **Image Masking**: Circle and rounded masks
- **Background Patterns**: Checkerboard, stripes, dots

**Note:** Some of these can be accessed by manually editing saved project JSON files.
