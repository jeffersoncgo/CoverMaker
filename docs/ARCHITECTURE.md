# CoverMaker — Architecture and technical documentation

> Written from the source code (revision `9928358`). Known bugs and suggested fixes are in
> [`AUDIT.md`](AUDIT.md); the full list of layouts and effects (generated from the registries) is in
> [`EFFECTS-REFERENCE.md`](EFFECTS-REFERENCE.md).

## 1. Overview

A 100% *client-side* application (HTML + CSS + JavaScript, no build) for making covers/posters for Jellyfin collections.
The user fills **slots** with images (Jellyfin, local file, clipboard paste or imported project), picks a
**composite layout**, stacks **image effects**, adds **text layers** with **text effects** and exports the image
(PNG/JPEG/WEBP) or the project (`.covermaker.zip`).

Published on GitHub Pages by the `.github/workflows/static.yml` workflow (push to `main` → upload of the whole repository).

```
index.html ─┬─ css/ (variables, base, layout, components, toast, animations, utilities, gallery, mobile)
            ├─ external CDNs: Font Awesome 6.7.2, JSZip 3.10.1 (both with SRI), Google Fonts (on demand)
            ├─ js/vendor/  copies from the jeffersoncgo/cdn repository + meilisearch-js 0.54.0
            └─ js/         application code
gallery/    gallery.json + sample projects (project.json, *.project.zip, preview images)
fonts/      google-fonts.json (list of 1,899 families), google-fonts-variants.json (faces of each family)
images/     loading.gif, error.png
```

## 2. Script load order

All are classic scripts at the end of `<body>` (except `meilisearch_index.min.js`, `defer`, and `mobileViewport.js`, in
`<head>`). Order matters because everything is global:

| # | File | Role | Main globals |
|---|---|---|---|
| 1 | `vendor/base.js` | `JCGWeb` namespace, DOM utilities | `JCGWeb` |
| 2 | `vendor/common.js` | `utils`, `String/Array.prototype` extensions | `utils` |
| 3 | `vendor/object.js` | `searchInArray`, `mergeObjects`, … | — |
| 4 | `vendor/search.js` | `SearchEngine` (not used by the app) | `SearchEngine` |
| 5 | `vendor/controller.js` | Debounce/abort for async functions | `Controller` |
| 6 | `vendor/pagememory.js` | Persists `[save]` elements in IndexedDB (created in `app.js` with `saveDelayMs`/`restoreDelayMs` 500 and without listening to `click`) | `pageMemory` |
| 7 | `vendor/observer.js` | MutationObserver + events | `Observer` |
| 8 | `vendor/fetchqueue.js` | Queue of concurrent `fetch` calls | `FetchQueue` |
| 9 | `jellyfin.js` | Jellyfin API client + IndexedDB cache + Meilisearch | `Jellyfin` |
| 10 | `windowsHandle.js` | Draggable floating windows | `showWindow`, `hideWindow` |
| 11 | `config.js` | Initial global state | `Setup`, `projectConfig`, `slotsImages`, `composite` |
| 12 | `fonts.js` | Font list and loading | `populateFontSelect`, `loadFont` |
| 13 | `factory.js` | *Dropdown* factory (unused) | `createDropdownMenu` |
| 14 | `toast.js` | Notifications | `toastMessage`, `closeToast` |
| 15 | `compositeRegistry.js` | 40 layouts | `COMPOSITE_REGISTRY` |
| 16 | `drawing.js` | Render pipeline with cache | `drawComposite`, `runStep`, `loadImage` |
| 17 | `slots.js` | Image slot management | `addImageSlot`, `setSlotImage`, … |
| 18 | `jellyfin_ui.js` | Jellyfin panel (libraries, search, paging) | `CreateJellyfin`, `searchOnLibrary` |
| 19 | `effectsRegistry.js` | 16 image effects | `EFFECTS_REGISTRY` |
| 20 | `paramsRenderer.js` | Builds controls from parameter schemas | `ParamsRenderer` |
| 21 | `textEffects.js` | 88 text effects | `TEXT_EFFECTS`, `applyTextEffect` |
| 22 | `app.js` | UI, events, import/export, startup | almost everything else |
| 23 | `gallery.js` | Gallery window | `renderGallery`, `useSetup`, `useFullProject` |

## 3. Global state

| Variable | Defined in | Content |
|---|---|---|
| `slotsImages` | `config.js` | `Array<HTMLImageElement \| null>` — one entry per slot, in UI order |
| `projectConfig` | `config.js` | The **project**: text layers, layout, effects (see §7) — this is what gets rendered |
| `Setup` | `config.js` | Application preferences: sizes, layer/effect defaults, export |
| `window.composite` | `config.js` | `{ size: {width, height}, lastHash }` — current canvas size |
| `window.Composites` | `drawing.js` | Latest results: `.Image` (background + effects), `.Text` (text), `.Merged` (final, also without text) |
| `window.memory` | `app.js` | `pageMemory` instance |
| `window.jellyfin` | `jellyfin_ui.js` | `Jellyfin` instance |
| `window.memoryLoaded` | `app.js` | Enables writing to `localStorage` (`saveSetup`/`saveprojectConfig` only write when `true`) |
| `window.projectFileName` | `app.js` | Base name for exports, taken from the imported file |

> `Setup.Settings` may exist in `Setup` (it comes from imported projects and old `localStorage.setup` values), but it is
> only a copy: since 2026-10-23 no code reads or writes it — everything uses `projectConfig` (`CM-01`).

## 4. Startup (`window.load` in `app.js`)

1. Copies `Setup` and `projectConfig` to `window.defaultSetup` / `window.defaultprojectConfig`.
2. `loadFieldsFromStorage()` → fills the server from `localStorage` (and, only for users coming from an old version, username/password, used once to get the token).
3. Wires the tabs (`#imageslotsTab`, `#settingsTab`).
4. `loadSetup()` → merges `localStorage.setup` over `Setup`.
5. `addtypeSelectOptions()` → fills the layout `<select>` and the controls of the current layout.
6. Initial `drawComposite()`.
7. `CreateJellyfin()` → creates `Jellyfin` with the form fields (tries to connect right away).
8. `await populateFontSelect()` → font list (local + Google).
9. `initTextLayers()` → clears text layers.
10. `loadEssentials()` → creates `pageMemory`, registers events and calls `memory.init()`:
    - **no saved data** → `onMemoryIsEmpty` → `dummyStart()` (4 sample IMDb posters + a copy of
      `Setup.defaults.textLayers` as the text layer; `loadTextLayers` accepts one layer or a list and enables
      `memoryLoaded`, so the first session is already saved);
    - **saved data** → `onRestoreSucess` → `memoryLoaded = true`, `loadprojectConfig()`, `updateImageSettings()`,
      `renderEffectLayers()`, `searchOnLibrary()`.
    - also calls `addSettingListeners()` (delegated listeners on the settings panel).
11. `renderEffectLayers()`, `renderTextEffectLayers()`, custom poster limits.

## 5. Render pipeline (`drawing.js`)

`drawComposite` is wrapped by `Controller.wrap(drawComposite, true, 100)` (100 ms debounce, aborts the previous call).

```
drawComposite(signal)
 ├─ step 0  runStep(null, null, composite.size)           → base hash (changes with the size)
 ├─ drawCompositeImage(hash)
 │   ├─ step  createBackgroundCanvas(signal, backgroundColor) → canvas filled with backgroundColor (#000)
 │   ├─ applyComposite → step runCompositeStep(type, canvas, slotsImages, params, signal, {srcOnly}, eff)
 │   │    (clones inside the step and calls COMPOSITE_REGISTRY[type].apply; disabled/missing/error → keeps the background)
 │   └─ applyImageEffects: for each enabled effect
 │        └─ step runImageEffectStep(type, canvas, params, signal, eff) → clones and calls EFFECTS_REGISTRY[type].apply
 ├─ drawCompositeText(hash, w, h)
 │   ├─ for each enabled layer:
 │   │    ├─ step createBaseTextLayer(w, h, text, position, font, fillStyle, signal, fontLoaded?)
 │   │    └─ for each text effect: step runTextEffectStep(canvas, text, x, y, params, signal, eff)
 │   └─ step mergeImageLayers(canvases)                      → all text layers stacked
 ├─ drops cached steps beyond the ones used in this run
 ├─ compares hash(image, text) with composite.lastHash → if equal, does not redraw
 ├─ if the signal was aborted (a newer run exists) → does not paint
 └─ mergeCanvases(Image, Text) (or Image only) → Composites.Merged → copied to #myCanvas
```

### Step cache (`runStep`)

- Each `runStep` call gets a sequential index (`lastStepIndex`, reset on every `drawComposite`).
- Step hash = `stepHash(JSON.stringify({params, fnId: function_uid + index}), previousHash)`.
  Canvases, contexts and `Image` serialize as `{}`; that is why `applyComposite` injects `{ srcOnly: [fnv1a(img.src)…] }`
  so that swapping/reordering images changes the hash.
- If `stepsCache[index].hash` matches, the stored result (canvas + ctx) is reused, and so are the following steps,
  chained by the hash. The step hash always wins over a `hash` field returned by the function.
- Step functions receive the registry **key** (not the definition object) and the previous step's canvas, and clone
  inside the step: a reused step does not copy the canvas again and never changes another step's stored result.
- Values that change the image without appearing in the parameters go in as an extra argument, only for the hash:
  `backgroundColor` for the background and `document.fonts.check(fontStyle)` for text (redraws when a web font finishes
  loading).
- `runStep` throws `AbortError` if the `signal` is already aborted, before touching the shared index/cache;
  `drawCompositeImage`, `applyComposite`, `applyImageEffects` and `drawCompositeText` rethrow the `AbortError` (other
  errors are still logged and the pipeline goes on). The `Controller` resolves the aborted call with `undefined`.
- `clearStepsCache()` is only called when importing a project.

### `apply` function contracts

| Registry | Signature | Must return |
|---|---|---|
| `COMPOSITE_REGISTRY[id].apply` | `(ctx, canvas, images, params, abortSignal, meta, eff)` | `{ canvas, ctx, … }` |
| `EFFECTS_REGISTRY[id].apply` | `(ctx, canvas, params, abortSignal, eff)` | `{ canvas, ctx, … }` |
| `TEXT_EFFECTS[id].apply` | `(ctx, canvas, text, x, y, params, abortSignal)` | `{ canvas, ctx }` (optional: `applyTextEffect` uses the canvas it received if nothing comes back) |

- `images` may contain `null` (empty slot). `canvas` is already a **clone**: it can be changed freely.
- Composites and image effects that return `undefined` (several do `return;` with 0 or 1 image) keep what they drew:
  `runCompositeStep`/`runImageEffectStep` return the clone itself. This used to freeze the canvas (`CM-03`).
  Still, prefer `return { canvas, ctx }`.
- `applyTextEffect` adds the `globalOpacity` parameter to every text effect (blends the result with the previous
  state) and accepts `params.blendMode`.

### Options added on 2026-10-23 (default = as it was)

| Effect | Parameter | Default (old) | New |
|---|---|---|---|
| Blur (image) | `edges` | `Classic` (blurred over the sharp image: halo at the edges) | `Extend Edges` (extends the edge before blurring) |
| Stained Glass | `groutStyle` | `Hairline` (1 px; the `grout` slider did nothing) | `Use Grout Width` (uses the slider) |
| Anime Speedlines | `mode` | `Inside Text` and `Behind Text` now show the text (it used to be erased: bug fix) | `Lines Only` = what `Behind Text` drew before |
| comicLayout, glitchMosaic, cctv, mosaic, glitterTexture, gummyCandy | `seed` | `0` = random on every render | any other value = always the same result |
| (new effects) | — | — | `innerShadowOffset`, `extrudeShaded`: the first versions of `innerShadow`/`extrude`, which were hidden |

### Parameter schema (used by `paramsRenderer.js`)

```js
{ key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 100, step: 1, default: 3,
  group: 'Overlay_Start',      // optional: groups controls under a label
  options: ['A', 'B'],         // for type 'select' (array, array of objects or map)
  className: '…', style: '…' } // optional
```

Types: `range` (default), `number`, `color`, `checkbox`, `select`, `text`, `span`. Entries without a `key` render as
section titles. Numeric controls switch between *slider* and number field with a **double click** on the control or on
the label.

### How to add a layout/effect

```js
// compositeRegistry.js
myLayout: {
  name: 'My Layout',
  params: [{ key: 'gap', label: 'Gap', type: 'range', min: 0, max: 50, step: 1, default: 8 }],
  apply: (ctx, canvas, images, params, abortSignal) => {
    const imgs = images.filter(Boolean);
    if (!imgs.length) return { canvas, ctx };          // never return undefined
    // … draw …
    return { canvas, ctx };
  }
},
```

The item shows up automatically in the `<select>` (`getAvailableComposites`, `getAvailableEffects`,
`getAvailableTextEffects`), sorted by `name`. When the type changes, the parameters are reset to their `default`.

## 6. Image slots (`slots.js`)

- DOM: `#image-slots` holds one `.slot` per position (template `#slot-template`), each with `img.preview[save]`.
  The `slotsCount` attribute of `#image-slots` + `customTrigger="setSlots"` recreates the right number of slots on restore.
- Image sources: Jellyfin (click or drag a poster), local file, `Ctrl+V` (first empty slot), project ZIP.
  External URLs are downloaded with `fetch` and turned into Blob URLs (`loadImage`) to avoid a "tainted" canvas (CORS).
- Actions: add/remove, move ↑/↓, drag to reorder, *pin*, shuffle, reverse order, clear, fill randomly from Jellyfin.
- Old Blob URLs are revoked 100 ms after the swap (`revokeBlobUrl`).
- IDs: the slot at position *i* always has `id="slot-i"` and its preview `id="img-slot-i"` (`renumberSlotIds()` runs on
  add, remove, move and swap). `pageMemory` restores each preview by `id` into slots recreated in that order, so unique,
  positional IDs keep each image in its slot after a reload (`CM-11`).

## 7. File formats

### Full project — `<name>.covermaker.zip` ("Save Project File" button)

```
project.json          { "Setup": { "Settings": <projectConfig> }, "imageSlots": ["placeholder" | null, …] }
images/slot_<N>.<ext> one image per filled slot (format/quality from Setup.Export.Project.Images)
```

Import (`importProjectFromZip`): loads the images `images/slot_N.(png|jpg|jpeg|webp|bmp|gif|tiff)`, applies
`project.json` (`loadFullProjectFromJson`) and completes the slot count with `imageSlots.length` (empty trailing slots
are not lost). Loose `.json` files are imported without images.

### Final image — "Download" / "open in new tab" buttons

Both use the visible canvas (`#myCanvas`), which always holds the final image, with or without text layers. The
download uses `canvas.toBlob` (no huge *data URL*) with the format/quality from `Setup.Export.Canvas`.

### Setup — `<name>.covermaker.setup.json` ("Save Setup (JSON)" button)

The plain `projectConfig` (no images). It can be imported with the same open-project button and from the gallery
("Use Json").

### `projectConfig`

```jsonc
{
  "textLayers": [{
    "id": "layer_0",
    "overlayText": "MOVIES",
    "enabled": true,
    "font": { "family": "Bangers", "source": "Google", "weight": "lighter", "style": "normal",
              "size": 362, "color": "#ffffff", "opacity": 1 },
    "position": { "textAlign": "center", "textBaseline": "middle", "x": 0, "y": 0, "rotation": 0 },
    "fontStyle": "normal lighter 362px \"Bangers\"",   // derived
    "fillStyle": "rgba(255, 255, 255, 1)",              // derived
    "effects": [{ "type": "outline", "enabled": true, "params": { "color": "#000000", "thickness": 10.5 } }]
  }],
  "canvas": {
    "format": "cover",            // cover | poster | square | custom
    "type": "line",               // layout id (mirrors composite.type)
    "composite": { "type": "line", "enabled": true, "params": { … } },
    "effects": [{ "type": "vignette", "enabled": true, "params": { "intensity": 0.78 } }],
    "backgroundColor": "#000000"  // optional
    // + legacy keys (overlayColorStart, reflectionDistance, salt, …) ignored by the current pipeline
  }
}
```

### Configuration — `covermaker-config.json` (Options → "Export Config")

`{ "Setup": <Setup> }` (sizes, layer/effect defaults, export formats). Import also accepts a bare `Setup`, the format
written before 2026-10-23; it applies the file straight to the UI (`applySetupToUI`) and only then saves. Project image
quality lives in `Setup.Export.Project.Images.quality` (`jpegQuality` is only read from old files).

### Canvas size

`updateImageSettings()` computes the size from the aspect ratio of `Setup.Sizes[format]` **without changing**
`Setup.Sizes` (which also sets the Jellyfin thumbnails, 480×270 / 270×480), fixing the **longest side at 1920 px**:
`cover` 1920×1080, `poster` 1080×1920, `square` 1920×1920. In `custom`, width/height work as an **aspect ratio**
(e.g. 3 × 1 → 1920×640), not as pixels.

## 8. Gallery (`gallery.js` + `gallery/gallery.json`)

```jsonc
[{
  "id": "war-metal",
  "title": "War — Metal",
  "shortDescription": "…",
  "image": "gallery/projects/war-metal/war.metal.result.png",   // thumbnail
  "type": "cover",            // groups the cards (poster, cover, …)
  "author": "jeffersoncgo",
  "page": "https://github.com/…",                               // author link
  "setup": "gallery/projects/war-metal/project.json",           // "Use Json" button
  "project": "gallery/projects/war-metal/war.metal.project.zip"  // "Use Full Project" button (optional)
}]
```

The window groups by `type`, searches by title/author/description and opens a modal with both import modes.

## 9. Jellyfin integration (`jellyfin.js` + `jellyfin_ui.js`)

Flow of `new Jellyfin(host, username, password, events, needsUserData = false, { preferCredentials = false } = {})`
(`init()` never rejects: failures arrive through `onServerSetupError` / `onLoginError`):

1. `GET /System/Info/Public` → server name, version, `Id` and `LocalAddress`. Offline → `onServerSetupError`.
2. `setFastestAddress()` → times the external and the local address (max. 5 s) and uses the faster one.
3. Login:
   - **saved session** (`localStorage.jellyfinAuth` = `{ server, serverId, userId, token }`, for the same server by
     address or by `Id`) → `GET /Users/{userId}` with the token. 200 = logged in without a password; 401 = revoked/expired
     token, the session is deleted and the password login (or the login window) takes over;
   - **password** → `POST /Users/authenticatebyname` → `AccessToken`. The token is saved (`saveAuth`) and the password
     is discarded, from memory too. Failure → `onLoginError(error, response)` and nothing else runs (a failed login used
     to carry on as if it had worked).
   - Order: on page load, saved session first (no password sent); on the **Connect** button
     (`UpdateConfig` / `preferCredentials: true`), typed username and password first — that is how you switch accounts.
     No credentials and no session → `onLoginError` with `error.name === 'MissingCredentialsError'`.
   - **Sign out** (`logout()`) → `POST /Sessions/Logout` (the token stops working on the server) and deletes the saved
     session.
   - The token goes in the `authorization: MediaBrowser … Token="…"` header.
4. `setupMeiliSearch()` → if the page `/web/configurationpage?name=Meilisearch` exists, reads the plugin configuration
   (`/Plugins/{id}/Configuration`, requires an administrator), creates the `meilisearch` client and makes sure
   `path`/`type` are filterable/sortable attributes in the index. Without access to the configuration (regular user) or
   on error, Meilisearch is turned off and libraries load through Jellyfin; if a Meilisearch search fails later, the
   library is reloaded through Jellyfin (`loadLibraryItems`).
5. `getLibraries()` (1 s later) → `GET /UserViews`, `GET /Library/VirtualFolders`; for each library of a supported type:
   - if the IndexedDB cache has the same item count, it uses the cache and asks the server only for the items **edited**
     since the last sync (`LastSync` stored on the library + `MinDateLastSaved`), which replace the stored copy
     (`refreshChangedItems`). Caches from old versions, without `LastSync`, are tracked from the first visit on;
   - otherwise it downloads every item (Meilisearch or `GET /Users/{id}/Items`, paged in blocks of `loadLimit` through
     `FetchQueue`).
   - aggregates Tags/Genres/Studios (for the search `<datalist>`);
   - with `needsUserData = true` (content-recommender), refreshes the `UserData` of every item on each load
     (`updateLibraryUserData`: `IsFavorite`, `Played`, `PlayCount`, `LastPlayedDate`, `PlayedPercentage`).
     `isPlayed(item)` = `Played`, `PlayCount > 0` or `PlayedPercentage ≥ 70`, and never for collections (`Type: BoxSet`).
6. `onLibraryLoad` → the UI lists the libraries; a click opens the library; the search box filters (`searchInArray`
   over every item field) with paging (10/20/50/100/custom).

Image URLs: `/Items/{id}/Images/Primary?fillWidth=…&fillHeight=…&quality=…` (thumbnails use `Setup.Sizes`; slot images
ask for 2000×2000 at quality 100).

**Jellyfin IndexedDB cache:** a database named after `Server.Id`; *stores* `Tags`, `Genres`, `Studios` and one per
library (`<libraryId>`), each with the key `"result"` holding a JSON string. "Clean Saved Memory" deletes everything and
reloads the page.

## 10. Fonts (`fonts.js`)

- **Local**: `window.queryLocalFonts()` (Chrome/Edge; needs a user gesture — the list is loaded when the `<select>` is
  opened). Without the API, a list of safe fonts is used. Non-default local fonts are loaded as `FontFace` from the Blob.
- **Google**: list in `fonts/google-fonts.json`; when used, it injects `<link href="https://fonts.googleapis.com/css2?family=…">`
  (the regular face) and waits for `document.fonts.load`. If the layer uses another weight (`lighter` → 100,
  `bold`/`bolder` → 700) or italic, `loadFontVariant` also loads the real face the browser would choose among the ones
  the family has (`fonts/google-fonts-variants.json`, generated from `https://fonts.google.com/metadata/fonts` on
  2026-10-23; regenerate it when `google-fonts.json` changes). A family without that face → no request, the browser
  imitates bold/italic as before. Options → **Load real bold/italic (Google Fonts)** (`Setup.Fonts.loadVariants`, on by
  default) turns this off and removes the faces already loaded.

## 11. Local persistence

| Where | Key | Content |
|---|---|---|
| `localStorage` | `server` | Jellyfin server address |
| `localStorage` | `jellyfinAuth` | Jellyfin session `{ server, serverId, userId, token }` (`Jellyfin` class; never the password) |
| `localStorage` | `username`, `password` | **Only from old versions**: used one last time to get the token, then deleted (`forgetSavedPassword`) |
| `localStorage` | `setup` | Serialized `Setup` |
| `localStorage` | `projectConfig` | Current project |
| `localStorage` | `customPostersLimits` | Custom paging limits |
| IndexedDB `pageMemoryDB` | Page URL | State of the `[save]` elements (including slot images in base64 and the server address; username and password no longer have `[save]`, and the old record is rewritten without them after login) |
| IndexedDB `<Server.Id>` | `Tags`, `Genres`, `Studios`, `<libraryId>` | Jellyfin library cache |

> **Shared origin:** on GitHub Pages, CoverMaker, content-recommender and the cdn demo all run on
> `https://jeffersoncgo.github.io`, so they **share** `localStorage` and IndexedDB. The `server` key, the `jellyfinAuth`
> session and the Jellyfin cache (`<Server.Id>` database) are read and written by both apps (logging in to one logs in
> to the other; "Sign out" signs out of both).

The **Clean Saved Memory** button calls `memory.reset()`, `jellyfin.cleanDb()` (which reloads the page) and clears
`setup`, `projectConfig` and the text layers.

## 12. Interface

- `windowsHandle.js`: `.floatWindow` with a draggable `.windowBar` and a `.closeBtn`; `showWindow(id)` centers it and
  brings it to the front (details below).
- `toast.js`: `toastMessage(msg, {position, type: default|success|danger|loading|warning|error|info, duration})`
  (`warning`, `error` and `info` only set the accent color, no icon); `duration <= 0` keeps the toast until
  `closeToast(toast)`.
- Panels: left (slots / settings), center (canvas + export bar), right (Jellyfin, hidden until login).
- Responsive layout: `css/mobile.css` (≤ 768 px, ≤ 480 px, landscape) and `mobileViewport.js` (`--app-height`, `--vh`).
- Drag and drop: slots, image effects, text layers and text effects (between layers).
- Copy/paste text effects through the clipboard (JSON).

- **Floating windows** (`windowsHandle.js`, also copied to content-recommender): dragged by the bar with Pointer Events
  (mouse, touch and pen); the last window opened/dragged stays on top (`z-index` from a counter close to the maximum,
  above everything else). Opening a window with a click/key moves focus to its first field; when the page opens it by
  itself (login at startup), focus does not change.
- **Accessibility**: clickable icons (`<i onclick>`, previews) get `tabindex="0"`, `role="button"` and `aria-label`
  (from `title`) and respond to Enter/Space (`makeClickablesAccessible` in `app.js`, also applied to `<template>`
  content). Page zoom is allowed.
- **Clean Saved Memory** asks for confirmation before deleting the project, images, settings and cache.

## 13. Tests

- `tests/unit.test.js` (Node 20+, no dependencies): `node --test "tests/*.test.js"`. Syntax of every script, gallery
  paths, effect registries (no duplicate key, valid parameters), font variants map, face choice, `Jellyfin` class
  helpers and, with the repositories side by side, whether the content-recommender copies are identical. Runs in CI
  before the deploy (`.github/workflows/static.yml`: `deploy` depends on `test`).
- `tests/browser/` (Playwright, manual): e2e of 42 flows, visual reference, pipeline, login against the mock Jellyfin,
  etc. Instructions in `tests/browser/README.md`.

## 14. Running locally

```bash
git clone https://github.com/jeffersoncgo/CoverMaker.git
cd CoverMaker
python3 -m http.server 8080      # any static server works; file:// does not (fetch/IndexedDB/CORS)
# open http://localhost:8080/
```

To use Jellyfin, the server must accept requests from the domain the app runs on (CORS) — Jellyfin accepts them by
default; reverse proxies may block them.

## 15. External dependencies

| Dependency | Version | Source | Use |
|---|---|---|---|
| Font Awesome | 6.7.2 | cdnjs (SRI) | Icons |
| JSZip | 3.10.1 | cdnjs (SRI) | Export/import `.zip` |
| meilisearch-js | 0.54.0 | `js/vendor/meilisearch_index.min.js` | Fast library loading |
| Google Fonts | — | fonts.googleapis.com | On-demand fonts |
| jeffersoncgo/cdn | identical copy (synced on 2026-10-23) | `js/vendor/` | Base utilities. Changed `cdn`? Copy the file here without editing the copy. |
