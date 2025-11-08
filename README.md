
# Collection Cover Maker 📚🎨

An easy-to-use, client-side web app to create composite collection covers (banners/posters) from image slots and Jellyfin library covers. It supports drag & drop, local images, Jellyfin integration (with optional Meilisearch acceleration), configurable layout (line/grid), overlay text, reflections, blur, and export to PNG.

Live demo: https://jeffersoncgo.github.io/CoverMaker/

---

## 📖 Overview

Collection Cover Maker is a small client-side tool (HTML/CSS/JS) that helps you build attractive collection covers by combining multiple cover images into a single composite image. It's designed to integrate with a Jellyfin server to fetch covers from your libraries, but you can also use local images or drag covers between slots.

Key design goals:
- Fast, browser-only interface (no server required)
- Flexible layouts (line/grid)
- Export composite as a high-quality PNG
- Optional Jellyfin + Meilisearch integration for fast searches

---

## ✨ Features

- Create composite images from a set of image slots
- Line and grid layout modes with automatic layout calculation
- Banner and poster aspect ratio presets
- Overlay text with font, size, color, opacity, and bold options
- Reflection and blur effects per slot
- Drag & drop between covers and slots
- Load covers from a Jellyfin server (requires Jellyfin credentials)
- Optional Meilisearch plugin support for faster library queries
- Local file upload and paste-from-clipboard support
- Save/load some settings to localStorage and IndexedDB caching for libraries
- Export composite image as PNG and open in new tab

---

## 🚀 Installation

This project is static and runs in the browser. To use it locally:

1. Clone the repository:

	 git clone https://github.com/jeffersoncgo/CoverMaker.git

2. Open `index.html` in your browser (double-click or serve with a static server).

Optional: use a small local server for best cross-origin behaviour (recommended when testing remote Jellyfin images):

	 - Python 3: `python -m http.server 8000`
	 - Node (http-server): `npx http-server -p 8000`

Then open http://localhost:8000 in your browser.

---

## 🛠️ Usage

Open the app and follow these steps:

1. Add image slots using the + button or paste images from clipboard.
2. Use the right-hand Jellyfin panel to load libraries (login required).
3. Click a cover to add it to a slot, or drag a cover onto a slot.
4. Use the top/bottom slot controls to pin, randomize, move up/down, clear or delete slots.
5. Adjust Settings (Format, Type, Overlay text, Font, Size, Colors, Spacing, Blur, Reflection, Scale).
6. Click Export Composite Image to download a PNG or Open Composite in New Tab to preview.

Jellyfin login:
- Click "Login to Jellyfin" in the header to open the login window.
- Provide server URL, username and password. The app will authenticate and load your libraries.
- If the Meilisearch plugin is available on the server, the app will attempt to use it for faster queries.

Notes:
- When using remote images, CORS policies may affect canvas export. Running a local server helps avoid CORS issues.

---

## 📦 Technologies

- HTML, CSS, JavaScript (vanilla)
- Uses browser APIs: Canvas (2D), OffscreenCanvas, IndexedDB
- Optional integration with Jellyfin (REST API) and Meilisearch (via included vendor script)
- Icons: Font Awesome (CDN)

---

## 🔧 Configuration

Settings are exposed in the UI (Settings tab) and persisted to localStorage where applicable:

- Server (Jellyfin) URL — required when connecting to Jellyfin
- Username / Password — Jellyfin credentials (used only to authenticate to the server)
- Format: Banner or Poster (affects aspect ratio)
- Type: Line or Grid (layout algorithm)
- Overlay Text: text shown over the composite
- Font, Font Size, Font Color, Bold, Font Opacity
- Margin/Spacing, Blur Size, Reflection Distance, Reflection Scale, Poster scale
- Covers Limit: controls how many items are fetched per page from Jellyfin

Optional Meilisearch plugin (on Jellyfin server): if installed, the app auto-detects it and uses it to speed up item queries.

Security note: credentials are sent from the browser to the Jellyfin server to authenticate; the app does not ship a backend — use HTTPS when possible.

---

## ✅ Requirements

- Any modern browser with Canvas and IndexedDB support
- For Jellyfin integration: a reachable Jellyfin server and valid credentials
- Optional: Meilisearch plugin on the Jellyfin server for faster indexing/search

---

## 🤝 Contributing

Contributions are welcome. Keep changes small and focused. Suggested workflow:

1. Fork the repository
2. Create a feature branch
3. Add tests or manual verification steps when applicable
4. Open a pull request describing changes

Please follow the existing code style (vanilla JS, minimal dependencies) and ensure any new features degrade gracefully when not available (e.g., Meilisearch missing).

---

## 📄 Documentation

This repository is primarily self-documented in the source files:

- `index.html` — main UI and templates
- `js/script.js` — application glue, UI handlers, canvas drawing, export functions
- `js/jellyfin.js` — Jellyfin integration and caching logic (IndexedDB)
- `js/windowsHandle.js` — floating window drag/close helpers
- `css/style.css` — styles and layout

For quick troubleshooting:
- If canvas export fails with tainted canvas errors, run the app from a static server to avoid CORS issues.
- Check browser console for network/auth errors when connecting to Jellyfin.

---

## ❤️ Acknowledgements

- Author / Maintainer: jeffersoncgo (repository owner)
- Meilisearch plugin for Jellyfin: https://github.com/arnesacnussem/jellyfin-plugin-meilisearch
- Font Awesome for icons

---

## 📝 Changelog (recent)

This project keeps a change history in `CHANGELOG.md`. Recent highlights:

- 2025-11-07 — Revamp README with improved structure and details
- 2025-11-07 — Add error handling and dynamic image loading for covers
- 2025-11-05 — Refactor library loading and MeiliSearch integration
- 2025-11-04 — Add check for Meilisearch library before setup
- 2025-11-04 — Integrate Meilisearch for faster library queries

Full changelog is available in the `CHANGELOG.md` file.

---

## 🗂️ Repository Structure

```
CoverMaker/
├─ index.html                # Main UI and templates (entry point)
├─ README.md                 # This file (generated)
├─ CHANGELOG.md              # Commit-based changelog
├─ .gitignore                # Files to ignore (images/Thumbs.db, .vscode/)
├─ css/
│  └─ style.css              # All UI styles and layout variables
├─ images/
│  ├─ loading.gif            # Loading placeholder used when fetching images
│  └─ error.png              # Error placeholder for broken images
└─ js/
	 ├─ jellyfin.js            # Jellyfin client: authentication, library loading, caching, Meilisearch support
	 ├─ script.js              # App logic: slots management, canvas drawing, export functions
	 ├─ windowsHandle.js       # Floating window helpers (drag/close)
	 └─ vendor/
			└─ meilisearch_index.min.js  # Vendor Meilisearch client used when available
```

File purposes (short):
- `index.html` — Contains templates for slots, banners and covers, header, settings UI and script includes.
- `css/style.css` — Theme, layout, responsive controls and styling for slots & Jellyfin panel.
- `js/jellyfin.js` — Core integration with Jellyfin server: authentication, library enumeration, item fetching (vanilla & Meilisearch), and caching using IndexedDB.
- `js/script.js` — Slot manipulation, image loading, composite drawing (line/grid algorithms), export functions, and UI wiring.
- `js/windowsHandle.js` — Simple helper to make floating windows draggable and closable.
- `images/` — UI placeholders used by the app.

Note: `.gitignore` excludes `.vscode/` and `images/Thumbs.db` (ignored files are not listed above).

---

## 🔗 Flow Chart (mermaid)

```mermaid
flowchart TD
	A[index.html UI] --> B[script.js]
	B --> C[Canvas (composite image)]
	B --> D[Slot UI (add/delete/pin/randomize)]
	B --> E[Jellyfin integration]
	E --> F[jellyfin.js (auth, libraries, items)]
	F --> G[IndexedDB cache]
	F --> H[Meilisearch (optional)]
	C --> I[Export PNG / Open in new Tab]
	style A fill:#f9f,stroke:#333,stroke-width:1px
	style C fill:#bbf,stroke:#333
```

---

## Examples
<details>
	<summary>Spoiler: Page</summary>

![Image](https://github.com/user-attachments/assets/d9cbfda8-403d-4385-b1cf-a6eaeb75e6ad)

![Image](https://github.com/user-attachments/assets/02d1f44c-b973-42ec-b631-17700b362a03)

![Image](https://github.com/user-attachments/assets/6a2ead2d-6032-4108-91a1-aae16c9047e9)

</details>
<details>
	<summary>Spoiler: Covers Examples</summary>

![Image](https://github.com/user-attachments/assets/fba14f46-1721-48da-9f82-aef3d2b44d00)

![Image](https://github.com/user-attachments/assets/ce97f054-c9a6-4a8c-86f3-c7b283ef111b)

![Image](https://github.com/user-attachments/assets/d0191257-11bb-4a60-a682-d29ddcbd2aa1)

![Image](https://github.com/user-attachments/assets/108898cc-6720-4ad4-a04c-902c483b13bc)

![Image](https://github.com/user-attachments/assets/dba48f0d-cebe-4ac5-849f-c6923c2836c5)

</details>
