# Enhanced Features Documentation

## New Advanced Controls

### Multiple Text Layers System

Create unlimited text layers with independent controls for each layer.

**Features:**
- Add, remove, duplicate, and reorder text layers
- Show/hide layers independently
- Active layer selection for editing

**Location:** Text Layers tab

### Advanced Text Effects

Each text layer supports:

#### 3D Effects
- Adjustable depth (0-50px)
- Angle control (0-360°)
- Custom 3D color
- Shadow projection

#### Gradient Fills
- Linear and radial gradients
- Multiple color stops
- Angle control
- Solid color alternative

#### Stroke & Outline
- Adjustable width (0-20px)
- Custom color
- Can be combined with other effects

#### Shadow Effects
- X and Y offset control
- Blur intensity
- Custom shadow color
- RGBA support

#### Glow Effects
- Blur radius control
- Intensity adjustment (0-3)
- Custom glow color
- Perfect for neon effects

#### Transform Options
- Rotation (-180° to 180°)
- Scale X and Y independently
- Skew X and Y
- Position control (X, Y from 0-1)

#### Additional Controls
- Opacity (0-1)
- Blend modes (multiply, screen, overlay, etc.)
- Font family, size, weight, and style

### Per-Image Controls

Select any image slot to edit its properties:

#### Transform
- Rotation (-180° to 180°)
- Scale X and Y (0.1-3x)
- Position offset (X, Y)
- Flip horizontally or vertically

#### Filters
- Brightness (0-200%)
- Contrast (0-200%)
- Saturation (0-200%)
- Hue rotation (0-360°)
- Blur (0-20px)
- Grayscale (0-100%)
- Sepia (0-100%)
- Opacity (0-100%)

### Canvas Background Controls

Customize the canvas background:

#### Solid Colors
- Any color via color picker

#### Gradients
- Linear or radial
- Angle control (0-360°)
- Multiple color stops support

#### Patterns
- Checkerboard
- Horizontal stripes
- Vertical stripes
- Dots
- Adjustable size and colors

### New Layout Modes

Choose from 6 different layout arrangements:

1. **Line** - Horizontal/vertical line arrangement with reflections
2. **Grid** - Auto-calculated grid layout
3. **Mosaic** - Smart arrangement for 1-4 images
4. **Circle** - Circular arrangement around center
5. **Collage** - Random-style placement
6. **Free Position** - Manual positioning for each image

### Preset System

Quick-apply professional presets:

#### Text Presets
- Classic (white text with black stroke)
- Neon (glowing cyan effect)
- Gold 3D (metallic gradient with 3D)
- Chrome (reflective metal look)
- Fire (red-yellow gradient with glow)
- Ice (blue-white gradient with glow)
- Retro (colorful gradient with offset shadow)
- Comic (bold black outline)

#### Image Presets
- Normal
- Vivid (enhanced colors)
- Black & White
- Sepia
- Cool (blue tint)
- Warm (orange tint)
- Dreamy (soft and bright)
- Dramatic (high contrast)

## How to Use

### Creating Text with 3D Effects

1. Go to **Text Layers** tab
2. Click **+** to add a new text layer
3. Enter your text in "Text Content"
4. Check "3D Effect" checkbox
5. Adjust Depth (try 15)
6. Adjust Angle (try 135°)
7. Choose a 3D color
8. Optionally add shadow for more depth

### Applying Image Filters

1. Click on any image slot in **Image Slots** tab
2. Go to **Image Effects** tab
3. Adjust sliders for desired effect
4. Or click a preset for instant styling

### Creating Custom Backgrounds

1. Go to **Settings** tab
2. Find "Background" dropdown
3. Choose:
   - **Solid**: Pick a color
   - **Gradient**: Choose type, angle, and colors
   - **Pattern**: Select pattern type and customize

### Trying Different Layouts

1. Go to **Settings** tab
2. Find "Layout" dropdown
3. Select different modes to see how your images arrange
4. **Free Position** mode allows manual placement

## Tips and Tricks

### Creating Professional Looking Text

1. Start with a preset (Gold 3D or Chrome work great)
2. Adjust the position to center it properly
3. Add a subtle glow or shadow for depth
4. Scale if needed using Transform controls

### Achieving Cohesive Image Look

1. Select all images you want to match
2. Apply the same image preset to each
3. Or manually adjust filters to match
4. Use opacity to blend images into background

### Using Multiple Text Layers

1. Create a title layer (large, bold, 3D)
2. Create a subtitle layer (smaller, different position)
3. Create accent text (different color/effect)
4. Layer order matters - drag to reorder

### Performance Optimization

- Hide layers you're not actively editing
- Reduce blur values if rendering is slow
- Use fewer gradient stops for smoother performance

## Keyboard Shortcuts

- **Click image slot** → Select for editing
- **Click text layer** → Make active
- **Checkbox effects** → Quick enable/disable

## Browser Compatibility

All features work in modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

**Text not rendering:**
- Check if layer is visible (eye icon)
- Verify opacity is not 0
- Check position values (should be 0-1)

**Images look wrong:**
- Click "Reset All" in Image Effects
- Verify filters are at default values
- Check transform values

**Performance issues:**
- Reduce number of text layers
- Lower blur values
- Disable unused effects
- Use simpler layouts

## Technical Details

### Text Rendering
- Uses HTML5 Canvas 2D context
- Real-time effects rendering
- OffscreenCanvas for performance
- Font loading via Google Fonts API

### Image Processing
- Filter composition via CSS filters
- Transform matrix for rotation/scale/skew
- Clipping paths for masks
- Alpha compositing for opacity

### Layout Engine
- Modular layout system
- Auto-calculated positioning
- Responsive to canvas size
- Supports custom arrangements
