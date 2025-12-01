# Contributing to CoverMaker

Thanks for your interest! We love seeing the community grow. Whether you are a developer fixing bugs or a designer sharing a cool layout, your help is welcome.

**Note:** These guidelines are here to help us coordinate, not to act as strict rules. **Nothing here is mandatory**—just do your best!

### 🐛 1. Reporting Issues & Ideas
Found a bug or have a suggestion?
* Check if someone else has already reported it to avoid duplicates.
* Open an issue with a clear title and description.
* If reporting a bug, details like your browser version and steps to reproduce are super helpful.

### 🎨 2. Sharing Designs (Gallery & Presets)
If you want to contribute a layout to the **Community Gallery** or submit a design for future **Presets**, we need your project file.

* **What to send:** The `.project.zip` file.
    * *Note:* This is the file generated **by the app** when you click "Export Project". It contains your layers and settings. It is **not** a development/source code file.
* **How to send:** Create a new Issue and attach the `.project.zip` file (or a download link).
* **Visuals:** A screenshot of the final result helps us preview your submission quickly.

*(You only need to send this file if you are sharing a design. Code contributors can ignore this step!)*

### 🖼 Updating the Gallery (Gallery Items & Presets)

The community gallery is driven by `gallery/gallery.json`. Each entry can be either:
- **Project** — if the item includes a `project` key (zip) in the JSON. This is a full project ZIP that can be imported by the app and may include images.
- **Preset** — if the item doesn't include a `project` key; usually only a `setup` (project.json) is provided with settings and no assets.

To add or update an item in the gallery (guide):
1. Add a folder under `gallery/projects/<id>` for convenience (optional, but recommended).
2. Add your `project.json` (extracted or exported) as `gallery/projects/<id>/project.json`.
3. (Optional) Add the full `*.project.zip` file as `gallery/projects/<id>/<id>.project.zip` if it's a full project.
4. Add or update the item in `gallery/gallery.json` with:
    - `id` (slug), `title`, `shortDescription`, `image` (thumbnail path), `author`, `page` (optional), `setup` (path to  `project.json`), and optionally `project` (path to ZIP).
5. Open a Pull Request with your changes, or open an Issue with the `zip` attached if you prefer.

Notes:
- When `project` exists in the JSON item, it will be treated as a "Project" in the app; otherwise it will be treated as a "Preset".
- Our automation will regenerate `GALLERY.md` automatically when gallery files are updated (PR or push to gallery files), so there's no need to edit that manually.

### 💻 3. Submitting Code
If you want to get your hands dirty with the source code:
* Fork the repo and create a branch.
* Modern ES6+ syntax is preferred (keep it clean and modular).
* Open a Pull Request (PR) describing what you changed.
* Don't worry about perfection—we can discuss the details in the PR review!

### ⚖️ 4. License
By contributing, you agree that your code or design submissions are licensed under the repository's MIT license.

***
