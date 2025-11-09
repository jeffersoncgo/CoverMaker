# Jellyfin Collection Poster Maker

![Jellyfin](https://img.shields.io/badge/Jellyfin-Compatible-blue?style=flat-square&logo=jellyfin)
![Meilisearch](https://img.shields.io/badge/Meilisearch-Ready-red?style=flat-square&logo=meilisearch)
![Tech](https://img.shields.io/badge/Tech-Vanilla%20JS-yellow?style=flat-square&logo=javascript)
![Cache](https://img.shields.io/badge/Cache-IndexedDB-blueviolet?style=flat-square)
![State](https://img.shields.io/badge/State-LocalStorage-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)

A high-performance, client-side web application for designing and exporting composite collection posters. This tool features deep Jellyfin integration, an advanced `IndexedDB` caching engine, auto-detect Meilisearch acceleration, and a fully persistent state-aware UI.

**Live Demo: [https://jeffersoncgo.github.io/CoverMaker/](https://jeffersoncgo.github.io/CoverMaker/)**

---

## 📸 Examples

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

---

## 🧩 Overview

This isn't just a simple image editor. It's a high-performance design tool built specifically for media collectors. It bridges the gap between your Jellyfin library and a powerful, local `HTML5 Canvas` rendering engine.

It allows you to build beautiful, composite posters for your collections by pulling media posters directly from your server. It's built on a 100% client-side, vanilla JavaScript architecture, meaning it's fast, portable, and requires no backend server.

The application is built on three core philosophies:

1.  **Performance First:** From `IndexedDB` caching to `OffscreenCanvas` rendering and `AbortController`-based async management, every piece is designed to be fast and responsive.
2.  **A "Smarter" UI:** The app saves *everything*. Using a custom persistence engine (`pagememory.js`), your entire workspace—every slot, setting, and search query—is saved to `localStorage` and restored instantly on reload.
3.  **Total Creative Control:** The app provides a powerful set of tools to customize layouts, fonts, and effects, giving you full control over the final product.

---

## ✨ Features: At a Glance

* **Advanced Canvas Renderer:** Renders all effects in real-time on an `OffscreenCanvas` for a lag-free experience.
* **Dual Layout Engine:** Automatically arranges images in a perfect **Line** or **Grid** layout.
* **Dynamic Typography:** Integrates with the **Google Fonts API** to let you use hundreds of custom fonts.
* **Real-time Effects:** Apply non-destructive reflections, blurs, and spacing.
* **Full Jellyfin Integration:** Authenticate, browse all libraries, and pull posters.
* **Intelligent Caching:** Caches your *entire* Jellyfin libraries (metadata, tags, studios) to your browser's **`IndexedDB`**, making subsequent sessions and searches instantaneous.
* **Auto-Detect Meilisearch:** If you have the Meilisearch plugin on your Jellyfin server, the app will **automatically detect and use it** for blazing-fast, server-side searches.
* **Client-Side Search Fallback:** If Meilisearch isn't found, it seamlessly falls back to its own powerful, built-in `search.js` engine that queries the local `IndexedDB` cache.
* **Total Persistence Engine:** *Every* setting, slider position, text input, and image slot is saved to `localStorage` and restored when you reload the page.
* **Robust Async Management:** Uses a custom `Controller.js` class with `AbortController` to cancel stale requests, preventing UI lag and race conditions during rapid searching or rendering.
* **Full Drag & Drop:** Re-order slots or drag posters from the Jellyfin panel onto the exact slot you want.
* **Multi-Input:** Add images by clicking, dragging, **pasting from your clipboard**, or **uploading local files**.

---

## 🎨 Feature Deep Dive: The Cover Maker Engine

This app's core is a powerful canvas rendering engine (`script.js`) built to give you maximum creative control.

### Dual Layout Engine
You can instantly switch between two layout modes:

* **Line Mode:** This mode arranges all images in a single horizontal (for cover format) or vertical (for poster format) line. The engine automatically calculates the width/height of each slot based on the total number of slots, ensuring they fit perfectly within the canvas.
* **Grid Mode:** This mode intelligently wraps your images into a grid. It automatically calculates the optimal number of rows and columns to create the most aesthetically pleasing, space-filling grid, no matter if you have 3, 5, or 20 images.

### Advanced Rendering & Effects
All rendering happens on an `OffscreenCanvas` first, so the UI never stutters while you adjust settings.

* **Reflections:** Creates a beautiful, faded reflection for each image. This is achieved by drawing the image, flipping the canvas context (`scale(1, -1)`), drawing it again, and applying a `createLinearGradient` overlay to fade it out.
* **Reflection Blur:** You can apply a blur effect *only* to the reflected image, giving it a realistic, diffused look.
* **Spacing & Scale:** Full control over the margin between images and the base scale of the posters for dramatic, zoomed-in effects.

### Dynamic Text & Typography
The text overlay is a first-class citizen.
* **Google Fonts API:** The app dynamically fetches a list of popular fonts from the Google Fonts API (`fonts.json`) and loads them on-demand as you select them.
* **Full Styling:** You have complete control over the font's **family**, **size**, **weight** (bold), **style** (italic), **color**, and **opacity**.

### Flexible Image Slots
Your workspace is built on "slots," which are more than just images.
* **Pinning:** Pinned slots are protected from being cleared or randomized.
* **Randomize:** Get a new random image from your library for a specific slot or fill all un-pinned slots at once.
* **Drag & Drop:** Every slot is a draggable target, allowing you to re-order your layout instantly.

---

## 🔌 Feature Deep Dive: Jellyfin Integration

The `jellyfin.js` class turns this app from a simple editor into a true Jellyfin companion.

### The Caching Engine
This is the app's secret weapon. The first time you log in, the app fetches and saves your *entire library's metadata* (items, tags, genres, studios) into your browser's `IndexedDB`.
* **Why?** This makes all future sessions and searches **instantaneous**. You can browse a 10,000-item library with zero network lag because you are searching a local database.
* It's smart, too. It compares item counts on load, so if you've added new media, it knows to re-fetch only what's necessary.

### Dual-Mode Search: Meilisearch + Client-Side
The app features two powerful search engines and picks the best one automatically.
1.  **Mode 1: Meilisearch (Server-Side)**
    * On login, the app pings your server to see if the Meilisearch plugin is installed and configured.
    * If **YES**, all search-bar queries are sent to your server's Meilisearch instance (`loadLibraryItemsMeiliSearch`), giving you the fastest possible server-side search.
2.  **Mode 2: Client-Side Fallback (`search.js`)**
    * If Meilisearch is **NOT** found, the app seamlessly falls back to its built-in search engine.
    * This powerful `search.js` class performs complex, scored searches *directly against the local `IndexedDB` cache*. It's so fast, you won't even notice it's not a server.

---

## 💾 Feature Deep Dive: The "Smart" UI

### Automatic Session Persistence
The `pagememory.js` engine ensures you **never lose your work**.
* It finds *every* HTML element with a `[save]` attribute (sliders, inputs, checkboxes, color pickers, etc.).
* It uses an `Observer` to watch for *any* change to those elements.
* The moment you change a setting, it's instantly saved to `localStorage`.
* When you reload the app, it reads from `localStorage` and restores *every single setting* to exactly how you left it. This includes all your image slots, your chosen font, and even the text in the search bar.

### High-Performance Async Control
Rapid inputs (like typing or dragging a slider) can create "storms" of events, lagging the UI. This app solves that with `controller.js`.
* Instead of a simple `debounce`, this class wraps async functions (like rendering and searching).
* When you trigger an event, it starts a small delay. If you trigger it again before the delay finishes, it **aborts the previous, unfinished request** using `AbortController.abort()`.
* This ensures that only the *last* intended action is ever executed, keeping the UI perfectly smooth and responsive.

---

## 🚀 Installation & Usage

This is a static, client-side application. No backend is required.

### 1. Running the App
* **Online:** The easiest way is to use the **[Live Demo](https://jeffersoncgo.github.io/CoverMaker/)**.
* **Locally:**
    1.  Clone the repository: `git clone https://github.com/jeffersoncgo/CoverMaker.git`
    2.  Open the `index.html` file in your browser.

**⚠️ IMPORTANT: CORS POLICY**
For Jellyfin integration to work, you **must run this from a local web server**. If you open `index.html` directly as a file (`file:///...`), the browser's security policy (CORS) will block API requests to your Jellyfin server.

A simple local server:
```bash
# If you have Python
python -m http.server

# If you have Node.js
npx http-server