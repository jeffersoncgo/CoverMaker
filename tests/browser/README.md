# Browser tests (Playwright)

Safety net used for the 2026-10-23 fixes (see `docs/FIX-PLAN.md`). They do not run in CI — they need Chromium and
local servers. The tests that need no browser are in `../unit.test.js` and run in CI.

## Setup

```bash
npm install playwright            # or point PLAYWRIGHT_MODULE to an existing install
npx playwright install chromium
# servers (each one from the repository folder)
python3 -m http.server 8765 --bind 127.0.0.1          # CoverMaker
python3 -m http.server 8768 --bind 127.0.0.1          # content-recommender (for cr_auth.js and fixes_phase4.js)
python3 -I tests/browser/mock_jellyfin.py 8769          # mock Jellyfin (admin/secret, guest/guest)
python3 -I tests/browser/mock_jellyfin.py 8772 --meili  # the same with the Meilisearch plugin
```

`PLAYWRIGHT_MODULE` (optional) = path to the `playwright` module. `HTTPS_PROXY` (optional) = proxy for external
requests (Google Fonts, sample images); `127.0.0.1` never goes through the proxy.

## Tests

| File | What it checks | How to run |
|---|---|---|
| `e2e.js` | 42 usage flows (slots, text, layouts, effects, formats, export/import, gallery, persistence) | `node e2e.js out.json http://127.0.0.1:8765/` · compare: `node compare.js e2e out.json other.json` |
| `render_baseline.js` | Pixel signature of each layout (1, 2 and 6 images), image effect and text effect | `node render_baseline.js out.json http://127.0.0.1:8765/index.html` · `node compare.js render out.json render-reference.json` |
| `pipeline.js` | Full pipeline through `drawComposite`, cache (change and change back gives the same pixels), fast edits, `Composites.Merged` | `node pipeline.js out.json http://127.0.0.1:8765/` |
| `auth_flow.js` | Login: migration from the old password to a token, reload with the token only, revoked token, wrong password, account switch, Sign out, Meilisearch with a regular user, server offline | `node auth_flow.js <CoverMaker folder> <folder of an old CoverMaker version>` |
| `jellyfin_flow.js` | Libraries, search, poster → slot, next page, thumbnail size | `NO_GC=1 node jellyfin_flow.js http://127.0.0.1:8765/ label` |
| `fixes_phase2.js` | Slot IDs after a reload, text race, Seed 0, section titles, ZIP with empty slots | `node fixes_phase2.js http://127.0.0.1:8765/` |
| `fixes_phase4.js` | Items edited on the server with the library cached, "played" refreshed, batched scroll, tokenizer, types | `node fixes_phase4.js` (restart the mock first) |
| `cr_auth.js` | content-recommender: migration to a token, reload, cards as text, Sign out, login | `node cr_auth.js <cdn folder> <CoverMaker folder>` |

`render-reference.json` is the 2026-10-23 visual reference (after the fixes). Items marked as non-deterministic
(random) are left out of the comparison.
