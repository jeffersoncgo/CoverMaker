# CoverMaker — Audit: bugs, suggested fixes and improvements

> Fix plan: [`FIX-PLAN.md`](FIX-PLAN.md).
> Status: ✅ fixed · ◐ partly fixed (what is left is stated in the item).

> Code review at `9928358`. Each item says **how it was checked**:
> 🧪 reproduced in Chromium (Playwright) with the app served locally · 🔎 code reading.
> Severity: **High** (broken feature, data loss or security), **Medium** (fails in common cases),
> **Low** (edge case, performance, maintenance).
> Problems in the libraries copied into `js/vendor/` are documented in `jeffersoncgo/cdn` → `docs/AUDIT.md`
> (IDs `CDN-xx`); the ones that affect CoverMaker are cited here.
>
> Second round (CM-28 to CM-32): ESLint with error rules (`no-undef`, `no-dupe-keys`, `no-unsafe-finally`, …)
> over all the JS, and a test that runs **every** layout (0, 1, 2 and 6 images), image effect and text effect
> in Chromium with default, minimum and maximum parameters, logging exceptions, empty output and time.

## Summary

| ID | Sev. | Where | Problem |
|---|---|---|---|
| CM-01 ✅ | High | `app.js:107` | Changing the parameters of an **image effect** changes nothing 🧪 |
| CM-02 ✅ | High | `app.js:2213`, `:1066` | First visit: the default text layer is not created and **nothing is saved** — everything is lost on reload 🧪 |
| CM-03 ✅ | High | `compositeRegistry.js`, `effectsRegistry.js:320,446` | With 0 or 1 slot (or Scanlines at opacity 0) the canvas **freezes** 🧪 |
| CM-04 ✅ | High | `app.js:1641`, `:1936` | "Download" fails when there is no text layer (and may export an old image) 🧪 |
| CM-05 ✅ | High | `app.js:708`, `index.html:39-43` | Jellyfin password stored in plain text (localStorage **and** IndexedDB) 🧪 |
| CM-06 ✅ | High | `jellyfin_ui.js:324,338`, `jellyfin.js:1151`, `toast.js:51` | XSS: names coming from Jellyfin inserted with `innerHTML` 🔎 |
| CM-07 ✅ | High | `textEffects.js:1938,2140,5833,5945` | `innerShadow` and `extrude` declared twice; the "Batman" gallery project loses parameters 🔎 |
| CM-08 ✅ | High | `jellyfin.js:124-143,372-410,1188-1221` | Failed login treated as success; with the Meilisearch plugin, a non-admin user never loads libraries 🔎 |
| CM-09 ✅ | High | `gallery/gallery.json:122` | "Series — Rough → Use Full Project" points to a ZIP that does not exist 🧪 |
| CM-10 ✅ | Medium | `app.js:1440,1479,1489,941` | Export/Import Config incompatible; the import is overwritten by what was saved 🧪 |
| CM-11 ✅ | Medium | `slots.js:178` | Duplicate slot IDs after remove + add (restore swaps images) 🧪 |
| CM-12 ✅ | Medium | `app.js:1185-1195` | `updateImageSettings` mutates `Setup.Sizes`: Jellyfin thumbnails start being requested at 1920 px 🧪 |
| CM-13 ✅ | Medium | several | Unhandled exceptions and wrong IDs/elements (list) 🧪/🔎 |
| CM-14 ✅ | Medium | `drawing.js:65,322,488,569` | The step cache only works by accident; canvas clones on every redraw 🧪 |
| CM-15 ✅ | **High** | `jellyfin.js:171-208,317-334` | Jellyfin IndexedDB: connections never closed **stall the first library load** (40 s+ measured); no timeout 🧪 |
| CM-16 ◐ | Medium | `jellyfin.js:476-504,1039-1099` | Library cache only invalidated by count; `UserData` never refreshes by default 🔎 |
| CM-17 ✅ | Medium | `app.js:2021`, `vendor/controller.js` | Race in `updateTextSettings` can duplicate layers (potential) 🔎 |
| CM-18 | Medium | `index.html`, `vendor/pagememory.js` | Heavy `pageMemory`: ~340 KB of `outerHTML` per save, scans the whole panel on every click 🧪 |
| CM-19 ✅ | Low | `app.js:1851-1897`, `gallery.js:164-220` | ZIP import drops empty trailing slots; inconsistent "Use Json" flow 🔎 |
| CM-20 ✅ | Low | `index.html` | Invalid HTML (`#app` never closed, missing `div` in the template, duplicate `src`) 🧪 |
| CM-21 ✅ | Low | `effectsRegistry.js`, `drawing.js:224` | Filters redrawn over their own canvas (blur edges); `ctx.filter` on Safari 🔎 |
| CM-22 ✅ | Low | `compositeRegistry.js`, `textEffects.js` | Unseeded randomness: the same project renders differently after a reload 🔎 |
| CM-23 ✅ | Low | `fonts.js:214-229` | Google Fonts loads only the default weight/style (synthesized bold/italic) 🔎 |
| CM-24 ✅ | Low | `windowsHandle.js:85-100` | A `window` parameter shadows the global; windows do not drag on touch 🔎 |
| CM-25 ◐ | Low | several | Dead / legacy code 🔎 |
| CM-26 ✅ | Low | `README.md`, `CONTRIBUTING.md` | Outdated or wrong documentation 🔎 |
| CM-27 ◐ | Low | `index.html`, `paramsRenderer.js:213` | Accessibility and language consistency 🔎 |
| CM-28 ✅ | Medium | `textEffects.js` (`actionSpeedlines`) | "Anime Speedlines" erases the text with the default values 🧪 |
| CM-29 ✅ | Medium | `textEffects.js:1205` (`lightning`) | "Lightning" with Seed = 0 (slider minimum) throws `rnd is not a function` 🧪 |
| CM-30 ✅ | Medium | `textEffects.js` | Controls that do nothing and an `"undefined"` parameter saved in projects 🧪 |
| CM-31 ◐ | Medium | `textEffects.js` | Text effects freeze the page for seconds (Stained Glass: 46 s at the minimum) 🧪 |
| CM-32 ◐ | Low | several | Lint findings and parameter edge cases 🧪 |
| CM-33 ✅ | Medium | `app.js:2013` + `vendor/controller.js` | Jellyfin search ignored the last keys typed (fixed through `CDN-02`) 🧪 |
| CM-34 ✅ | High | `jellyfin.js:754` | `searchItems` with 3 arguments got the `AbortSignal` as `tempLimit` → empty list (breaks content-recommender, `CR-14`) 🧪 |

---

## High

### CM-01 — Image effect parameters have no effect 🧪 — ✅ fixed (2026-10-23)

`onEffectParamChange` (`app.js:107`) writes to `Setup.Settings.canvas.effects`, but the pipeline reads
`projectConfig.canvas.effects`. `Setup.Settings` is the same object as `projectConfig` only right after a project import
(`loadFullProjectFromJson`); in a normal session it is `{}` (created in `ensureCompositeDefaults`, `app.js:852`) or an old
copy deserialized from `localStorage.setup`.

Repro: open the app, **Image → Effects → +** (Blur), drag the "Blur Amount" slider →
`projectConfig.canvas.effects[n].params.amount` stays `5` and the canvas does not change.

The same pattern exists in `onTextEffectParamChange` (`app.js:630`), masked by the delegated `#settingsContent` listener
that rereads the whole text layer DOM.

Fix:

```js
// app.js:107
const effects = projectConfig?.canvas?.effects;
// app.js:630
const effects = projectConfig?.textLayers?.[layerIndex]?.effects;
```

And remove the alias: drop `Setup.Settings` from `ensureCompositeDefaults` (852), `addtypeSelectOptions` (2313) and
`drawing.js:575`, and stop writing `Settings` inside `localStorage.setup` (today the whole project is duplicated there).

### CM-02 — First visit saves nothing 🧪 — ✅ fixed (2026-10-23)

- `dummyStart()` calls `loadTextLayers(Setup.defaults.textLayers)` (`app.js:2213`), but `Setup.defaults.textLayers`
  is **an object**, not an array → the `for` loop does not run and no layer is created.
- At the end of `loadTextLayers`, `idsToCheck.length == layersData.length` (`app.js:1066`) compares `0 == undefined` →
  `window.memoryLoaded` stays `false`.
- `saveprojectConfig()`/`saveSetup()` (`app.js:922-931`) only write when `memoryLoaded` is `true`.

Measured result: in the first session `localStorage.projectConfig` and `localStorage.setup` are never created; the
layout, effects and text layers added vanish on reload (persistence only works from the 2nd session on, when the
`pageMemory` restore turns `memoryLoaded` on).

Fix:

```js
// dummyStart()
loadTextLayers([JSON.parse(JSON.stringify(Setup.defaults.textLayers))]);
window.memoryLoaded = true;

// loadTextLayers(): accept a single object and enable saving even without layers
if (layersData && !Array.isArray(layersData)) layersData = [layersData];
…
window.memoryLoaded = true;
```

### CM-03 — Canvas freezes with 0/1 image or with effects that return nothing 🧪 — ✅ fixed (2026-10-23)

The pipeline (`drawing.js:65`) stores `{hash, ...result}`; when an `apply` does `return;`, the result has no `canvas`,
`applyImageEffects`/`drawComposite` stop and **the visible canvas stops updating** — text included.

- Measured by running each layout: **40 of 40** return no canvas with 0 images and **34 of 40** with 1 image
  (`if (!N) return;` / `if (N === 1) return;` in carousel, fanSpread, scatteredPhotos, polaroidWall, honeycomb, …),
  sometimes after having drawn the background already. With 2 or more images all of them work and none throws.
- `effectsRegistry.js:446` (Scanlines with `opacity` 0 — the slider minimum) and `:320` (Reflection with size 0).

Repro: keep 1 slot, "3D Carousel" layout, edit the text → the canvas does not change. Or Scanlines at opacity 0 → no
later change shows up.

Fix in a single place (keeps the functions' identity, so the cache still works):

```js
// drawing.js — run once, after the registries load
function normalizeApplyResults(registry) {
  for (const def of Object.values(registry)) {
    const original = def.apply;
    if (typeof original !== 'function' || original.__normalized) continue;
    def.apply = async (ctx, canvas, ...rest) => (await original(ctx, canvas, ...rest)) || { canvas, ctx };
    def.apply.__normalized = true;
  }
}
normalizeApplyResults(COMPOSITE_REGISTRY);
normalizeApplyResults(EFFECTS_REGISTRY);
```

And, in the layouts, replace `return;` with `return { canvas, ctx };` (with 1 image, draw at least the background/the
image).

### CM-04 — Export depends on text existing 🧪 — ✅ fixed (2026-10-23)

`exportAsPNG` uses `Composites.Merged.toDataURL` (`app.js:1641`), but `Merged` is only created when there is a text
canvas (`drawing.js:277-279`). On the first visit (no layers, see CM-02) the **Download** button throws
`TypeError: Cannot read properties of undefined (reading 'toDataURL')`. If the layers are disabled after they existed,
`Merged` keeps the **old** image and that is what gets exported/opened (`openInNewTab`, `app.js:1936`).

Fix: export the visible canvas (always the final result) and use `toBlob` (avoids *data URLs* of tens of MB):

```js
mainCanvas.toBlob(blob => {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: getExportFileName() });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}, `image/${format}`, quality);
```

In `drawComposite`, reset `window.Composites.Merged` when there is no text.

### CM-05 — Plain-text password 🧪 — ✅ fixed (2026-10-23)

- `saveFieldsToStorage` writes `localStorage.password` (`app.js:708`).
- `#Password` has the `save` attribute (`index.html:43`) → `pageMemory` writes the value into the `pageMemoryDB`
  IndexedDB (confirmed: the typed password shows up in the record).
- The form comes prefilled with `admin` / `password` and the app tries to log in with that on load.

Any script on the same origin (`jeffersoncgo.github.io` also hosts `cdn` and `content-recommender`) can read those
credentials. Suggested fix:

1. Remove `save` from the password field and the `localStorage.password` write; leave the fields empty by default.
2. After login, keep only `{ server, userId, accessToken }` and reuse the token
   (`authorization: MediaBrowser … Token="…"`); offer a "Sign out" that calls `POST /Sessions/Logout`.
3. Current users have the password saved: in the next version, delete `localStorage.password` and the `pageMemory`
   record.

What was done (2026-10-23): login keeps only `localStorage.jellyfinAuth = { server, serverId, userId, token }`; on load
the token is validated with `GET /Users/{userId}` and no password is sent. Users who had the password saved log in with
it **one last time**; once the token is obtained (or if the server rejects the password), `localStorage.password`/`username`
are deleted and the `pageMemory` record is rewritten without the login fields (which lost their `[save]`). The form no
longer comes with the `password` password prefilled. A new **Sign out** button calls `POST /Sessions/Logout`. Checked
against the mock Jellyfin: migration from the old app on the same origin, reload with the token only, revoked token,
wrong password, account switch, sign out, regular user with Meilisearch and server offline (10/10).

### CM-06 — XSS through Jellyfin metadata 🔎 — ✅ fixed (2026-10-23)

`addVideoposter`/`addLibrarycover` do `label.innerHTML = item.Name` (`jellyfin_ui.js:324,338`) and
`showLoadingLibraries` builds HTML with `lib.Name` (`jellyfin.js:1151`). Names come from metadata (NFO files, scrapers,
any user with edit permission). `toastMessage` also uses `innerHTML` (`toast.js:51`) and receives `err.message` in
several places. Fix: `label.textContent = item.Name;` and, in the toast, `span.textContent = message` (build the icon
separately).

### CM-07 — Duplicate text effects 🔎 — ✅ fixed (2026-10-23)

What was done: the first definitions are back as `innerShadowOffset` and `extrudeShaded`; `innerShadow`/`extrude` render as before. Automatic migration of the Batman project was **not** done: measured against the result image, the difference between the versions is ~1 % (inconclusive) — proposed to the user.

`TEXT_EFFECTS` declares `extrude` (lines 1938 and 5945) and `innerShadow` (2140 and 5833). In an object literal the
second declaration silently replaces the first, and the schemas differ:

| Effect | 1st definition (dead) | 2nd definition (active) |
|---|---|---|
| `innerShadow` | `color, blur, offsetX, offsetY, opacity` | `color, distance, angle, blur, opacity` |
| `extrude` | `depth, angle, color, shading` | `depth, angle, color, fade` |

`gallery/projects/batman-collection/project.json` uses `innerShadow` with `offsetX/offsetY` → those values are ignored
and the result differs from the original. Fix: rename the first ones (`innerShadowOffset`, `extrude3D`) to keep old
projects, or migrate parameters on load (`distance = hypot(offsetX, offsetY)`, `angle = atan2(offsetY, offsetX)`). A
simple test that fails on duplicate keys prevents a repeat
(e.g. `grep -E "^  [a-zA-Z0-9]+: \{" | sort | uniq -d`).

### CM-08 — Login/Meilisearch flow 🔎 — ✅ fixed (2026-10-23)

What was done: `init()` no longer rejects (server offline and missing credentials become `onServerSetupError` /
`onLoginError`); a failed login stops the flow; without access to the plugin configuration, or on a Meilisearch error,
libraries load through Jellyfin (checked with a regular user and the plugin present). **Kept on purpose:** the automatic
adjustment of the Meilisearch index attributes (`updateFilterableAttributes`/`updateSortableAttributes`) — it is a
feature the app uses; asking before changing the index stays a suggestion.

- `login()` catches the error and returns `undefined` (`jellyfin.js:397-409`); in `init()` the `.then` runs anyway
  (`:132-140`), sets `isAuthenticated = true` and calls Meilisearch/libraries without a token (cascade of 401s).
- `init()` is `async` and called in the constructor without a `catch`: with the server offline it produces
  `Uncaught (in promise) Error: Server is offline` (seen in the console on every load without Jellyfin).
- Meilisearch: the page `/web/configurationpage?name=Meilisearch` needs no privilege, so `isAvailable` becomes `true`
  for any user; but `/Plugins/{id}/Configuration` requires an administrator (worth confirming with a regular account).
  For non-admins, `ApiKey/Url` stay undefined, `new meilisearch.Meilisearch({ host: undefined })` throws and the
  `setTimeout(getLibraries)` is never scheduled → **libraries do not load**. The same happens if Meilisearch's internal
  URL is not reachable from the browser.
- The app exposes the Meilisearch API key to the browser and **changes the server's index configuration**
  (`updateFilterableAttributes`, `updateSortableAttributes`, `updatePagination`) without warning — that triggers a
  reindex in Meilisearch.

Fix:

```js
async login() { … if (!response.ok) throw new Error(`HTTP ${response.status}`); … }   // propagate
async init() {
  await this.getPublicInfo(); if (!this.Server.isOnline) return;
  await this.setFastestAddress();
  if (!this.User.Username) return;
  try { await this.login(); } catch { return; }          // onLoginError has already fired
  try { await this.setupMeiliSearch(); } catch (e) { console.warn('Meilisearch unavailable', e); this.Meilisearch.isAvailable = false; }
  await this.getLibraries();
}
```

In `loadLibraryItems`, fall back to `loadLibraryItemsVanilla` if the Meilisearch call fails; ask for confirmation
before changing the index.

### CM-09 — Broken gallery link 🧪 — ✅ fixed (2026-10-23)

`gallery.json:122` points to `series.rough.project.zip`; the file is `series-rough.project.zip`.
Fix: `"project": "gallery/projects/series-rough/series-rough.project.zip"`. A workflow step that validates every path
in `gallery.json` would prevent this:

```bash
python3 -c "import json,os,sys;b=[(i['id'],k,i[k]) for i in json.load(open('gallery/gallery.json')) for k in ('image','setup','project') if i.get(k) and not os.path.exists(i[k])];print(b);sys.exit(bool(b))"
```

---

## Medium

### CM-10 — Export/Import Config 🧪 — ✅ fixed (2026-10-23)

- **Export Config** writes `JSON.stringify(Setup)` (keys `Sizes, Library, Images, …`; `app.js:1440`).
- **Import Config** requires `jsonData.Setup` (`app.js:1479`) → the file exported by the app itself is rejected
  ("missing Config object").
- Even with the right format, `importConfigFile` calls `loadSetup()` (`:1489`), which rereads `localStorage.setup` and
  merges it **over** the imported one (the old values win).
- `loadSetup` shows `Setup.Export.Project.Images.jpegQuality` (`:941`), a key that does not exist (it is `quality`) →
  the UI always shows 0.95.

Fix: export `{ Setup }` (or accept both formats on import), apply the imported data directly
(`Setup = deepMerge(imported, window.defaultSetup)`), update the UI from `Setup` and only then `saveSetup()`.

### CM-11 — Duplicate slot IDs 🧪 — ✅ fixed (2026-10-23)

`addImageSlot` uses `slot-${slotsImages.length - 1}` (`slots.js:178`). After removing slot 1 of 4 and adding another,
the IDs become `slot-0, slot-2, slot-3, slot-3` (checked). `pageMemory` finds `img-slot-3` by `#id` → two previews point
to the same record and an image is restored into the wrong slot or lost.
Fix: a monotonic counter (`let nextSlotId = 0; … slot-${nextSlotId++}`) or the existing `ensureUniqueId` in `app.js`.

### CM-12 — `Setup.Sizes` mutated 🧪 — ✅ fixed (2026-10-23)

`updateImageSettings` does `const _format = Setup.Sizes[format]` and changes `_format.width/height`
(`app.js:1185-1195`). `Setup.Sizes.cover/poster` also set the size of the Jellyfin panel **thumbnails** (480×270 /
270×480): after the first draw, `Setup.Sizes.cover` becomes 1920×1080 and, when "Poster" is chosen,
`Setup.Sizes.poster` becomes 1080×1920 (measured) — each thumbnail is then requested with ~16× more pixels. The mutated
value also goes into `localStorage.setup`.
Fix: compute into local variables and separate "canvas aspect ratio" from "thumbnail size":

```js
const { width: rw, height: rh } = Setup.Sizes[format];
const ratio = rw / rh;
const size = ratio > 1 ? { width: 1920, height: Math.round(1920 / ratio) } : { width: Math.round(1920 * ratio), height: 1920 };
setCanvasSize(size.width, size.height);
```

### CM-13 — Exceptions and wrong references — ✅ fixed (2026-10-23; `jellyfin.js:127` together with CM-08)

| Place | Problem | Fix |
|---|---|---|
| `slots.js:6-7` | Slots full: `alert` and goes on → `TypeError` on `preview.src` | `return` after the alert (or create a new slot) |
| `slots.js:356` | `fillSlotsRandomly` with fewer items than slots → `item.Id` of `undefined` | `if (!item) continue;` |
| `slots.js:372-376` | `radomizeSlotImage` without an item: shows an error and goes on → `TypeError` | `return` inside the `if` |
| `slots.js:422` | `delete el.files[0]` does nothing (FileList is read-only) | `el.value = ''` |
| `jellyfin_ui.js:29` | `Server.Speed.time` when `setFastestAddress` fails → `TypeError` | `Server.Speed?.time ?? 0` |
| `jellyfin_ui.js:299` | `jellyfinContainer.value = …` (a `div`) | `jellyfinsearchInput.value = …` |
| `app.js:693` | `getElementById('jellyfinNextPage')`; the id is `nextPage` → the "next" button never gets disabled | `'nextPage'` |
| `jellyfin.js:127` | Unhandled `throw` in `init()` (see CM-08) | return and fire `onServerSetupError` |
| `drawing.js:575` | Error message reads `Setup.Settings` (always empty) | `projectConfig.canvas.composite.type` |
| `app.js:1959` | `cropCanvas` returns `null` for an empty canvas → `null.toBlob` | check first |
| `slots.js:474-483` | `getIndexFromButtonClick` returns `undefined` and `clearImageSlot(undefined)` creates `slotsImages.undefined` | validate the index |

### CM-14 — Fragile step cache and repeated work 🧪 — ✅ fixed (2026-10-23)

Instrumenting `runStep` in the browser:

- The outer `applyComposite` step (`drawing.js:569`) does not include the layout parameters in the hash (only canvases
  and `slotsImages`, which become `{}`); it is only recomputed because `{ hash: newHash, ...result }` (`drawing.js:65`)
  lets the **inner** result's `hash` overwrite the step's — so this step **never** hits the cache. If someone "fixes"
  the spread order, changing layout parameters will stop redrawing. Fix: include `projectConfig.canvas.composite` in the
  step parameters and store `{ ...result, hash: newHash, index }`.
- `applyImageEffects` (`:322`) and `drawCompositeText` (`:488`) clone a 1920×1080 canvas (~8 MB) per effect **before**
  checking the cache — on every redraw, even when nothing changed. Move `cloneCanvas` inside the step function.
- The text hash does not take the font state into account: if Google Fonts finishes loading after the first draw, the
  layer keeps the *fallback* font until another parameter changes. Include `document.fonts.check(font)` in the
  parameters or call `clearStepsCache()` on `document.fonts.onloadingdone`.
- `stepsCache` keeps every intermediate canvas (tens of MB with several layers/effects) and is never trimmed when the
  number of steps goes down: `stepsCache.length = lastStepIndex` at the end of `drawComposite`.

### CM-15 — Jellyfin client IndexedDB 🧪 — ✅ fixed (2026-10-23)

**Confirmed on 2026-10-23** with a mock Jellyfin server and a clean browser profile: the library load stalled for more
than 40 s right after `getLibrarySize`; each forced garbage collection (`gc()`, which closes the forgotten connections)
unblocked one step. In real browsers collection happens at some point, which explains the README's "First login takes
10-30 seconds". Affects CoverMaker and content-recommender.

- `openDB` (`jellyfin.js:171-199`) opens a new connection on **every** `saveData/loadData/clearData` and never closes
  it. When a *store* does not exist it reopens with `version + 1`; the old open connections get `versionchange` and do
  not close → the upgrade request is blocked and the Promise never resolves (there is no `onblocked`). Open a single
  connection, handle `onversionchange = () => db.close()` and `onblocked`.
- `saveData` returns `tx.complete` (`:207`), a property that does not exist on `IDBTransaction` (it belongs to the `idb`
  library) → nobody can wait for the write or see errors. Return a Promise with `tx.oncomplete/onerror`.
- `signal.timeout = 5000` (`:320`) does not create a timeout. Use `AbortSignal.timeout(5000)`
  (or `AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])`).

### CM-16 — Library cache 🔎 — ◐ (2026-10-23)

Done: items edited on the server get into the cache (`refreshChangedItems`: `LastSync` + `MinDateLastSaved`; the count
still decides the full reload); `UserData` with a `Map` and normalized IDs (also for Meilisearch items) and with
`PlayedPercentage` (the "≥ 70 %" rule now applies); the Meilisearch filter escapes `\` and `"`; "Random" uses
Fisher-Yates. **Kept on purpose:** searching all fields (that is how genre/tag/studio search works from the search
field list); redrawing the progress panel every frame; `isLibrarySizeChanged` (dead code, listed in `CM-25`).

- The cache is only invalidated if the item **count** changes (`jellyfin.js:485`): changed covers, titles, genres or
  replaced items are not noticed. For incremental sync, store the date of the last load and ask only for what changed
  with the `minDateLastSaved` parameter of `/Users/{id}/Items` (and `minDateLastSavedForUser` for `UserData`).
  The README talks about a "delta sync" that does not exist today.
- `isLibrarySizeChanged(library.Id, …)` (`:501`) looks up by **Id** in an object keyed by **name** → always `true`
  (dead code; if it were `false`, `this.Libraries[library.Name].Status` would break).
- `updateLibraryUserData` returns early when `needsUserData` is `false` (default) → `UserData` (played/favorite) stays
  as it was on the first load. It does not matter for CoverMaker; it does for content-recommender (see its audit).
  When it runs, it uses `allItems.find` per item (O(n²)); use a `Map`.
- Meilisearch filter: `path STARTS WITH "${loc}"` (`:884`) escapes neither `"` nor `\` (Windows paths `C:\Media`).
- `showLoadingLibraries` rebuilds the progress panel HTML on **every** `requestAnimationFrame` while loading.
- Search (`searchItems`) runs `searchInArray` over **all** fields of each item (Overview, Path, Id…): searching "2020"
  or "the" matches almost everything; and because the array is recreated on every call (`concat`/`filter`), the
  `searchInArray` cache is never used. Search `Name`/`OriginalTitle` (with a separate "search everything" option).
- `sort(() => 0.5 - Math.random())` does not shuffle uniformly; use Fisher-Yates.

### CM-17 — Race in `updateTextSettings` (potential) 🔎 — ✅ fixed (2026-10-23)

`updateTextSettings` empties `projectConfig.textLayers` and then does `await loadFont(...)` per layer. Wrapped by
`Controller.wrap(..., true)` (`app.js:2021`), a new call "aborts" the previous one, but the previous one keeps running
(it does not check the `signal`) and pushes into the **new** array → duplicate layers in `projectConfig` (and in
`localStorage`) when a font is slow to load while the user types. Made worse by `CDN-01`. Fix: build a local array and
assign it at the end, aborting if `signal.aborted`:

```js
async function updateTextSettings(signal) {
  const layers = [];
  for (const layerEl of …) { …; await loadFont(…); if (signal?.aborted) return; layers.push(newLayer); }
  projectConfig.textLayers = layers;
  drawComposite(); saveprojectConfig();
}
```

### CM-18 — `pageMemory` cost 🧪

`#leftSide`, `#rightSide` and `#jellyfinimages` have `save`. With the current implementation (`CDN-03`, `CDN-07`,
`CDN-08`): every click/input/mutation in those panels schedules a save that serializes the page's `outerHTML`
(**~340 KB** measured) plus every `[save]` element and the slot images in base64; saving has a 500 ms debounce and a
2 s minimum interval, so the **last** change may not be saved. Suggestions: mark only the controls that need it with
`save` (not the panels), drop the `dom` field, and persist slot images in their own *store* (Blob straight into
IndexedDB, no base64).

---

## Low

### CM-19 — Import 🔎 — ✅ fixed (2026-10-23)

- `importImagesFromZip` does `setSlots(0)` and then `setSlots(highestIndex + 1)`; since the ZIP import calls
  `loadFullProjectFromJson(…, true)` (ignores `imageSlots`), empty slots at the end of the project disappear.
  Use `projectData.imageSlots.length` when present.
- `useSetup` imports a ZIP's `project.json` without `isSetupOnly` and a `.json`'s with `true` (the argument is ignored
  by `importProjectFromJson`, which always passes `true`).
- The file picker accepts `.json,.zip,.covermaker.zip`, but "Save Setup" produces `*.covermaker.setup.json` and
  "Export Config" produces a JSON in another format that, if opened with the project button, is read as a project.

### CM-20 — Invalid HTML 🧪 — ✅ fixed (2026-10-23)

What was done: `#app` and the template layer closed exactly where the browser already closed them (the built DOM is identical to before, compared with `DOMParser`); duplicate `src` and `</img>` removed. **Kept**: the `<li>` outside `<ul>` and the `value` on `<select>`: fixing them would change the DOM.

- `<div id="app">` (`index.html:341`) is never closed (the `<script>` tags and `#toast-root` end up inside it).
- In `#text-layer-template` a `</div>` is missing in the "Position/Rotation" section (the browser closes it at
  `</template>`).
- Duplicate `<img src="" … src="">` (`:108`); `<img></img>`; `<li class="tab">` outside `<ul>`; `value` on `<select>`.

### CM-21 — Image filters 🔎 — ✅ fixed (2026-10-23)

What was done: `edges: Extend Edges` option on Blur; default `Classic` (as before). The other filters cover the whole image and have no halo.

The `blur`, `grayscale`, `brightness`, … effects (`effectsRegistry.js`) and `blurImage` (`drawing.js:224`) apply
`ctx.filter` by drawing the canvas **over itself**: the result is the filtered image composited over the original.
In `blur`, the blurred edges become semi-transparent and the sharp image shows underneath (halo at the edges). Clear
first or draw from a copy: `const src = cloneCanvas(canvas).canvas; ctx.clearRect(…); ctx.filter = …; ctx.drawImage(src, 0, 0)`.
The app uses `ctx.filter` in 67 places; `CanvasRenderingContext2D.filter` support on Safari has historically been
missing — worth testing and, if needed, offering a *fallback* (the README claims "Safari 14.1+ ✅").

### CM-22 — Non-reproducible results 🔎 — ✅ fixed (2026-10-23)

What was done: a `seed` parameter (0 = random, as before) on the 6 items; `crystallize` used `Math.random` in one line even with a seed.

`comicLayout`, `glitchMosaic`, `cctv` (composites) and `mosaic`, `woodTexture`, `gummyCandy` (text) use `Math.random()`
without a seed; other effects fall back to `Math.random` when `seed` is empty/0. The cache hides this during the
session, but after reloading/importing the same project the image changes. Use `createSeededRandom(params.salt || 1)`
(it already exists in `textEffects.js:37`) and expose `seed` where it is missing.

### CM-23 — Font variants 🔎 — ✅ fixed (2026-10-23)

What was done: real faces loaded only when the family has them (local map); an option turns it off.

`loadFont` requests `css2?family=Name` (weight 400 normal only). When `bold`/`italic` is chosen, the browser
synthesizes it. Request the available axes (e.g. `family=Name:ital,wght@0,400;0,700;1,400;1,700` — the API returns 400
if the variant does not exist, so handle the error and retry without axes). `document.fonts.load` resolves even when
the font does not load (it returns `[]`): check the array length.

### CM-24 — Windows 🔎 — ✅ fixed (2026-10-23)

What was done: parameter renamed (`win`); dragging through Pointer Events (mouse the same, now also touch/pen); `z-index` from a counter close to the maximum (windows stay above everything and the last one opened stays on top).

`document.querySelectorAll('.floatWindow').forEach(window => …)` (`windowsHandle.js:85`) shadows the global `window`:
`window.innerWidth` becomes `undefined` and the viewport fit never happens. Rename it to `win`. Dragging only uses mouse
events; switch to *Pointer Events* (`pointerdown/move/up` + `setPointerCapture`) so it works on touch.
`z-index = Date.now()` goes past the 32-bit maximum (the browser clamps it); a simple counter is enough.

### CM-25 — Dead / legacy code 🔎 — ◐ list for a decision (2026-10-23; nothing was removed)

Checked on 2026-10-23, still true: `factory.js` is loaded by `index.html` and nothing uses it; `vendor/search.js` is
loaded and CoverMaker does not use `SearchEngine` (the Jellyfin client uses `searchInArray` from `object.js`);
`pipelineManager`/`PipelineStep` do not exist (the code falls through to `drawComposite`); `libraryImagetoCanvas` has no
caller; `debugSlotsImages`/`fillSlotsWithNumbers` only serve for debugging from the console; `isLibrarySizeChanged` is
never false in the only place it is used; 27 variables assigned and never used (lint). In content-recommender, the
`if (window.jellyfin.onLibraryLoad)` block in `onLoginSuccess` never runs (the types are filtered in `getList`).
Removing any of these is up to the user (decision D7 in the plan).

- The whole of `factory.js` (no callers; `Object.assign(select, { options })` would throw).
- `pipelineManager`, `PipelineStep._stableStringify`, `markImageBaseDirty` (`slots.js:157-171`, `app.js:270`) — from an
  old pipeline.
- `libraryImagetoCanvas` (`jellyfin_ui.js:77-87`) uses variables that do not exist.
- `vendor/search.js` is loaded and not used.
- `blendMode` read in `applyTextEffect` with no parameter in the UI.
- Legacy keys in `projectConfig.canvas` (`overlayColorStart`, `reflectionDistance`, `salt`, …) and `Setup.Sizes.square = 1×1`.
- `dummyStart` hotlinks IMDb posters (`m.media-amazon.com`) — they may go away or be blocked.
  Prefer our own images in `gallery/` or `images/`.
- `fillSlotsWithNumbers`/`debugSlotsImages` and commented-out debug buttons.

### CM-26 — Documentation 🔎 — ✅ fixed (2026-10-23)

What was done: README and CONTRIBUTING corrected where they claimed things that do not exist (OffscreenCanvas, `GALLERY.md`, JSON project, custom size in pixels, delta sync); the rest of the text stayed as it was.

- The README claims "OffscreenCanvas rendering for non-blocking UI" — there is no `OffscreenCanvas` and no *Workers*;
  everything runs on the main thread.
- "Complete project save/load as JSON files" — the main format is `.covermaker.zip`.
- It lists 19 text effects; there were 86 (see [`EFFECTS-REFERENCE.md`](EFFECTS-REFERENCE.md)). The "Text Layer
  Effects" section and the effect list appear twice.
- It cites `gallery/GALLERY.md`, which does not exist; `CONTRIBUTING.md` cites an automation that regenerates that
  file, which does not exist in the repository either.
- "Custom: Define any dimensions (width/height in pixels)" — the values are used as an aspect ratio (longest side =
  1920 px).
- "Multiple strokes and shadows", "3D depth 0-50", "Glow intensity 0-3" describe an old UI; today everything is an
  effect.

### CM-27 — Accessibility and language 🔎 — ◐ (2026-10-23)

What was done: zoom allowed in the `viewport`; clickable icons with focus, `role="button"`, an accessible name and Enter/Space (also in the templates); styled `warning`/`error`/`info` toasts; focus moves to the window the user opened. **Not done** (visual or text change nobody asked for, left as a suggestion): highlighting the pinned slot and the Portuguese hint in `paramsRenderer`.

- `maximum-scale=1.0, user-scalable=no` (`index.html:6`) blocks zoom (WCAG 1.4.4).
- Main actions are `<i onclick>`: no keyboard focus, no `role="button"`, no accessible name besides `title`.
  Use `<button type="button" aria-label="…"><i aria-hidden="true"></i></button>`.
- English UI with a Portuguese hint (`paramsRenderer.js:213`: "duplo clique alterna número/slider", "double click
  toggles number/slider") and mixed-language comments; pick one language (or simple i18n with a dictionary).
- Toast types `warning`, `error` and `info` are used but have no style in `css/toast.css` (they look like "default").
- A pinned slot has no visual highlight besides the icon, and the icon shown when pinned is the "unpin" one.

---

## Second round

### CM-28 — "Anime Speedlines" erases the text 🧪 — ✅ fixed (2026-10-23)

What was done: text copied before `clearRect`; a new `Lines Only` mode reproduces the old `Behind Text` pixel for pixel.

`actionSpeedlines.apply` does `ctx.clearRect(0, 0, w, h)` **before** using `canvas` as the mask and as the text source
(the `ctx` belongs to that same `canvas`). In the default "Inside Text" mode the mask is empty and the whole layer
vanishes; in "Behind Text" only the lines are left, without the text. Fix: copy the text before clearing.

```js
const src = cloneCanvas(canvas).canvas;   // before clearRect
ctx.clearRect(0, 0, w, h);
// … use `src` instead of `canvas` in lCtx.drawImage(…) and ctx.drawImage(…)
```

### CM-29 — "Lightning" with Seed 0 🧪 — ✅ fixed (2026-10-23)

`createSeededRandom(0)` returns `null` (seed 0 means "random"), and `lightning` (`textEffects.js:1205`) calls `rnd()`
without a *fallback* → `TypeError: rnd is not a function` when the Seed is dragged to 0. Fix:
`const rnd = createSeededRandom(seedVal) ?? Math.random;` (as `channelTear` and `nordicRuneforge` already do).

### CM-30 — Controls with no effect and an `"undefined"` parameter 🧪 — ✅ fixed (2026-10-23)

What was done: titles and the `"undefined"` key fixed (Phase 2); `grout` now works with `groutStyle: Use Grout Width` (default `Hairline`, identical to before); Blueprint's `bgColor` kept as a reference (filling the background would cover the image behind the text).

- `stainedGlass`: the **Grout Width** slider (`grout`) is read and never used (`textEffects.js:4829`).
- `blueprint`: **Paper Color** (`bgColor`) is never read (its own comment says it is "reference only").
- `sauronFire`, `chiseledMetal`, `engravedMetal` and `plasma` use `{ type: 'span', label: 'Colors' }` as a section
  title, without a `key`. `renderParamsOptions` groups by `key` in a `Set`, so **only the first title shows**
  ("Colors"; "Texture", "Pupil", "Effects"… vanish) and the control gets `data-param-key="undefined"` → the project
  saves `"undefined": ""` in the parameters (checked in Chromium). Fix: in `renderParamsOptions`, treat entries without
  a `key` as titles (render a label and skip `dataset.paramKey`), or switch to `group: 'Colors'` in the parameters.

### CM-31 — Slow text effects on the main thread 🧪 — ◐ (2026-10-23)

What was done: `stainedGlass`: spatial grid, **same output**, Shard Size 5 from 34.7 s to 0.17 s; `longShadow`: one reused pass canvas, same output, 17–30 % faster (cropping to the text area changed pixels and was dropped). The others stay as they are.

Time of **one** effect on a 1920×1080 canvas (*headless* Chromium, software rendering — on a machine with a GPU the
numbers are lower, but the proportion holds):

| Effect | Parameters | Time |
|---|---|---|
| `stainedGlass` | minimum (Shard Size 5) | **45.8 s** |
| `neon` | maximum | 8.7 s |
| `longShadow` | maximum | 7.1 s |
| `paintBrush` | maximum | 5.1 s |
| `longShadow` | **the app's default layer** (length 48, blur 2) | 2.9 s |
| `nordicRuneforge`, `stainedGlass`, `infernoForge` | default | 1.2 – 2.0 s |

The 86 effects with default parameters add up to ~18 s. Since every text change invalidates the cache of that layer's
effects, typing with the default layer freezes the interface for seconds, and a slider at the extreme can hang the tab.

- `longShadow` creates `length + 1` full-screen canvases (49 × ~8 MB) and applies `blur` to each. Crop to the text
  area (`cropCanvas` already exists), reuse a single pass canvas and apply the blur once every N passes.
- In general: process only the rectangle that holds the text (not 1920×1080), cap slider extremes
  (e.g. `stainedGlass.size` minimum 15) and move pixel effects to a *Worker* with `OffscreenCanvas`, keeping a
  low-resolution preview while the user drags.

### CM-33 — Search ignored the last keys ✅

`searchOnLibrary` uses `Controller.wrap(…, 100, 1000)`. With the old throttle (`CDN-02`), keys typed within 1 s after a
search were dropped: typing "Horror" fast showed the result for a prefix ("Movie 000 Drama"…). Fixed together with the
`Controller` (the last call runs at the end of the window) and with a guard in `searchOnLibrary` for superseded searches
(`jellyfin_ui.js:258`).

### CM-34 — `tempLimit` received the `AbortSignal` ✅

`searchItems(Name, library, query, tempLimit)` is wrapped by the `Controller`, which appends the `AbortSignal` after the
arguments. Three-argument calls (like content-recommender's) got the signal in `tempLimit`, and
`items.slice(0, 0 + signal)` returned `[]`. Now only a positive number replaces the page size.

### CM-32 — Lint and edge cases 🧪 — ◐ (2026-10-23)

What was done: Skew X = Y = ±1 no longer makes the text vanish (only that case changes); `focusTabName`, the `return` in `finally` (which also restored parameters that were never saved) and `new Promise(async …)` fixed. Unused variables go to the dead code list.

- `app.js:1084` — `focusTabName` is an implicit global.
- `slots.js:324` — `return items` inside `finally` swallows exceptions from `getRandomImages`.
- `drawing.js:149` — `new Promise(async (resolve, reject) => …)`: errors outside the `try` do not reject the Promise.
- `skew` with Skew X = Skew Y = ±1 makes a singular transform matrix and the text disappears; cap it at ±0.95.
- 28 variables assigned and never used (e.g. `compositeRegistry.js:3926-3932` in Jigsaw, `:3993-4000`,
  `textEffects.js:3201`, `5448`, `5507`, `6564`) — dead computations or unfinished features; worth reviewing one by one.

---

## Recommended improvements

1. **Single source of state.** Remove `Setup.Settings`; `projectConfig` as the only source; the DOM derives from it.
   Today part of the UI reads from the DOM (`updateTextSettings`) and part from objects (`onEffectParamChange`), which
   caused CM-01/CM-17.
2. **Robust pipeline.** Normalize return values (`CM-03`), include in the hash everything that affects the output, move
   clones inside the steps, trim the cache. Consider `OffscreenCanvas` + *Worker* for the pixel effects (`sharpen`,
   `distress`, `crystallize`…), which would make the README's claim true.
3. **Automated tests.** The tests in this audit were done with Playwright + `python -m http.server`. A CI *smoke test*
   would cover: loading without console errors, every control changes the canvas, export works with and without text,
   persistence after a reload, and a registry test that runs each `apply` with 0, 1 and N images and checks that it
   returns `{ canvas }`.
4. **Security.** Token instead of password (`CM-05`), `textContent` (`CM-06`), and a CSP through `<meta http-equiv>`
   restricting `script-src` to `self` and `cdnjs.cloudflare.com`.
5. **Versioned persistence.** `{ schemaVersion, projectConfig }` with migrations (e.g. `innerShadow` parameters), slot
   images as Blobs in their own *store*, and an explicit save after each `projectConfig` change instead of relying on
   `pageMemory` watching the DOM.
6. **Vendor as a submodule** of `jeffersoncgo/cdn` (the workflow already checks out with `submodules: recursive`) so it
   does not drift from the fixes made there.
7. **Jellyfin performance.** Incremental sync by `DateLastSaved`, search limited to the name, a single IndexedDB
   connection, fixed-size thumbnails.
8. **Gallery validation in CI** (existing paths, valid JSON, ZIP containing `project.json`).
