# Fix plan — CoverMaker, cdn and content-recommender

> Phased plan to fix the items in `docs/AUDIT.md` of the three repositories
> (`CM-xx` here, `CDN-xx` in `jeffersoncgo/cdn`, `CR-xx` in `jeffersoncgo/content-recommender`).
> Started on 2026-10-23. Each phase is checked off when done, with what changed along the way.

## Main rule (set by the user)

**Fix without losing any feature.** Adding is fine; removing or losing, never.

In practice:

1. **Nothing is deleted**: functions, buttons, layouts, effects, parameters, file formats and saved data keep existing.
   Dead code (see `CM-25`) only goes with an explicit ok.
2. **Old projects keep opening and rendering the same.** A change that alters the image of an existing project goes in
   as a **new option** whose default is the old behavior, or only after showing before/after and getting an ok.
3. **User content** (gallery, presets, saved settings) only changes with an ok.

## Safety net (Phase 0)

A phase is only done if it passes these three tests, compared with the 2026-10-23 reference:

| Test | What it checks | Reference (2026-10-23) |
|---|---|---|
| **Inventory** | Globals, class methods, HTML `id`s and *handlers*, CSS classes, layouts/effects and their parameters, gallery items, font list | cdn: 97 globals / 141 methods · CoverMaker: 325 / 149, 40 layouts, 16 image effects, 86 text effects, 11 gallery items, 1,899 fonts · content-recommender: 38 globals. **No removal allowed.** |
| **Visual reference** | Pixel signature of each layout (1, 2 and 6 images), image effect and text effect with default parameters, fixed inputs | 222 signatures, no errors. 12 of them change on every run because they use randomness (3 layouts: cctv, comicLayout, glitchMosaic; 7 text effects: glitch, ripple, paintBrush, crystallize, mosaic, glitterTexture, gummyCandy) and are left out of the comparison. **The others must stay identical**, except the ones a phase fixes on purpose (listed in the phase). |
| **Real flows (e2e)** | 42 flows in Chromium: slots, text layers and effects, layouts, image effects, formats, export image/project/setup/config, import, gallery, persistence, open in new tab | **33/42 pass.** The 9 that fail are exactly audit bugs: CM-02 (×2), CM-04 (×2), CM-11, CM-01, CM-12, CM-10, CM-09. **The 33 must keep passing**; each phase should turn some of the 9 green. |

The scripts started in the session's *scratchpad*; they are now in `tests/browser/` (decision D2).

## Phases

### Phase 0 — Safety net ✅ (2026-10-23)

- [x] Feature inventory of the three repositories.
- [x] Visual reference of every layout and effect.
- [x] e2e test of 42 flows; result recorded above.

### Phase 1 — Base libraries (`cdn`) and syncing `CoverMaker/js/vendor` ✅ (2026-10-23)

No visual change. Affects both apps (content-recommender loaded `cdn` straight from `main`).

- [x] `CDN-01/02` — `Controller`: per-run state (an old call resolves, the new one gets its own result) and a throttle
      that **runs the last call** instead of dropping it. Same API (`wrap`, `.Controller`, `startDelayMs`, events).
      Accepts `startDelayMs` as a synonym of `delayMs` in the options.
- [x] `CDN-03` — `pageMemory`: the right `AbortSignal` reaches `_savePageInfo`.
- [x] Bring into `cdn` the improvements that only existed in CoverMaker's copy (`canSave`, revoked Blob URL
      *fallback*) and make the delays and the event list configurable (CoverMaker uses 500 ms and does not listen to
      `click`), so the `vendor/` copy is identical to `cdn` without changing how either one behaves.
- [x] `CDN-09` — `CSS.escape` in selectors; `destroy()` without errors; `added-trigger` out of the saved attributes.
- [x] `CDN-04` — `mergeObjects` ignores `__proto__`/`constructor`/`prototype`.
- [x] `CDN-05` — `SearchEngine.sort` actually sorts.
- [x] `CDN-06` — `cleanObject` cleans without replacing the root object.
- [x] `CDN-11` — `Observer.RemoveCallBack` works; event names fixed (`contextmenu`, `resize`, `copy`, `cut`, `paste`).
- [x] `CDN-14`, `CDN-17` — `safeWindowsFileName` (normalizes before cleaning), `makeObjbyPath` returns the object,
      `GetValueFromPath` tolerates a missing path.
- [x] `CDN-12` — the demo page loads every section again.
- [x] Node unit tests for `controller`, `object`, `search`, `common` (the audit cases).
- Check: Node tests + `cdn` demo in Chromium + CoverMaker safety net with the synced `vendor/`.
- [x] Brought forward (found during the check): `CM-34`/`CR-14` — `tempLimit` received the `AbortSignal` and
      content-recommender had shown no recommendations since 2025-12-01. One-line fix in `jellyfin.js`.
- [x] Added to the safety net: a mock Jellyfin server (admin/regular login, 2 libraries, 55 items, images, optional
      Meilisearch) and flows using it for CoverMaker and content-recommender.
- Result: inventory with no removals (5 additions); 210/210 identical renders; e2e 33/42 with no regressions (the 9
  failing ones belong to Phase 2); 17 Node tests passing; `cdn` demo without errors; CoverMaker with the mock Jellyfin
  the same as the original and with search using the full text; content-recommender with the same recommendations (only
  the tie-break of items with the same rating now follows the community rating, as the code intended).

### Phase 1b — Components only used by the `cdn` demo ✅ (2026-10-23)

- [x] `CDN-10` TableSorter, `CDN-13` popup/treelist (text by default, HTML optional), `CDN-15` themeControl, `CDN-16`.

### Phase 2 — CoverMaker: functional bugs ✅ (2026-10-23)

No visual change in the cases that already worked.

- [x] `CM-15` (moved from Phase 3 and raised to High) — Jellyfin IndexedDB: single connection,
      `onblocked`/`onversionchange`, awaitable writes, a real timeout. Measured: first load stalled for 40 s+.
- [x] `CM-01` — image effect sliders update the project (end of the `Setup.Settings` alias).
- [x] `CM-02` — default text layer created on the first visit; the first session is saved.
- [x] `CM-03` — empty returns no longer freeze the canvas (0/1 image, Scanlines 0, Reflection 0).
      Visual: with 0 images the screen now shows the background + text (it used to freeze) — intended fix.
- [x] `CM-04` — export/open in new tab use the visible canvas (with or without text).
- [x] `CM-10` — compatible Export/Import Config (accepts the old and the new format).
- [x] `CM-11` — unique slot IDs (existing IDs kept for the restore).
- [x] `CM-12` — Jellyfin thumbnails back to 480×270 / 270×480.
- [x] `CM-13` — the exceptions in the list (full slots, random without items, "next" button, etc.).
- [x] `CM-14` — correct step cache (layout parameters in the hash, no reliance on the spread) without changing the output.
- [x] `CM-17` — `updateTextSettings` without the race (local array).
- [x] `CM-19` — ZIP import keeps empty trailing slots.
- [x] `CM-29` — Lightning with Seed 0 does not break (0 = random, as in the other effects).
- [x] `CM-30` — effect section titles show up; the `"undefined"` parameter is no longer saved (old projects that have it
      still open). The controls with no effect (`grout`, `bgColor`) change the image and were left for Phase 5.
- [x] Guard against a stale frame: an aborted `drawComposite` does not overwrite the canvas of a newer one.
- [x] `CM-09` (brought forward from Phase 5: it is only the file path) — "Series — Rough" ZIP link fixed; every path in
      `gallery.json` exists.
- [x] Found during the check (`cdn`): `pageMemory` identified images only by `type + size in bytes`; two different
      images with the same size were saved as the same one and a slot came back with another slot's image. The
      signature now includes the SHA-256 of the content (FNV-1a outside a secure context).
- Left for Phase 3: `jellyfin.js:127` (`throw` in `init()`, part of `CM-08`).

### Phase 3 — Security while keeping the features ✅ (2026-10-23)

- [x] `CM-05` / `CR-04` — store a token instead of the password; automatic login keeps working (decision D4).
      The user confirmed on 2026-10-23: "apagar o usuário e senha, e deixar só o token de acesso, pode fazer, contanto
      que tenha certeza que realmente funcione" ("deleting the username and password and keeping only the access token
      is fine, as long as you are sure it really works"). Username and password are no longer saved; the old password
      is used once and deleted. Added: a **Sign out** button (revokes the token on the server).
- [x] `CM-06` / `CR-03` — Jellyfin names and messages as text (same look for normal names).
- [x] `CM-08` — a failed login is not treated as success; Meilisearch falls back to the normal load.
- [x] Found during the check (`cdn`, `pageMemory`): the `canSave` lock started unlocked (a save between opening the
      database and finishing the restore would overwrite the saved state with the page defaults — login triggers a
      save right in that window); and a superseded save kept reading revoked images (`ERR_FILE_NOT_FOUND` in the
      console) and updated the "previous state" even when aborted.
- Check: mock Jellyfin server for login, libraries, Meilisearch unavailable and non-admin. The mock now validates the
  token like Jellyfin (`GET /Users/{id}` → 401 with an invalid token; `POST /Sessions/Logout` revokes the token).

### Phase 4 — content-recommender and Jellyfin data ✅ (2026-10-23)

- [x] `CR-01`/`CR-02` — `UserData` refreshed on every load (also with the library from the cache); normalized IDs for
      items coming from Meilisearch.
- [x] `CR-05` — dependencies copied into `content-recommender/js/vendor/` (option 1 in the audit, as CoverMaker
      already does with `cdn`).
- [x] `CR-08` infinite scroll with a lock and an empty batch that does not clear the page; `CR-09` recommended types
      (filtered when the lists are built — loading fewer types would make the two apps reload each other's shared
      cache); `CR-10` exceptions; `CR-11` Unicode tokenizer (same for ASCII), Fisher-Yates, `isPlayed`, account switch;
      `CR-12` portrait images 360×540.
- [x] `CM-16` — items edited on the server get into the cache (`MinDateLastSaved`), `UserData` with a `Map`,
      `PlayedPercentage`, escaped Meilisearch filter, Fisher-Yates.
- [ ] `CR-06` — **user decision**: only the fixes with no effect on the result went in. Fixing the taste profile
      operators (`between` → `..`, `all` → `any`) changes the recommendations; without a new scoring rule, the filter
      would have almost no effect. Proposal: implement it as an option, with the current one as the default, and the
      user compares on the real library.
- `CR-07` (the README cites actors/directors/studios that the scoring does not use) goes with the documentation in
  Phase 6.

### Phase 5 — Visual changes (old option kept) ✅ (2026-10-23)

- [x] `CM-07` — the old versions of `innerShadow`/`extrude` are back as extra effects (`innerShadowOffset`,
      `extrudeShaded`); the current ones render the same. **No automatic migration** of the "Batman" project: compared
      with the gallery's result image, the old version with the file's values came out ~1 % closer on average and a bit
      further on the very different pixels (inconclusive) → user decision (D6).
- [x] `CM-09` — done in Phase 2.
- [x] `CM-21` — Blur with `edges: Extend Edges` (default `Classic`, identical).
- [x] `CM-22` — `seed` on the random layouts/effects (0 = random, the default, as before).
- [x] `CM-23` — real Google Fonts faces (bold/light/italic) when the family has them; an option turns it off
      (off = as before). Changes how bold/italic text looks with those fonts — hence the option.
- [x] `CM-28` — Anime Speedlines shows the text; `Lines Only` = the old `Behind Text`, pixel for pixel. Before/after as
      an image.
- [x] `CM-30` (rest) — Stained Glass grout width as an option (identical default).
- [x] `CM-31` — with **identical output**: `stainedGlass` (spatial grid) and `longShadow` (reused canvas). Cropping
      `longShadow` to the text area changed pixels in 2 of 8 cases (up to 85/255) and was dropped.
- [x] `CM-32` — Skew ±1; `focusTabName`; `return` in `finally`; `new Promise(async …)`.

### Phase 6 — HTML, accessibility, documentation and tests ✅ (2026-10-23)

- [x] `CM-20` — balanced HTML without changing the DOM (compared with `DOMParser`: identical).
- [x] `CM-24` — windows: Pointer Events (touch), `z-index` in the right order, `window` parameter renamed.
- [x] `CM-27` (partly) — zoom, keyboard-accessible icons, toast styles, focus in windows.
- [x] `CR-13` — README, HTML comment, focus, confirmation on "Clean Saved Memory", cards with `role="link"`.
      The confirmation also went into CoverMaker (the button deletes the whole project).
- [x] `CM-26`, `CDN-18`, `CR-07` — READMEs: only fixes of what was not true.
- [x] `CDN-08` (optional `outerHTML`), `CDN-17` (rest) — `FetchQueue` with `res.ok` and a Promise, `base.js`.
- [x] `CM-25` — dead code list checked, **nothing removed** (D7).
- [x] Tests in the repositories: `cdn/tests` (23), `CoverMaker/tests/unit.test.js` (8) and `content-recommender/tests`
      (5) in CI — in cdn and CoverMaker the deploy only runs if they pass; `CoverMaker/tests/browser/` with the
      Playwright suite and the mock Jellyfin.

### Release ✅ (2026-10-23)

- Merged into `main` (with its own merge commit, so everything can be reverted at once if needed), in the order
  content-recommender → CoverMaker → cdn: content-recommender switched to its own copies first, so there was no window
  where it loaded new libraries with old code.
- Deploys checked: the 5 jobs (`static.yml` of CoverMaker and cdn, "pages build and deployment" of the three)
  succeeded; CI tests green in the three; new files served ~40 s after the push; quick test on the published sites
  without errors (only the refused connection to the default Jellyfin `localhost:8096`, expected).
- **Note:** in CoverMaker and cdn every push triggers **two** deploys — `static.yml` and GitHub Pages' automatic
  "pages build and deployment" (it was already like this). The test job only holds back the first one. For the tests
  to really block a release, set *Settings → Pages → Build and deployment → Source* to **GitHub Actions** only
  (decision D8).
- 2026-10-24: the user tested the published apps against their real Jellyfin server and found no bugs.

## Decisions (answered on 2026-10-23)

| ID | Question | Decision |
|---|---|---|
| D1 | Go on without pauses? | **Yes, all phases** ("pode corrigir tudo que precisar, alterar o que for preciso" — "fix whatever is needed, change whatever has to change"). Visual changes keep the old option available, as the work protocol says. |
| D2 | Version the tests in `tests/`? | Not answered directly; the default **yes** was adopted (it is only an addition, and the tests would be lost with the container). |
| D3 | How to release? | **Merge into `main` done by me**, no PR. After the merge, check the GitHub Pages deploy and the live files. |
| D4 | Saved password → token? | **Yes.** The password is the Jellyfin account password typed in the login window; the app uses it one last time to get the token and then deletes it from the browser. |
| D5 | content-recommender taste profile (`CR-06`) | **Pending.** Today only the minimum rating filters (the genre, tag and year filters have no effect). Recommendation: add a new mode as an option, keeping the current one as the default, to compare on the real library. |
| D6 | "Batman" gallery project (`CM-07`) | **Pending.** Use the restored "Inner Shadow (Offset)" effect with the file's original values (`offsetX 9`, `offsetY -1`)? Inconclusive measurement (~1 %). Recommendation: keep it as it is; the old effect is available to anyone who wants it. |
| D7 | Dead code (`CM-25`) | **Pending.** List checked in the audit (`factory.js`, `vendor/search.js` in CoverMaker, `pipelineManager`, `libraryImagetoCanvas`, debug helpers, `isLibrarySizeChanged`, dead block in content-recommender, unused variables). Recommendation: remove `factory.js`, `pipelineManager`/`PipelineStep` and `libraryImagetoCanvas`; keep the debug helpers. |
| D8 | Double deploy in CoverMaker and cdn | **Pending (GitHub setting, only the user can change it).** Recommendation: Pages with the "GitHub Actions" source, so the test blocks broken releases. |

## Checklist "I changed X, I also touch Y"

| Changed | Also need to |
|---|---|
| `cdn/js/*.js` | Copy to `CoverMaker/js/vendor/` and `content-recommender/js/vendor/` (same content), run `node --test "tests/*.test.js"` in the three repositories (content-recommender's checks the copies when they sit side by side) and test both apps |
| `CoverMaker/js/jellyfin.js` or `windowsHandle.js` | Copy to `content-recommender/js/vendor/` (same content) and test content-recommender |
| `cdn/js/*.js` used by content-recommender | Copy to `content-recommender/js/vendor/` as well |
| Parameters in `compositeRegistry.js`, `effectsRegistry.js` or `textEffects.js` | Regenerate `docs/EFFECTS-REFERENCE.md` and open the gallery projects |
| `projectConfig` or ZIP format | Keep reading the old format; update `docs/ARCHITECTURE.md` §7 |
| `fonts/google-fonts.json` (Google Fonts list) | Regenerate `fonts/google-fonts-variants.json` from `https://fonts.google.com/metadata/fonts` |
| `localStorage`/IndexedDB keys | Remember that the three apps share the `jeffersoncgo.github.io` origin |
| Any doc in `docs/` | The docs are in English since 2026-10-24; keep them in English |

## Reference measurements (2026-10-23, headless Chromium)

- e2e: 33/42 flows passing.
- Visual reference: 222 signatures, 0 errors, 12 non-deterministic.
- `longShadow` with the default layer parameters: 2.9 s per run; total of the 86 text effects (default): ~18 s.
- `pageMemory`: ~340 KB written per save.

### After Phase 2 (2026-10-23)

- e2e: **41/42** (0 regressions, 8 fixed; the remaining one, the "Series — Rough" gallery, passes with `CM-09`, added
  after the round).
- Visual reference: 210/210 identical (12 random ones left out).
- Full pipeline (layout + image effects + text, through `drawComposite`): 5 scenarios with pixels identical to the
  original; changing a parameter and changing it back gives exactly the same image; with the layout off, the background
  and the text show up (the screen used to freeze); fast edits end on the last state.
- Mock Jellyfin, first visit: libraries in **7 s** (previous version: 30 s, because of `CM-15`). Without the default
  text layer it would be 4 s: ~3 s are spent drawing the default layer (`longShadow`), which used to appear only from
  the second visit on. See `CM-31`.
- Inventory: 0 removals, 18 additions.

### After Phase 3 (2026-10-23)

- Login (CoverMaker, 10 scenarios): migration from the old app **on the same origin** (the old one writes the password
  to `localStorage` and to `pageMemory`; the new one logs in with it once and afterwards neither copy exists); reload
  with the token only (0 password logins on the server); revoked token → login window; wrong password; account switch;
  Sign out (the token gets 401 on the server); a regular user with Meilisearch loads the 2 libraries; server offline
  without an unhandled error. **10/10.**
- content-recommender: migration, reload with the token only (same recommendations: 19 played, 36 not played, 6 by
  taste, 3 groups × 6), cards with a malicious name shown as text, Sign out and login through the form. **6/6.**
- e2e: **42/42** (the "Series — Rough" gallery passes: the test now watches the toast during the wait; on the original
  it also failed because it only looked after the toast was gone).

### After Phase 4 (2026-10-23)

- Phase checks: **8/8** — an item edited on the server shows up with the library from the cache (on reload only 4
  item requests: 2 counts + 2 edited-item queries, instead of downloading everything) and stays in the cache; an item
  played after the first visit now counts as played (19 → 20); 10 scroll events in a row load 1 batch (3 groups);
  tokenizer the same as the old one for ASCII titles; collections/playlists out of the recommendations; uniform
  Fisher-Yates (20,000 draws, deviation < 7.5 %).
- content-recommender: same recommendations as Phase 3 (identical list and ratings). Login 6/6; CoverMaker login 10/10.

### After Phase 5 (2026-10-23)

- Visual reference: 209 identical + 1 changed on purpose (`actionSpeedlines`, the text shows up); 2 new effects.
  `crystallize` stopped being random with the default seed (1), as the parameter promised.
- Full pipeline: the 5 scenarios with the same pixels as Phase 2.
- `stainedGlass`: 6/6 combinations with identical output; Shard Size 5 **34.7 s → 0.17 s**; default 1.5 s → 0.1 s.
- `longShadow`: 6/6 identical; app default layer 1.9 s → 1.6 s; maximum 4.9 s → 3.9 s.
- Fonts: Roboto `bold` uses the real 700 face; Open Sans `lighter` the 300 one; Bangers (400 only) with no extra
  request and identical; no HTTP errors from Google Fonts.
- Lint: 61 → 53 findings (removals only).

### After Phase 6 (2026-10-23)

- `pageMemory`: CoverMaker's record from **383 KB to 7 KB**; save from 10 ms to 2 ms (without `outerHTML`).
- HTML: DOM identical to before (compared with `DOMParser`), now with balanced tags.
- Tests in the repositories: cdn 23/23 (3 of them fail on the previous code: `FetchQueue`, `saveDom`, mouse),
  CoverMaker 8/8 (on the original code the gallery link and the duplicate effects fail), content-recommender 5/5.

## Progress log

| Date | Phase | Result |
|---|---|---|
| 2026-10-23 | 0 | Safety net built; reference recorded above. |
| 2026-10-23 | 1 | Done (except 1b). Changes along the way: CM-34/CR-14 brought forward; CM-15 raised to High and moved to Phase 2; mock Jellyfin added to the safety net. |
| 2026-10-23 | 1b | Done: TableSorter, popup/treelist, themeControl checked in Chromium. |
| 2026-10-23 | 2 | Done. CM-09 brought forward; the image signature clash in `pageMemory` found and fixed. Measurements above. Note: the container's proxy port changed mid-round (external images failed); the tests now read `HTTPS_PROXY`. |
| 2026-10-23 | 3 | Done. Extra findings in `pageMemory` (`canSave` lock, superseded save). e2e test: the gallery toast is watched during the wait, and "Failed to fetch" (no Jellyfin at `localhost:8096`) is treated as a known error, like "Fetch error: undefined" already was. |
| 2026-10-23 | 4 | Done, except `CR-06` (user decision). Note: a mock went down mid-test because of a `cd` that applied only to the first command; the scenario was redone with the mock up. |
| 2026-10-23 | 5 | Done. Pending decision: D6 (Batman). The work process was restarted mid-phase (the test servers went down and were reopened). One e2e run gave 41/42 (export on open) while lint ran in parallel: both versions settle the canvas before the test's 9 s; the font variants map is now fetched in parallel on load, and the e2e, run alone, gave 42/42. |
| 2026-10-23 | 6 | Done. Pending decisions: D5 (taste profile), D6 (Batman), D7 (dead code). |
| 2026-10-23 | Merge | Three repositories on `main`, deploys checked (see "Release"). |
| 2026-10-24 | Docs | The pt-BR docs of the three repositories translated into English, with English file names (`AUDIT.md`, `FIX-PLAN.md`, `ARCHITECTURE.md`, `EFFECTS-REFERENCE.md`, `DOCUMENTATION.md`). The user tested the apps on the real server: no bugs. |
