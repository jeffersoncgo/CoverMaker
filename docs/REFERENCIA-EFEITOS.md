# CoverMaker — Referência de layouts e efeitos

> Gerado automaticamente a partir de `js/compositeRegistry.js`, `js/effectsRegistry.js` e `js/textEffects.js`
> (regenerado em 2026-10-23). O parâmetro `globalOpacity` (0…1, padrão 1), injetado em todos os efeitos de texto por
> `getAvailableTextEffects()`, foi omitido das tabelas.
>
> `innerShadow` e `extrude` eram declarados duas vezes em `TEXT_EFFECTS` e a segunda declaração escondia a primeira.
> Desde 2026-10-23 as primeiras voltaram como `innerShadowOffset` ("Inner Shadow (Offset)") e `extrudeShaded`
> ("3D Extrude (Shaded)"); `innerShadow` e `extrude` seguem como antes (`CM-07` em [`AUDITORIA.md`](AUDITORIA.md)).
> Linhas "título de seção" são entradas sem `key` que só organizam os controles na tela.

## Composições (layouts de imagem) — `js/compositeRegistry.js` (40)

| ID | Nome na UI | Parâmetros |
|---|---|---|
| `barcode` | Barcode | `strips` (range 10…100, padrão 40)<br>`mode` (select [Vertical, Horizontal], padrão "Vertical") |
| `bookStack` | Book Stack | `salt` (range 1…100, padrão 1)<br>`overlap` (range 0.5…0.9, padrão 0.7) |
| `bubbles` | Bubbles | `minSize` (range 50…200, padrão 80)<br>`maxSize` (range 150…400, padrão 250)<br>`salt` (range 1…100, padrão 1) |
| `cardFan` | Card Fan | `salt` (range 1…100, padrão 1) |
| `carousel` | 3D Carousel | `salt` (range 0…100, padrão 1) |
| `cctv` | CCTV / Security | `columns` (range 2…5, padrão 2)<br>`noise` (range 0…100, padrão 20)<br>`seed` (range 0…1000, padrão 0) |
| `chessboard` | Chessboard | `size` (range 2…10, padrão 4)<br>`opacity` (range 0…1, padrão 1) |
| `cinematicBars` | Letterbox | `ratio` (select [2.35:1 (Cinema), 16:9 (TV), 4:3 (Classic), 1:1 (Square)], padrão "2.35:1 (Cinema)")<br>`color` (color, padrão "#000000")<br>`blur` (range 0…20, padrão 0) |
| `circle` | Pie | `salt` (range 0…360, padrão 0) |
| `collage` | Dynamic Collage | `salt` (range 1…100, padrão 1) |
| `comicLayout` | Comic Page | `gutter` (range 0…20, padrão 8)<br>`border` (range 0…10, padrão 3)<br>`seed` (range 0…1000, padrão 0) |
| `diagonalSlash` | Diagonal Slash | `angle` (range -45…45, padrão -15)<br>`spacing` (range 0…30, padrão 10)<br>`borderColor` (color, padrão "#ffffff") |
| `doubleExposure` | Double Exposure | `blendMode` (select [Screen, Multiply, Source In, Lighter], padrão "Screen")<br>`intensity` (range 0…1, padrão 0.8)<br>`zoom` (range 0.5…2, padrão 1) |
| `editorial` | Editorial | `layout` (select [Left Hero, Right Hero, Top Hero], padrão "Left Hero")<br>`split` (range 30…80, padrão 60)<br>`gap` (range 0…20, padrão 5) |
| `fanSpread` | Fan Spread | `salt` (range 1…100, padrão 1) |
| `filmRoll3D` | 3D Film Roll | `seed` (range 1…100, padrão 1)<br>`zoom` (range 0.1…14, padrão 1) |
| `filmStrip` | Film Strip | `orientation` (select [Horizontal, Vertical], padrão "Horizontal")<br>`spacing` (range 0…50, padrão 10)<br>`color` (color, padrão "#111111") |
| `framedGrid` | Framed Grid | `salt` (range 1…100, padrão 1) |
| `glitchMosaic` | Glitch Mosaic | `intensity` (range 1…20, padrão 5)<br>`scale` (range 10…100, padrão 40)<br>`seed` (range 0…1000, padrão 0) |
| `grid` | Simple Grid | `baseScale` (range 0.1…1.5, padrão 1)<br>`spacing` (range 0…50, padrão 5) |
| `honeycomb` | Honeycomb | `spacing` (range 0…20, padrão 5)<br>`scale` (range 0.5…1.5, padrão 1) |
| `isometricGrid` | Isometric Grid | `size` (range 50…300, padrão 150)<br>`gap` (range 0…20, padrão 5) |
| `jigsawPuzzle` | Jigsaw Puzzle | `pieces` (range 4…64, padrão 16)<br>`seed` (range 1…100, padrão 1) |
| `kaleidoscope` | Kaleidoscope | `segments` (range 4…24, padrão 8)<br>`seed` (range 1…100, padrão 1) |
| `line` | Line | `enableReflection` (checkbox, padrão true)<br>`baseScale` (range 0.1…2, padrão 1.35)<br>`spacing` (range 0…100, padrão 3)<br>`salt` (range 0…720, padrão 0)<br>`reflectionDistance` (range 0…1, padrão 0.68)<br>`reflectionScale` (range 0…1, padrão 0.87)<br>`blurAmount` (range 0…100, padrão 3.5)<br>`startColor` (color, padrão "#000000")<br>`endColor` (color, padrão "#000000")<br>`startOpacity` (range 0…1, padrão 0.1)<br>`endOpacity` (range 0…1, padrão 1) |
| `mondrian` | Mondrian Grid | `salt` (range 1…100, padrão 1)<br>`spacingColor` (color, padrão "#ffffff") |
| `mosaic` | Smart Mosaic | `spacing` (range 0…20, padrão 3)<br>`salt` (range 1…100, padrão 1) |
| `perspectiveWall` | Perspective Wall | `direction` (select [Left, Right], padrão "Right")<br>`depth` (range 0.1…0.9, padrão 0.6) |
| `polaroidWall` | Polaroid Wall | `salt` (range 1…100, padrão 1) |
| `pyramid` | Pyramid Stack | `spacing` (range 0…20, padrão 5) |
| `radialBurst` | Radial Burst | `centerGap` (range 0…200, padrão 50) |
| `scatteredPhotos` | Scattered Photos | `salt` (range 1…100, padrão 1) |
| `scatteredStack` | Scattered Stack | `salt` (range 1…100, padrão 1) |
| `shattered` | Shattered Glass | `shards` (range 5…50, padrão 15)<br>`gap` (range 0…20, padrão 2)<br>`glassOpacity` (range 0.1…1, padrão 0.9)<br>`seed` (range 1…100, padrão 1) |
| `shrink` | Shrink Tunnel | `scaleStep` (range 0.5…0.95, padrão 0.85) |
| `spiral` | Spiral | `salt` (range 1…100, padrão 1) |
| `textSpace` | Fade | `direction` (select [Bottom, Top, Left, Right], padrão "Bottom")<br>`size` (range 10…100, padrão 40)<br>`color` (color, padrão "#000000") |
| `triptych` | Triptych | `gap` (range 0…50, padrão 20)<br>`border` (range 0…20, padrão 0) |
| `versus` | Versus | `angle` (range -45…45, padrão 15)<br>`gap` (range 0…50, padrão 10)<br>`color` (color, padrão "#ff0000") |
| `waves` | Waves | `salt` (range 1…100, padrão 1) |

## Efeitos de imagem — `js/effectsRegistry.js` (16)

| ID | Nome na UI | Parâmetros |
|---|---|---|
| `blur` | Blur | `amount` (range 0…100, padrão 5)<br>`edges` (select [Classic, Extend Edges], padrão "Classic") |
| `brightness` | Brightness | `amount` (range 0…4, padrão 1) |
| `contrast` | Contrast | `amount` (range 0…3, padrão 1) |
| `flip` | Flip | `horizontal` (checkbox, padrão true)<br>`vertical` (checkbox, padrão false) |
| `grayscale` | Grayscale | `amount` (range 0…1, padrão 1) |
| `hueRotate` | Hue Rotate | `angle` (range 0…360, padrão 0) |
| `invert` | Invert | `amount` (range 0…1, padrão 1) |
| `overlay` | Overlay | `startColor` (color, padrão "#000000")<br>`startOpacity` (range 0…1, padrão 0.5)<br>`endColor` (color, padrão "#000000")<br>`endOpacity` (range 0…1, padrão 0.9) |
| `pixelate` | Pixelate | `pixelSize` (range 1…64, padrão 8) |
| `reflection` | Reflection | `scaleY` (range 0.1…1, padrão 0.75)<br>`skewX` (range -2…2, padrão 0)<br>`trim` (range 0…0.5, padrão 0)<br>`size` (range 0.05…1, padrão 0.5)<br>`offsetX` (range -2000…2000, padrão 0)<br>`offset` (range -2000…2000, padrão -327)<br>`opacity` (range 0…1, padrão 0.5)<br>`blur` (range 0…20, padrão 2)<br>`fadeStart` (range 0…1, padrão 0)<br>`fadeEnd` (range 0…1, padrão 1) |
| `saturate` | Saturate | `amount` (range 0…3, padrão 1) |
| `scale` | Scale | `scaleX` (range 0.01…2, padrão 0.95)<br>`scaleY` (range 0.01…2, padrão 0.95)<br>`offsetX` (range -2000…2000, padrão 0)<br>`offsetY` (range -2000…2000, padrão 0)<br>`backgroundColor` (color, padrão "#000000")<br>`backgroundOpacity` (range 0…1, padrão 1) |
| `scanLines` | Scanlines | `opacity` (range 0…1, padrão 0.2)<br>`density` (range 1…10, padrão 8) |
| `sepia` | Sepia | `amount` (range 0…1, padrão 0) |
| `sharpen` | Sharpen | `amount` (range 0…2, padrão 1) |
| `vignette` | Vignette | `intensity` (range 0…1, padrão 0.5) |

## Efeitos de texto — `js/textEffects.js` (88)

| ID | Nome na UI | Parâmetros |
|---|---|---|
| `acidCorrosion` | Acid Corrosion | `acidColor` (color, padrão "#aaff00")<br>`damage` (range 0.1…0.8, padrão 0.4)<br>`melt` (range 0…50, padrão 15)<br>`seed` (range 1…100, padrão 7) |
| `actionSpeedlines` | Anime Speedlines | `color` (color, padrão "#ffffff")<br>`density` (range 10…200, padrão 80)<br>`thickness` (range 1…20, padrão 4)<br>`centerClear` (range 0…1, padrão 0.3)<br>`mode` (select [Behind Text, Inside Text, Lines Only], padrão "Inside Text")<br>`seed` (range 1…100, padrão 99) |
| `adjustments` | Color Adjust | `hue` (range 0…360, padrão 0)<br>`sat` (range 0…200, padrão 100)<br>`bright` (range 0…200, padrão 100)<br>`contrast` (range 0…200, padrão 100) |
| `arch` | Arch | `curve` (range -1920…1920, padrão 50)<br>`offsetY` (range -100…100, padrão 0) |
| `balloon` | 3D Plastic Balloon | `color` (color, padrão "#ff0055")<br>`inflation` (range 5…40, padrão 20)<br>`shininess` (range 10…100, padrão 80) |
| `bevelEmboss` | Bevel Emboss | `size` (range 1…20, padrão 4)<br>`softness` (range 0…20, padrão 2)<br>`angle` (range 0…360, padrão 135)<br>`highlight` (color, padrão "#ffffff")<br>`shadow` (color, padrão "#000000")<br>`strength` (range 0…1, padrão 0.65) |
| `blueprint` | Blueprint / CAD | `lineColor` (color, padrão "#aaddff")<br>`bgColor` (color, padrão "#003366")<br>`lineWidth` (range 0.5…5, padrão 1.5)<br>`gridAlpha` (range 0…1, padrão 0.3)<br>`grid` (checkbox, padrão true)<br>`guides` (checkbox, padrão true) |
| `blur` | Blur | `amount` (range 0…20, padrão 0) |
| `box` | Box | `color` (color, padrão "#ec1d24")<br>`padding` (range 0…100, padrão 15)<br>`radius` (range 0…50, padrão 0) |
| `brokenMirror` | Broken Mirror | `shards` (range 5…100, padrão 30)<br>`displace` (range 0…50, padrão 10)<br>`seed` (range 1…100, padrão 1) |
| `bulge` | Bulge / Pinch | `strength` (range -5…5, padrão 0.5)<br>`radius` (range 10…1000, padrão 200)<br>`offsetX` (range -1000…1000, padrão 0)<br>`offsetY` (range -1000…1000, padrão 0) |
| `carbonFiber` | Carbon Fiber | `color1` (color, padrão "#222222")<br>`color2` (color, padrão "#111111")<br>`scale` (range 2…20, padrão 4)<br>`shine` (range 0…1, padrão 0.6) |
| `channelTear` | Channel Tear | `maxShift` (range 1…80, padrão 16)<br>`bandHeight` (range 2…80, padrão 12)<br>`seed` (range 0…9999, padrão 101)<br>`alphaLoss` (range 0…1, padrão 0.08) |
| `chiseledMetal` | Gold / Chiseled Metal | **Material** _(título de seção)_<br>`color` (color, padrão "#c6a324")<br>`shine` (range 0…2, padrão 1.2)<br>`roughness` (range 0…20, padrão 14)<br>**Geometry** _(título de seção)_<br>`depth` (range 1…50, padrão 28)<br>`lightAngle` (range 0…360, padrão 210)<br>`seed` (range 1…100, padrão 46) |
| `chromatic` | Chromatic Aberration | `amount` (range 0…20, padrão 4)<br>`angle` (range 0…360, padrão 45) |
| `chrome` | Chrome / Metallic | `sky` (color, padrão "#33ccff")<br>`ground` (color, padrão "#333333")<br>`horizon` (range 0…100, padrão 50)<br>`edge` (range 0…10, padrão 2) |
| `concreteTexture` | Concrete / Stone | `lightColor` (color, padrão "#cccccc")<br>`darkColor` (color, padrão "#777777")<br>`roughness` (range 0…1, padrão 0.8)<br>`pores` (range 0…1, padrão 0.3)<br>`seed` (range 1…100, padrão 12) |
| `cosmicNebula` | Cosmic / Galaxy | `color1` (color, padrão "#ff00aa")<br>`color2` (color, padrão "#00ccff")<br>`stars` (range 100…2000, padrão 800)<br>`seed` (range 1…100, padrão 42) |
| `crystallize` | Crystallize | `size` (range 5…100, padrão 20)<br>`seed` (range 0…999, padrão 1) |
| `distress` | Texture | `mode` (select [noise, decay, scratch, rust, mold, scanlines, fabric, glitch, vhs, burn, halftone, paper, marble, wave], padrão "decay")<br>`amount` (range 0…1, padrão 0.5)<br>`seed` (range 0…999, padrão 1) |
| `echo` | Echo / Trail | `count` (range 1…10, padrão 3)<br>`offset` (range 0…50, padrão 20)<br>`fade` (range 0…1, padrão 0.2)<br>`color` (color, padrão "") |
| `engravedMetal` | Engraved / LOTR | **Material** _(título de seção)_<br>`color` (color, padrão "#eeb244")<br>`shine` (range 0…3, padrão 1.5)<br>`roughness` (range 0…20, padrão 5)<br>**Chisel Geometry** _(título de seção)_<br>`mode` (select [Raised (Relief), Engraved (Indent)], padrão "Raised (Relief)")<br>`bevel` (range 1…100, padrão 10)<br>`depth` (range 1…100, padrão 30)<br>`profile` (range 0.1…2, padrão 0.4)<br>`lightAngle` (range 0…360, padrão 135)<br>**Generation** _(título de seção)_<br>`seed` (range 1…100, padrão 1) |
| `extrude` | Extrude | `depth` (range 1…120, padrão 18)<br>`angle` (range 0…360, padrão 45)<br>`color` (color, padrão "#202020")<br>`fade` (range 0…1, padrão 0.15) |
| `extrudeShaded` | 3D Extrude (Shaded) | `depth` (range 0…50, padrão 10)<br>`angle` (range 0…360, padrão 45)<br>`color` (color, padrão "#555555")<br>`shading` (range 0…1, padrão 0.5) |
| `fade` | Fade | `direction` (select [Bottom, Top, Left, Right, Vertical (Both), Horizontal (Both), Radial (Vignette)], padrão "Bottom")<br>`strength` (range 0…1, padrão 0.5)<br>`endsAt` (range 0…1, padrão 0) |
| `flip` | Flip | `axis` (select [Horizontal, Vertical], padrão "Horizontal") |
| `fluffy` | Flush / Fur | `color` (color, padrão "#ff88aa")<br>`length` (range 5…60, padrão 25)<br>`density` (range 0.1…1, padrão 0.5)<br>`gravity` (range -90…90, padrão 20)<br>`seed` (range 1…100, padrão 1) |
| `frozen` | Frozen / Ice | `color` (color, padrão "#aaccff")<br>`freeze` (range 0…100, padrão 50)<br>`icicles` (range 0…100, padrão 30)<br>`seed` (range 1…100, padrão 1) |
| `glassRefraction` | Glass Refraction | `intensity` (range 0…20, padrão 6)<br>`scale` (range 1…10, padrão 3)<br>`seed` (range 0…999, padrão 42) |
| `glitch` | Glitch | `offset` (range 0…20, padrão 5)<br>`sliceHeight` (range 2…50, padrão 10)<br>`sliceOffset` (range 0…50, padrão 10)<br>`seed` (range 0…999, padrão 0) |
| `glitterTexture` | Glitter / Sparkle | `baseColor` (color, padrão "#ff0077")<br>`density` (range 0.1…1, padrão 0.7)<br>`rainbow` (range 0…1, padrão 0.3)<br>`size` (range 1…4, padrão 2)<br>`seed` (range 0…1000, padrão 0) |
| `glowEdge` | Projection | `radius` (range 1…40, padrão 8)<br>`intensity` (range 0…1, padrão 0.8)<br>`color` (color, padrão "#ffffff") |
| `gradient` | Gradient | `color1` (color, padrão "#ff0000")<br>`color2` (color, padrão "#0000ff")<br>`angle` (range 0…360, padrão 0)<br>`opacity` (range 0…1, padrão 1) |
| `gradientMap` | Gradient Map | `shadowColor` (color, padrão "#1a1a1a")<br>`midColor` (color, padrão "#888888")<br>`highlightColor` (color, padrão "#ffffff")<br>`opacity` (range 0…1, padrão 1) |
| `gummyCandy` | Gummy / Subsurface | `color` (color, padrão "#ff0066")<br>`thickness` (range 1…50, padrão 20)<br>`sugar` (range 0…1, padrão 0.8)<br>`seed` (range 0…1000, padrão 0) |
| `hologram` | Holographic Foil | `scale` (range 10…200, padrão 80)<br>`complexity` (range 1…5, padrão 2.5)<br>`lightness` (range 20…80, padrão 60)<br>`angle` (range 0…360, padrão 45) |
| `infernoForge` | Inferno Forge | `seed` (range 1…9999, padrão 1337)<br>`coreColor` (color, padrão "#fff4d6")<br>`hotColor` (color, padrão "#ffb14a")<br>`midColor` (color, padrão "#ff5a00")<br>`darkColor` (color, padrão "#551100")<br>`emberColor` (color, padrão "#ff6a00")<br>`smokeColor` (color, padrão "#3a0904")<br>`glowSize` (range 0…120, padrão 34)<br>`glowIntensity` (range 0…8, padrão 3.2)<br>`outerGlowSize` (range 0…180, padrão 78)<br>`crackAmount` (range 0…1, padrão 0.42)<br>`textureScale` (range 0.5…8, padrão 2.4)<br>`smokeAmount` (range 0…1, padrão 0.58)<br>`embers` (range 0…600, padrão 180)<br>`showBase` (checkbox, padrão true) |
| `inkBleed` | Ink Bleed / Rorschach | `color` (color, padrão "#0d0d0d")<br>`spread` (range 0…50, padrão 20)<br>`mirror` (checkbox, padrão true)<br>`seed` (range 1…100, padrão 1) |
| `inlineCut` | Inline Cut | `thickness` (range 1…30, padrão 4)<br>`opacity` (range 0…1, padrão 0.35)<br>`color` (color, padrão "#000000") |
| `innerShadow` | Inner Shadow | `color` (color, padrão "#000000")<br>`distance` (range 0…80, padrão 8)<br>`angle` (range 0…360, padrão 135)<br>`blur` (range 0…40, padrão 10)<br>`opacity` (range 0…1, padrão 0.65) |
| `innerShadowOffset` | Inner Shadow (Offset) | `color` (color, padrão "#000000")<br>`blur` (range 0…20, padrão 5)<br>`offsetX` (range -20…20, padrão 3)<br>`offsetY` (range -20…20, padrão 3)<br>`opacity` (range 0…1, padrão 0.8) |
| `invert` | Invert / Negative | `amount` (range 0…1, padrão 1) |
| `leatherTexture` | Leather | `baseColor` (color, padrão "#3d1f00")<br>`creaseColor` (color, padrão "#1a0d00")<br>`scale` (range 0.01…0.2, padrão 0.08)<br>`depth` (range 0…1, padrão 0.7)<br>`seed` (range 1…100, padrão 5) |
| `lightning` | Lightning | `intensity` (range 0…1, padrão 0.6)<br>`color` (color, padrão "#ffffff")<br>`seed` (range 0…1000, padrão 123) |
| `liquidMercury` | Liquid Melt / Mercury | `melt` (range 2…40, padrão 12)<br>`shininess` (range 1…10, padrão 6) |
| `longShadow` | Shadow | `color` (color, padrão "#000000")<br>`length` (range 0…100, padrão 20)<br>`angle` (range 0…360, padrão 45)<br>`blur` (range 0…20, padrão 5)<br>`opacity` (range 0…1, padrão 0.5) |
| `mangaScreentone` | Manga Screentone | `dotSize` (range 2…20, padrão 6)<br>`spacing` (range 4…30, padrão 8)<br>`angle` (range 0…90, padrão 45)<br>`color` (color, padrão "#111111")<br>`gradient` (range 0…1, padrão 1) |
| `matrix` | Matrix / Data | `color` (color, padrão "#00ff00")<br>`density` (range 10…50, padrão 20)<br>`speed` (range 0…100, padrão 50)<br>`seed` (range 1…100, padrão 1) |
| `melt` | Melt | `strength` (range 0…100, padrão 20)<br>`chaos` (range 0…1, padrão 0.5)<br>`seed` (range 0…999, padrão 1) |
| `mosaic` | Mosaic | `tileSize` (range 2…64, padrão 16)<br>`randomness` (range 0…1, padrão 0.3)<br>`colorVariation` (range 0…1, padrão 0.2)<br>`seed` (range 0…1000, padrão 0) |
| `motionBlur` | Motion Blur | `angle` (range 0…360, padrão 0)<br>`distance` (range 0…100, padrão 30)<br>`opacity` (range 0…1, padrão 0.5) |
| `neon` | Neon | `color` (color, padrão "#00ff00")<br>`intensity` (range 0…50, padrão 2)<br>`size` (range 0…50, padrão 15) |
| `nordicRuneforge` | Nordic Runeforge | `seed` (range 1…9999, padrão 7331)<br>`runeText` (text, padrão "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛟ")<br>`metalLight` (color, padrão "#d4c4b4")<br>`metalMid` (color, padrão "#7a6355")<br>`metalDark` (color, padrão "#1c0802")<br>`patinaA` (color, padrão "#4d8b88")<br>`patinaB` (color, padrão "#7aa7a0")<br>`emberColor` (color, padrão "#8e1c14")<br>`extrudeDepth` (range 0…30, padrão 10)<br>`volumeDepth` (range 0…1, padrão 0.88)<br>`depthContrast` (range 0…1, padrão 0.75)<br>`specularStrength` (range 0…1, padrão 0.12)<br>`lightAngleX` (range -1…1, padrão -0.55)<br>`lightAngleY` (range -1…1, padrão -0.7)<br>`textureScale` (range 0.5…8, padrão 2.4)<br>`textureStrength` (range 0…1, padrão 0.55)<br>`patinaAmount` (range 0…1, padrão 0.32)<br>`engraveDepth` (range 0…1, padrão 0.7)<br>`runeSize` (range 0.02…0.3, padrão 0.09)<br>`runeSpacing` (range 0.5…3, padrão 1.2)<br>`emberAmount` (range 0…1, padrão 0.2)<br>`innerGlow` (range 0…1, padrão 0.38) |
| `opacity` | Opacity | `amount` (range 0…1, padrão 1) |
| `origamiFold` | Low-Poly / Origami | `color` (color, padrão "#ffaa00")<br>`complexity` (range 100…2000, padrão 500)<br>`contrast` (range 0.1…1, padrão 0.6)<br>`seed` (range 1…100, padrão 42) |
| `outerGlow` | Outer Glow | `color` (color, padrão "#00ff00")<br>`distance` (range 0…100, padrão 15)<br>`intensity` (range 0…10, padrão 2) |
| `outline` | Outline | `color` (color, padrão "#000000")<br>`thickness` (range 1…100, padrão 3) |
| `paintBrush` | Smudge | `brushSize` (range 1…128, padrão 12)<br>`intensity` (range 0…1, padrão 0.6)<br>`iterations` (range 1…20, padrão 6)<br>`seed` (range 0…999, padrão 0) |
| `pattern` | Pattern Fill | `type` (select [Dots, Stripes, Checkers, Grid], padrão "Stripes")<br>`size` (range 2…50, padrão 6)<br>`color` (color, padrão "#000000")<br>`bg` (select [Yes, No], padrão "Yes") |
| `pcbCircuit` | Circuit Board (PCB) | `board` (color, padrão "#003300")<br>`trace` (color, padrão "#ffcc00")<br>`density` (range 5…30, padrão 12)<br>`seed` (range 1…999, padrão 101) |
| `perspective` | Perspective | `depth` (range -1…1, padrão 0.5)<br>`direction` (select [Horizontal, Vertical], padrão "Horizontal") |
| `pixelMatrix` | Pixelate | `pixelSize` (range 1…64, padrão 8) |
| `plasma` | Plasma / Electricity | **Colors** _(título de seção)_<br>`coreColor` (color, padrão "#ffffff")<br>`glowColor` (color, padrão "#00ccff")<br>**Structure** _(título de seção)_<br>`strands` (range 2…100, padrão 20)<br>`sharpness` (range 1…20, padrão 8)<br>`detail` (range 0…2, padrão 1)<br>**Motion** _(título de seção)_<br>`warp` (range 0…50, padrão 15)<br>`flow` (range 0…5, padrão 1)<br>**Origin** _(título de seção)_<br>`centerX` (range -500…500, padrão 0)<br>`centerY` (range -500…500, padrão 0)<br>`seed` (range 1…100, padrão 1) |
| `reflection` | Reflection | `offset` (range -1500…1500, padrão 0)<br>`opacity` (range 0…1, padrão 0.5)<br>`scale` (range 0.1…1, padrão 0.8) |
| `retroWave` | Retro Wave / 80s | `topColor` (color, padrão "#ff00cc")<br>`midColor` (color, padrão "#ffcc00")<br>`gridColor` (color, padrão "#00ffff")<br>`horizon` (range 0…100, padrão 60)<br>`zoom` (range 0.5…5, padrão 1) |
| `rimLight` | Rim Light | `color` (color, padrão "#7fd6ff")<br>`thickness` (range 1…20, padrão 4)<br>`opacity` (range 0…1, padrão 0.8)<br>`side` (select [All, Left, Right, Top, Bottom], padrão "All") |
| `ring` | Ring / Circle | `radius` (range 50…500, padrão 200)<br>`angle` (range 90…360, padrão 360)<br>`rotate` (range 0…360, padrão 0)<br>`inward` (select [Inward, Outward], padrão "Inward") |
| `ripple` | Ripple | `amplitude` (range 0…60, padrão 8)<br>`frequency` (range 0.1…10, padrão 2.5)<br>`axis` (select [x, y], padrão "y")<br>`seed` (range -2147483648…2147483647, padrão 0) |
| `rotate` | Rotate | `angle` (range -180…180, padrão 0) |
| `roughen` | Roughen Edges | `strength` (range 0…20, padrão 5)<br>`scale` (range 1…20, padrão 10)<br>`seed` (range 0…999, padrão 1) |
| `sauronFire` | Sauron / Magma | **Colors** _(título de seção)_<br>`innerColor` (color, padrão "#ffb000")<br>`outerColor` (color, padrão "#ff3300")<br>`hotspotColor` (color, padrão "#ffffcc")<br>**Texture** _(título de seção)_<br>`scale` (range 10…100, padrão 40)<br>`warp` (range 0…50, padrão 20)<br>`veins` (range 0…2, padrão 0.5)<br>**Pupil** _(título de seção)_<br>`pupilWidth` (range 0…100, padrão 25)<br>`pupilHeight` (range 10…100, padrão 80)<br>`pupilFade` (range 0…50, padrão 10)<br>`pupilRim` (range 0…2, padrão 1.2)<br>`pupilOffset` (range -100…100, padrão 0)<br>`pupilOffsetY` (range -100…100, padrão 0)<br>**Effects** _(título de seção)_<br>`glowSize` (range 0…200, padrão 60)<br>`glowIntensity` (range 0…10, padrão 1.5)<br>`showBase` (checkbox, padrão false)<br>`seed` (range 1…100, padrão 1) |
| `scale` | Scale / Stretch | `w` (range 0.1…3, padrão 1)<br>`h` (range 0.1…3, padrão 1) |
| `scanLines` | Scanlines | `opacity` (range 0…1, padrão 0.2)<br>`density` (range 1…10, padrão 8) |
| `skew` | Skew | `x` (range -1…1, padrão -0.2)<br>`y` (range -1…1, padrão 0) |
| `slice` | Slice / Cut | `angle` (range -90…90, padrão -20)<br>`offset` (range 0…50, padrão 15)<br>`yPos` (range 0…100, padrão 50) |
| `smoke` | Smoke / Vapor | `color` (color, padrão "#eeeeee")<br>`density` (range 0…2, padrão 1)<br>`turbulence` (range 0…50, padrão 20)<br>`seed` (range 1…100, padrão 1) |
| `specular` | Specular | `angle` (range 0…360, padrão 25)<br>`width` (range 0.02…1, padrão 0.18)<br>`strength` (range 0…1, padrão 0.75)<br>`color` (color, padrão "#ffffff") |
| `splatter` | Splatter | `mode` (select [Erode, Paint], padrão "Erode ([REC] Style)")<br>`color` (color, padrão "#cc0000")<br>`density` (range 1…100, padrão 40)<br>`size` (range 1…50, padrão 15)<br>`spread` (range 0…1, padrão 0.8)<br>`distortion` (range 0…1, padrão 0.6)<br>`seed` (range 1…100, padrão 1) |
| `stainedGlass` | Stained Glass | `size` (range 5…100, padrão 20)<br>`grout` (range 0.1…10, padrão 2)<br>`groutStyle` (select [Hairline, Use Grout Width], padrão "Hairline")<br>`color` (color, padrão "#000000")<br>`variance` (range 0.1…1, padrão 0.3)<br>`seed` (range 1…100, padrão 1) |
| `stereo` | 3D Anaglyph | `offset` (range 0…30, padrão 6)<br>`mode` (select [Red/Cyan, Green/Magenta], padrão "Red/Cyan") |
| `stickerPeel` | Die-cut Sticker Peel | `border` (range 2…50, padrão 15)<br>`peelSize` (range 10…200, padrão 60)<br>`shadow` (range 0…1, padrão 0.5) |
| `stitch` | Embroidery | `size` (range 3…12, padrão 4)<br>`density` (range 1…4, padrão 2)<br>`color` (color, padrão "#ffffff")<br>`shadow` (range 0…1, padrão 0.5) |
| `topographic` | Topographic Contour | `levels` (range 5…50, padrão 20)<br>`thickness` (range 1…10, padrão 2)<br>`color` (color, padrão "#00ffcc")<br>`bg` (checkbox, padrão false) |
| `toxicSlime` | Toxic Slime | `colorA` (color, padrão "#00ff00")<br>`colorB` (color, padrão "#ffff00")<br>`drip` (range 0…100, padrão 40)<br>`bubbles` (range 0…50, padrão 20)<br>`seed` (range 1…100, padrão 1) |
| `vectorWarp` | Vector Warp | `amount` (range 0…50, padrão 12)<br>`direction` (select [left, right, up, down], padrão "right")<br>`frequency` (range 0.1…10, padrão 3) |
| `voxelIso` | 3D Voxel / Isometric | `size` (range 4…40, padrão 12)<br>`height` (range 1…20, padrão 4)<br>`angle` (range 0…360, padrão 0)<br>`colorTop` (color, padrão "#00d2ff")<br>`colorLeft` (color, padrão "#0088ff")<br>`colorRight` (color, padrão "#0044aa") |
| `waves` | Waves | `amplitude` (range 0…60, padrão 8)<br>`frequency` (range 0.1…10, padrão 2.5)<br>`axis` (select [x, y], padrão "y")<br>`seed` (range -2147483648…2147483647, padrão 1) |
| `woodTexture` | Wood Grain | `baseColor` (color, padrão "#8b5a2b")<br>`ringColor` (color, padrão "#4a2f14")<br>`rings` (range 1…50, padrão 15)<br>`distortion` (range 0…10, padrão 3.5)<br>`seed` (range 1…100, padrão 42) |

