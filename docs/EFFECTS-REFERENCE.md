# CoverMaker — layouts and effects reference

> Generated automatically from `js/compositeRegistry.js`, `js/effectsRegistry.js` and `js/textEffects.js`
> (regenerated on 2026-10-23). The `globalOpacity` parameter (0…1, default 1), injected into every text effect by
> `getAvailableTextEffects()`, is left out of the tables.
>
> `innerShadow` and `extrude` were declared twice in `TEXT_EFFECTS`, and the second declaration hid the first.
> Since 2026-10-23 the first ones are back as `innerShadowOffset` ("Inner Shadow (Offset)") and `extrudeShaded`
> ("3D Extrude (Shaded)"); `innerShadow` and `extrude` work as before (`CM-07` in [`AUDIT.md`](AUDIT.md)).
> "Section title" rows are entries without a `key` that only group the controls on screen.

## Composites (image layouts) — `js/compositeRegistry.js` (40)

| ID | UI name | Parameters |
|---|---|---|
| `barcode` | Barcode | `strips` (range 10…100, default 40)<br>`mode` (select [Vertical, Horizontal], default "Vertical") |
| `bookStack` | Book Stack | `salt` (range 1…100, default 1)<br>`overlap` (range 0.5…0.9, default 0.7) |
| `bubbles` | Bubbles | `minSize` (range 50…200, default 80)<br>`maxSize` (range 150…400, default 250)<br>`salt` (range 1…100, default 1) |
| `cardFan` | Card Fan | `salt` (range 1…100, default 1) |
| `carousel` | 3D Carousel | `salt` (range 0…100, default 1) |
| `cctv` | CCTV / Security | `columns` (range 2…5, default 2)<br>`noise` (range 0…100, default 20)<br>`seed` (range 0…1000, default 0) |
| `chessboard` | Chessboard | `size` (range 2…10, default 4)<br>`opacity` (range 0…1, default 1) |
| `cinematicBars` | Letterbox | `ratio` (select [2.35:1 (Cinema), 16:9 (TV), 4:3 (Classic), 1:1 (Square)], default "2.35:1 (Cinema)")<br>`color` (color, default "#000000")<br>`blur` (range 0…20, default 0) |
| `circle` | Pie | `salt` (range 0…360, default 0) |
| `collage` | Dynamic Collage | `salt` (range 1…100, default 1) |
| `comicLayout` | Comic Page | `gutter` (range 0…20, default 8)<br>`border` (range 0…10, default 3)<br>`seed` (range 0…1000, default 0) |
| `diagonalSlash` | Diagonal Slash | `angle` (range -45…45, default -15)<br>`spacing` (range 0…30, default 10)<br>`borderColor` (color, default "#ffffff") |
| `doubleExposure` | Double Exposure | `blendMode` (select [Screen, Multiply, Source In, Lighter], default "Screen")<br>`intensity` (range 0…1, default 0.8)<br>`zoom` (range 0.5…2, default 1) |
| `editorial` | Editorial | `layout` (select [Left Hero, Right Hero, Top Hero], default "Left Hero")<br>`split` (range 30…80, default 60)<br>`gap` (range 0…20, default 5) |
| `fanSpread` | Fan Spread | `salt` (range 1…100, default 1) |
| `filmRoll3D` | 3D Film Roll | `seed` (range 1…100, default 1)<br>`zoom` (range 0.1…14, default 1) |
| `filmStrip` | Film Strip | `orientation` (select [Horizontal, Vertical], default "Horizontal")<br>`spacing` (range 0…50, default 10)<br>`color` (color, default "#111111") |
| `framedGrid` | Framed Grid | `salt` (range 1…100, default 1) |
| `glitchMosaic` | Glitch Mosaic | `intensity` (range 1…20, default 5)<br>`scale` (range 10…100, default 40)<br>`seed` (range 0…1000, default 0) |
| `grid` | Simple Grid | `baseScale` (range 0.1…1.5, default 1)<br>`spacing` (range 0…50, default 5) |
| `honeycomb` | Honeycomb | `spacing` (range 0…20, default 5)<br>`scale` (range 0.5…1.5, default 1) |
| `isometricGrid` | Isometric Grid | `size` (range 50…300, default 150)<br>`gap` (range 0…20, default 5) |
| `jigsawPuzzle` | Jigsaw Puzzle | `pieces` (range 4…64, default 16)<br>`seed` (range 1…100, default 1) |
| `kaleidoscope` | Kaleidoscope | `segments` (range 4…24, default 8)<br>`seed` (range 1…100, default 1) |
| `line` | Line | `enableReflection` (checkbox, default true)<br>`baseScale` (range 0.1…2, default 1.35)<br>`spacing` (range 0…100, default 3)<br>`salt` (range 0…720, default 0)<br>`reflectionDistance` (range 0…1, default 0.68)<br>`reflectionScale` (range 0…1, default 0.87)<br>`blurAmount` (range 0…100, default 3.5)<br>`startColor` (color, default "#000000")<br>`endColor` (color, default "#000000")<br>`startOpacity` (range 0…1, default 0.1)<br>`endOpacity` (range 0…1, default 1) |
| `mondrian` | Mondrian Grid | `salt` (range 1…100, default 1)<br>`spacingColor` (color, default "#ffffff") |
| `mosaic` | Smart Mosaic | `spacing` (range 0…20, default 3)<br>`salt` (range 1…100, default 1) |
| `perspectiveWall` | Perspective Wall | `direction` (select [Left, Right], default "Right")<br>`depth` (range 0.1…0.9, default 0.6) |
| `polaroidWall` | Polaroid Wall | `salt` (range 1…100, default 1) |
| `pyramid` | Pyramid Stack | `spacing` (range 0…20, default 5) |
| `radialBurst` | Radial Burst | `centerGap` (range 0…200, default 50) |
| `scatteredPhotos` | Scattered Photos | `salt` (range 1…100, default 1) |
| `scatteredStack` | Scattered Stack | `salt` (range 1…100, default 1) |
| `shattered` | Shattered Glass | `shards` (range 5…50, default 15)<br>`gap` (range 0…20, default 2)<br>`glassOpacity` (range 0.1…1, default 0.9)<br>`seed` (range 1…100, default 1) |
| `shrink` | Shrink Tunnel | `scaleStep` (range 0.5…0.95, default 0.85) |
| `spiral` | Spiral | `salt` (range 1…100, default 1) |
| `textSpace` | Fade | `direction` (select [Bottom, Top, Left, Right], default "Bottom")<br>`size` (range 10…100, default 40)<br>`color` (color, default "#000000") |
| `triptych` | Triptych | `gap` (range 0…50, default 20)<br>`border` (range 0…20, default 0) |
| `versus` | Versus | `angle` (range -45…45, default 15)<br>`gap` (range 0…50, default 10)<br>`color` (color, default "#ff0000") |
| `waves` | Waves | `salt` (range 1…100, default 1) |

## Image effects — `js/effectsRegistry.js` (16)

| ID | UI name | Parameters |
|---|---|---|
| `blur` | Blur | `amount` (range 0…100, default 5)<br>`edges` (select [Classic, Extend Edges], default "Classic") |
| `brightness` | Brightness | `amount` (range 0…4, default 1) |
| `contrast` | Contrast | `amount` (range 0…3, default 1) |
| `flip` | Flip | `horizontal` (checkbox, default true)<br>`vertical` (checkbox, default false) |
| `grayscale` | Grayscale | `amount` (range 0…1, default 1) |
| `hueRotate` | Hue Rotate | `angle` (range 0…360, default 0) |
| `invert` | Invert | `amount` (range 0…1, default 1) |
| `overlay` | Overlay | `startColor` (color, default "#000000")<br>`startOpacity` (range 0…1, default 0.5)<br>`endColor` (color, default "#000000")<br>`endOpacity` (range 0…1, default 0.9) |
| `pixelate` | Pixelate | `pixelSize` (range 1…64, default 8) |
| `reflection` | Reflection | `scaleY` (range 0.1…1, default 0.75)<br>`skewX` (range -2…2, default 0)<br>`trim` (range 0…0.5, default 0)<br>`size` (range 0.05…1, default 0.5)<br>`offsetX` (range -2000…2000, default 0)<br>`offset` (range -2000…2000, default -327)<br>`opacity` (range 0…1, default 0.5)<br>`blur` (range 0…20, default 2)<br>`fadeStart` (range 0…1, default 0)<br>`fadeEnd` (range 0…1, default 1) |
| `saturate` | Saturate | `amount` (range 0…3, default 1) |
| `scale` | Scale | `scaleX` (range 0.01…2, default 0.95)<br>`scaleY` (range 0.01…2, default 0.95)<br>`offsetX` (range -2000…2000, default 0)<br>`offsetY` (range -2000…2000, default 0)<br>`backgroundColor` (color, default "#000000")<br>`backgroundOpacity` (range 0…1, default 1) |
| `scanLines` | Scanlines | `opacity` (range 0…1, default 0.2)<br>`density` (range 1…10, default 8) |
| `sepia` | Sepia | `amount` (range 0…1, default 0) |
| `sharpen` | Sharpen | `amount` (range 0…2, default 1) |
| `vignette` | Vignette | `intensity` (range 0…1, default 0.5) |

## Text effects — `js/textEffects.js` (88)

| ID | UI name | Parameters |
|---|---|---|
| `acidCorrosion` | Acid Corrosion | `acidColor` (color, default "#aaff00")<br>`damage` (range 0.1…0.8, default 0.4)<br>`melt` (range 0…50, default 15)<br>`seed` (range 1…100, default 7) |
| `actionSpeedlines` | Anime Speedlines | `color` (color, default "#ffffff")<br>`density` (range 10…200, default 80)<br>`thickness` (range 1…20, default 4)<br>`centerClear` (range 0…1, default 0.3)<br>`mode` (select [Behind Text, Inside Text, Lines Only], default "Inside Text")<br>`seed` (range 1…100, default 99) |
| `adjustments` | Color Adjust | `hue` (range 0…360, default 0)<br>`sat` (range 0…200, default 100)<br>`bright` (range 0…200, default 100)<br>`contrast` (range 0…200, default 100) |
| `arch` | Arch | `curve` (range -1920…1920, default 50)<br>`offsetY` (range -100…100, default 0) |
| `balloon` | 3D Plastic Balloon | `color` (color, default "#ff0055")<br>`inflation` (range 5…40, default 20)<br>`shininess` (range 10…100, default 80) |
| `bevelEmboss` | Bevel Emboss | `size` (range 1…20, default 4)<br>`softness` (range 0…20, default 2)<br>`angle` (range 0…360, default 135)<br>`highlight` (color, default "#ffffff")<br>`shadow` (color, default "#000000")<br>`strength` (range 0…1, default 0.65) |
| `blueprint` | Blueprint / CAD | `lineColor` (color, default "#aaddff")<br>`bgColor` (color, default "#003366")<br>`lineWidth` (range 0.5…5, default 1.5)<br>`gridAlpha` (range 0…1, default 0.3)<br>`grid` (checkbox, default true)<br>`guides` (checkbox, default true) |
| `blur` | Blur | `amount` (range 0…20, default 0) |
| `box` | Box | `color` (color, default "#ec1d24")<br>`padding` (range 0…100, default 15)<br>`radius` (range 0…50, default 0) |
| `brokenMirror` | Broken Mirror | `shards` (range 5…100, default 30)<br>`displace` (range 0…50, default 10)<br>`seed` (range 1…100, default 1) |
| `bulge` | Bulge / Pinch | `strength` (range -5…5, default 0.5)<br>`radius` (range 10…1000, default 200)<br>`offsetX` (range -1000…1000, default 0)<br>`offsetY` (range -1000…1000, default 0) |
| `carbonFiber` | Carbon Fiber | `color1` (color, default "#222222")<br>`color2` (color, default "#111111")<br>`scale` (range 2…20, default 4)<br>`shine` (range 0…1, default 0.6) |
| `channelTear` | Channel Tear | `maxShift` (range 1…80, default 16)<br>`bandHeight` (range 2…80, default 12)<br>`seed` (range 0…9999, default 101)<br>`alphaLoss` (range 0…1, default 0.08) |
| `chiseledMetal` | Gold / Chiseled Metal | **Material** _(section title)_<br>`color` (color, default "#c6a324")<br>`shine` (range 0…2, default 1.2)<br>`roughness` (range 0…20, default 14)<br>**Geometry** _(section title)_<br>`depth` (range 1…50, default 28)<br>`lightAngle` (range 0…360, default 210)<br>`seed` (range 1…100, default 46) |
| `chromatic` | Chromatic Aberration | `amount` (range 0…20, default 4)<br>`angle` (range 0…360, default 45) |
| `chrome` | Chrome / Metallic | `sky` (color, default "#33ccff")<br>`ground` (color, default "#333333")<br>`horizon` (range 0…100, default 50)<br>`edge` (range 0…10, default 2) |
| `concreteTexture` | Concrete / Stone | `lightColor` (color, default "#cccccc")<br>`darkColor` (color, default "#777777")<br>`roughness` (range 0…1, default 0.8)<br>`pores` (range 0…1, default 0.3)<br>`seed` (range 1…100, default 12) |
| `cosmicNebula` | Cosmic / Galaxy | `color1` (color, default "#ff00aa")<br>`color2` (color, default "#00ccff")<br>`stars` (range 100…2000, default 800)<br>`seed` (range 1…100, default 42) |
| `crystallize` | Crystallize | `size` (range 5…100, default 20)<br>`seed` (range 0…999, default 1) |
| `distress` | Texture | `mode` (select [noise, decay, scratch, rust, mold, scanlines, fabric, glitch, vhs, burn, halftone, paper, marble, wave], default "decay")<br>`amount` (range 0…1, default 0.5)<br>`seed` (range 0…999, default 1) |
| `echo` | Echo / Trail | `count` (range 1…10, default 3)<br>`offset` (range 0…50, default 20)<br>`fade` (range 0…1, default 0.2)<br>`color` (color, default "") |
| `engravedMetal` | Engraved / LOTR | **Material** _(section title)_<br>`color` (color, default "#eeb244")<br>`shine` (range 0…3, default 1.5)<br>`roughness` (range 0…20, default 5)<br>**Chisel Geometry** _(section title)_<br>`mode` (select [Raised (Relief), Engraved (Indent)], default "Raised (Relief)")<br>`bevel` (range 1…100, default 10)<br>`depth` (range 1…100, default 30)<br>`profile` (range 0.1…2, default 0.4)<br>`lightAngle` (range 0…360, default 135)<br>**Generation** _(section title)_<br>`seed` (range 1…100, default 1) |
| `extrude` | Extrude | `depth` (range 1…120, default 18)<br>`angle` (range 0…360, default 45)<br>`color` (color, default "#202020")<br>`fade` (range 0…1, default 0.15) |
| `extrudeShaded` | 3D Extrude (Shaded) | `depth` (range 0…50, default 10)<br>`angle` (range 0…360, default 45)<br>`color` (color, default "#555555")<br>`shading` (range 0…1, default 0.5) |
| `fade` | Fade | `direction` (select [Bottom, Top, Left, Right, Vertical (Both), Horizontal (Both), Radial (Vignette)], default "Bottom")<br>`strength` (range 0…1, default 0.5)<br>`endsAt` (range 0…1, default 0) |
| `flip` | Flip | `axis` (select [Horizontal, Vertical], default "Horizontal") |
| `fluffy` | Flush / Fur | `color` (color, default "#ff88aa")<br>`length` (range 5…60, default 25)<br>`density` (range 0.1…1, default 0.5)<br>`gravity` (range -90…90, default 20)<br>`seed` (range 1…100, default 1) |
| `frozen` | Frozen / Ice | `color` (color, default "#aaccff")<br>`freeze` (range 0…100, default 50)<br>`icicles` (range 0…100, default 30)<br>`seed` (range 1…100, default 1) |
| `glassRefraction` | Glass Refraction | `intensity` (range 0…20, default 6)<br>`scale` (range 1…10, default 3)<br>`seed` (range 0…999, default 42) |
| `glitch` | Glitch | `offset` (range 0…20, default 5)<br>`sliceHeight` (range 2…50, default 10)<br>`sliceOffset` (range 0…50, default 10)<br>`seed` (range 0…999, default 0) |
| `glitterTexture` | Glitter / Sparkle | `baseColor` (color, default "#ff0077")<br>`density` (range 0.1…1, default 0.7)<br>`rainbow` (range 0…1, default 0.3)<br>`size` (range 1…4, default 2)<br>`seed` (range 0…1000, default 0) |
| `glowEdge` | Projection | `radius` (range 1…40, default 8)<br>`intensity` (range 0…1, default 0.8)<br>`color` (color, default "#ffffff") |
| `gradient` | Gradient | `color1` (color, default "#ff0000")<br>`color2` (color, default "#0000ff")<br>`angle` (range 0…360, default 0)<br>`opacity` (range 0…1, default 1) |
| `gradientMap` | Gradient Map | `shadowColor` (color, default "#1a1a1a")<br>`midColor` (color, default "#888888")<br>`highlightColor` (color, default "#ffffff")<br>`opacity` (range 0…1, default 1) |
| `gummyCandy` | Gummy / Subsurface | `color` (color, default "#ff0066")<br>`thickness` (range 1…50, default 20)<br>`sugar` (range 0…1, default 0.8)<br>`seed` (range 0…1000, default 0) |
| `hologram` | Holographic Foil | `scale` (range 10…200, default 80)<br>`complexity` (range 1…5, default 2.5)<br>`lightness` (range 20…80, default 60)<br>`angle` (range 0…360, default 45) |
| `infernoForge` | Inferno Forge | `seed` (range 1…9999, default 1337)<br>`coreColor` (color, default "#fff4d6")<br>`hotColor` (color, default "#ffb14a")<br>`midColor` (color, default "#ff5a00")<br>`darkColor` (color, default "#551100")<br>`emberColor` (color, default "#ff6a00")<br>`smokeColor` (color, default "#3a0904")<br>`glowSize` (range 0…120, default 34)<br>`glowIntensity` (range 0…8, default 3.2)<br>`outerGlowSize` (range 0…180, default 78)<br>`crackAmount` (range 0…1, default 0.42)<br>`textureScale` (range 0.5…8, default 2.4)<br>`smokeAmount` (range 0…1, default 0.58)<br>`embers` (range 0…600, default 180)<br>`showBase` (checkbox, default true) |
| `inkBleed` | Ink Bleed / Rorschach | `color` (color, default "#0d0d0d")<br>`spread` (range 0…50, default 20)<br>`mirror` (checkbox, default true)<br>`seed` (range 1…100, default 1) |
| `inlineCut` | Inline Cut | `thickness` (range 1…30, default 4)<br>`opacity` (range 0…1, default 0.35)<br>`color` (color, default "#000000") |
| `innerShadow` | Inner Shadow | `color` (color, default "#000000")<br>`distance` (range 0…80, default 8)<br>`angle` (range 0…360, default 135)<br>`blur` (range 0…40, default 10)<br>`opacity` (range 0…1, default 0.65) |
| `innerShadowOffset` | Inner Shadow (Offset) | `color` (color, default "#000000")<br>`blur` (range 0…20, default 5)<br>`offsetX` (range -20…20, default 3)<br>`offsetY` (range -20…20, default 3)<br>`opacity` (range 0…1, default 0.8) |
| `invert` | Invert / Negative | `amount` (range 0…1, default 1) |
| `leatherTexture` | Leather | `baseColor` (color, default "#3d1f00")<br>`creaseColor` (color, default "#1a0d00")<br>`scale` (range 0.01…0.2, default 0.08)<br>`depth` (range 0…1, default 0.7)<br>`seed` (range 1…100, default 5) |
| `lightning` | Lightning | `intensity` (range 0…1, default 0.6)<br>`color` (color, default "#ffffff")<br>`seed` (range 0…1000, default 123) |
| `liquidMercury` | Liquid Melt / Mercury | `melt` (range 2…40, default 12)<br>`shininess` (range 1…10, default 6) |
| `longShadow` | Shadow | `color` (color, default "#000000")<br>`length` (range 0…100, default 20)<br>`angle` (range 0…360, default 45)<br>`blur` (range 0…20, default 5)<br>`opacity` (range 0…1, default 0.5) |
| `mangaScreentone` | Manga Screentone | `dotSize` (range 2…20, default 6)<br>`spacing` (range 4…30, default 8)<br>`angle` (range 0…90, default 45)<br>`color` (color, default "#111111")<br>`gradient` (range 0…1, default 1) |
| `matrix` | Matrix / Data | `color` (color, default "#00ff00")<br>`density` (range 10…50, default 20)<br>`speed` (range 0…100, default 50)<br>`seed` (range 1…100, default 1) |
| `melt` | Melt | `strength` (range 0…100, default 20)<br>`chaos` (range 0…1, default 0.5)<br>`seed` (range 0…999, default 1) |
| `mosaic` | Mosaic | `tileSize` (range 2…64, default 16)<br>`randomness` (range 0…1, default 0.3)<br>`colorVariation` (range 0…1, default 0.2)<br>`seed` (range 0…1000, default 0) |
| `motionBlur` | Motion Blur | `angle` (range 0…360, default 0)<br>`distance` (range 0…100, default 30)<br>`opacity` (range 0…1, default 0.5) |
| `neon` | Neon | `color` (color, default "#00ff00")<br>`intensity` (range 0…50, default 2)<br>`size` (range 0…50, default 15) |
| `nordicRuneforge` | Nordic Runeforge | `seed` (range 1…9999, default 7331)<br>`runeText` (text, default "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛟ")<br>`metalLight` (color, default "#d4c4b4")<br>`metalMid` (color, default "#7a6355")<br>`metalDark` (color, default "#1c0802")<br>`patinaA` (color, default "#4d8b88")<br>`patinaB` (color, default "#7aa7a0")<br>`emberColor` (color, default "#8e1c14")<br>`extrudeDepth` (range 0…30, default 10)<br>`volumeDepth` (range 0…1, default 0.88)<br>`depthContrast` (range 0…1, default 0.75)<br>`specularStrength` (range 0…1, default 0.12)<br>`lightAngleX` (range -1…1, default -0.55)<br>`lightAngleY` (range -1…1, default -0.7)<br>`textureScale` (range 0.5…8, default 2.4)<br>`textureStrength` (range 0…1, default 0.55)<br>`patinaAmount` (range 0…1, default 0.32)<br>`engraveDepth` (range 0…1, default 0.7)<br>`runeSize` (range 0.02…0.3, default 0.09)<br>`runeSpacing` (range 0.5…3, default 1.2)<br>`emberAmount` (range 0…1, default 0.2)<br>`innerGlow` (range 0…1, default 0.38) |
| `opacity` | Opacity | `amount` (range 0…1, default 1) |
| `origamiFold` | Low-Poly / Origami | `color` (color, default "#ffaa00")<br>`complexity` (range 100…2000, default 500)<br>`contrast` (range 0.1…1, default 0.6)<br>`seed` (range 1…100, default 42) |
| `outerGlow` | Outer Glow | `color` (color, default "#00ff00")<br>`distance` (range 0…100, default 15)<br>`intensity` (range 0…10, default 2) |
| `outline` | Outline | `color` (color, default "#000000")<br>`thickness` (range 1…100, default 3) |
| `paintBrush` | Smudge | `brushSize` (range 1…128, default 12)<br>`intensity` (range 0…1, default 0.6)<br>`iterations` (range 1…20, default 6)<br>`seed` (range 0…999, default 0) |
| `pattern` | Pattern Fill | `type` (select [Dots, Stripes, Checkers, Grid], default "Stripes")<br>`size` (range 2…50, default 6)<br>`color` (color, default "#000000")<br>`bg` (select [Yes, No], default "Yes") |
| `pcbCircuit` | Circuit Board (PCB) | `board` (color, default "#003300")<br>`trace` (color, default "#ffcc00")<br>`density` (range 5…30, default 12)<br>`seed` (range 1…999, default 101) |
| `perspective` | Perspective | `depth` (range -1…1, default 0.5)<br>`direction` (select [Horizontal, Vertical], default "Horizontal") |
| `pixelMatrix` | Pixelate | `pixelSize` (range 1…64, default 8) |
| `plasma` | Plasma / Electricity | **Colors** _(section title)_<br>`coreColor` (color, default "#ffffff")<br>`glowColor` (color, default "#00ccff")<br>**Structure** _(section title)_<br>`strands` (range 2…100, default 20)<br>`sharpness` (range 1…20, default 8)<br>`detail` (range 0…2, default 1)<br>**Motion** _(section title)_<br>`warp` (range 0…50, default 15)<br>`flow` (range 0…5, default 1)<br>**Origin** _(section title)_<br>`centerX` (range -500…500, default 0)<br>`centerY` (range -500…500, default 0)<br>`seed` (range 1…100, default 1) |
| `reflection` | Reflection | `offset` (range -1500…1500, default 0)<br>`opacity` (range 0…1, default 0.5)<br>`scale` (range 0.1…1, default 0.8) |
| `retroWave` | Retro Wave / 80s | `topColor` (color, default "#ff00cc")<br>`midColor` (color, default "#ffcc00")<br>`gridColor` (color, default "#00ffff")<br>`horizon` (range 0…100, default 60)<br>`zoom` (range 0.5…5, default 1) |
| `rimLight` | Rim Light | `color` (color, default "#7fd6ff")<br>`thickness` (range 1…20, default 4)<br>`opacity` (range 0…1, default 0.8)<br>`side` (select [All, Left, Right, Top, Bottom], default "All") |
| `ring` | Ring / Circle | `radius` (range 50…500, default 200)<br>`angle` (range 90…360, default 360)<br>`rotate` (range 0…360, default 0)<br>`inward` (select [Inward, Outward], default "Inward") |
| `ripple` | Ripple | `amplitude` (range 0…60, default 8)<br>`frequency` (range 0.1…10, default 2.5)<br>`axis` (select [x, y], default "y")<br>`seed` (range -2147483648…2147483647, default 0) |
| `rotate` | Rotate | `angle` (range -180…180, default 0) |
| `roughen` | Roughen Edges | `strength` (range 0…20, default 5)<br>`scale` (range 1…20, default 10)<br>`seed` (range 0…999, default 1) |
| `sauronFire` | Sauron / Magma | **Colors** _(section title)_<br>`innerColor` (color, default "#ffb000")<br>`outerColor` (color, default "#ff3300")<br>`hotspotColor` (color, default "#ffffcc")<br>**Texture** _(section title)_<br>`scale` (range 10…100, default 40)<br>`warp` (range 0…50, default 20)<br>`veins` (range 0…2, default 0.5)<br>**Pupil** _(section title)_<br>`pupilWidth` (range 0…100, default 25)<br>`pupilHeight` (range 10…100, default 80)<br>`pupilFade` (range 0…50, default 10)<br>`pupilRim` (range 0…2, default 1.2)<br>`pupilOffset` (range -100…100, default 0)<br>`pupilOffsetY` (range -100…100, default 0)<br>**Effects** _(section title)_<br>`glowSize` (range 0…200, default 60)<br>`glowIntensity` (range 0…10, default 1.5)<br>`showBase` (checkbox, default false)<br>`seed` (range 1…100, default 1) |
| `scale` | Scale / Stretch | `w` (range 0.1…3, default 1)<br>`h` (range 0.1…3, default 1) |
| `scanLines` | Scanlines | `opacity` (range 0…1, default 0.2)<br>`density` (range 1…10, default 8) |
| `skew` | Skew | `x` (range -1…1, default -0.2)<br>`y` (range -1…1, default 0) |
| `slice` | Slice / Cut | `angle` (range -90…90, default -20)<br>`offset` (range 0…50, default 15)<br>`yPos` (range 0…100, default 50) |
| `smoke` | Smoke / Vapor | `color` (color, default "#eeeeee")<br>`density` (range 0…2, default 1)<br>`turbulence` (range 0…50, default 20)<br>`seed` (range 1…100, default 1) |
| `specular` | Specular | `angle` (range 0…360, default 25)<br>`width` (range 0.02…1, default 0.18)<br>`strength` (range 0…1, default 0.75)<br>`color` (color, default "#ffffff") |
| `splatter` | Splatter | `mode` (select [Erode, Paint], default "Erode ([REC] Style)")<br>`color` (color, default "#cc0000")<br>`density` (range 1…100, default 40)<br>`size` (range 1…50, default 15)<br>`spread` (range 0…1, default 0.8)<br>`distortion` (range 0…1, default 0.6)<br>`seed` (range 1…100, default 1) |
| `stainedGlass` | Stained Glass | `size` (range 5…100, default 20)<br>`grout` (range 0.1…10, default 2)<br>`groutStyle` (select [Hairline, Use Grout Width], default "Hairline")<br>`color` (color, default "#000000")<br>`variance` (range 0.1…1, default 0.3)<br>`seed` (range 1…100, default 1) |
| `stereo` | 3D Anaglyph | `offset` (range 0…30, default 6)<br>`mode` (select [Red/Cyan, Green/Magenta], default "Red/Cyan") |
| `stickerPeel` | Die-cut Sticker Peel | `border` (range 2…50, default 15)<br>`peelSize` (range 10…200, default 60)<br>`shadow` (range 0…1, default 0.5) |
| `stitch` | Embroidery | `size` (range 3…12, default 4)<br>`density` (range 1…4, default 2)<br>`color` (color, default "#ffffff")<br>`shadow` (range 0…1, default 0.5) |
| `topographic` | Topographic Contour | `levels` (range 5…50, default 20)<br>`thickness` (range 1…10, default 2)<br>`color` (color, default "#00ffcc")<br>`bg` (checkbox, default false) |
| `toxicSlime` | Toxic Slime | `colorA` (color, default "#00ff00")<br>`colorB` (color, default "#ffff00")<br>`drip` (range 0…100, default 40)<br>`bubbles` (range 0…50, default 20)<br>`seed` (range 1…100, default 1) |
| `vectorWarp` | Vector Warp | `amount` (range 0…50, default 12)<br>`direction` (select [left, right, up, down], default "right")<br>`frequency` (range 0.1…10, default 3) |
| `voxelIso` | 3D Voxel / Isometric | `size` (range 4…40, default 12)<br>`height` (range 1…20, default 4)<br>`angle` (range 0…360, default 0)<br>`colorTop` (color, default "#00d2ff")<br>`colorLeft` (color, default "#0088ff")<br>`colorRight` (color, default "#0044aa") |
| `waves` | Waves | `amplitude` (range 0…60, default 8)<br>`frequency` (range 0.1…10, default 2.5)<br>`axis` (select [x, y], default "y")<br>`seed` (range -2147483648…2147483647, default 1) |
| `woodTexture` | Wood Grain | `baseColor` (color, default "#8b5a2b")<br>`ringColor` (color, default "#4a2f14")<br>`rings` (range 1…50, default 15)<br>`distortion` (range 0…10, default 3.5)<br>`seed` (range 1…100, default 42) |

