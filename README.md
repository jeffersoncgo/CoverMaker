# Jellyfin Collection Poster Maker

![Jellyfin Compatible](https://img-shields.io/badge/Jellyfin-Compatible-blue?style=flat-square&logo=jellyfin)
![Tech](https://img-shields.io/badge/Tech-Vanilla%20JS%20%7C%20HTML5%20Canvas%20%7C%20IndexedDB-yellow?style=flat-square)
![State Management](httpss://img-shields.io/badge/State-Local%20Persistence-green?style=flat-square)
![License](https://img-shields.io/badge/License-MIT-purple?style=flat-square)

> A high-performance, client-side web application for designing and exporting composite collection posters. This tool features deep Jellyfin integration, an advanced `IndexedDB` caching engine, auto-detect Meilisearch acceleration, and a fully persistent state-aware UI.

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

This project is a powerful, browser-only tool for creating custom posters and banners for media collections. It allows users to combine multiple images (from local files or a Jellyfin server) into a single, beautifully rendered composite image.

It is designed for high performance and user convenience, featuring a robust, persistent state-management system that remembers every setting and image slot, and an intelligent caching layer that makes browsing even the largest Jellyfin libraries instantaneous after the first load.

### Main Use Cases
* Creating custom "Collection" posters for Jellyfin, Plex, or Emby.
* Generating summary banners for a series or movie franchise.
* Quickly assembling a grid of images with custom text and reflection effects.

---

## ✨ Features and Capabilities

### 🎨 Advanced Image Rendering
* **Dual Layout Modes:** Render images in a dynamic **Line** (single row/column) or **Grid** (automatic wrapping) layout.
* **Real-time Effects:** All rendering is done on an `OffscreenCanvas` for high-performance previews.
    * **Reflections:** Automatic, faded reflections with configurable distance and scale.
    * **Blur:** Apply a blur effect to reflections.
    * **Spacing:** Adjustable margin between images.
* **Dynamic Text Overlay:** Add custom text to your composite.
    * **Full Font Control:** Uses the Google Fonts API to dynamically load any font.
    * **Styling:** Control font size, color, opacity, style (italic), and weight (bold).
* **High-Resolution Export:** Export the final composite as a `PNG` file or open it in a new tab.

### 🔌 Deep Jellyfin Integration
* **Secure Authentication:** Standard authentication against your Jellyfin server.
* **Intelligent Caching:** Caches *entire libraries* (items, genres, tags, studios) to your browser's **IndexedDB**. This makes subsequent loads and searches instantaneous, with zero server load.
* **Dual-Mode Search:**
    * **Meilisearch Acceleration:** Automatically detects if your Jellyfin server has the Meilisearch plugin and uses it for blazing-fast, server-side searches.
    * **Client-Side Fallback:** If Meilisearch is not found, it falls back to its own powerful, built-in **client-side search engine** (`search.js`) that queries the `IndexedDB` cache.
* **Library Browsing:** Browse all libraries, search by name, or get random items.

### 💾 Persistent State & UI
* **"Set it and Forget it":** The application uses a custom `pageMemory.js` engine to automatically save *every* setting and UI state to `localStorage`.
* **Full Restoration:** Reloading the page restores:
    * All images in all slots (re-fetches from Jellyfin).
    * All text, font, color, and slider settings.
    * The current tab, pinned slots, and even the Jellyfin search query.
* **Drag & Drop:** Full drag-and-drop support for re-ordering slots and dragging posters from the Jellyfin panel.
* **Performance:** All heavy operations (rendering, searching) are wrapped in a custom `Controller.js` class, which uses `AbortController` to cancel stale requests (e.g., from rapid typing) and prevent race conditions.

---

## 🚀 Installation & Usage

This is a static, client-side application. No backend is required.

### 1. Running the App
* **Online:** The easiest way is to use the **[Live Demo](https://jeffersoncgo.github.io/CoverMaker/)**.
* **Locally:**
    1.  Clone the repository: `git clone https://github.com/jeffersoncgo/CoverMaker.git`
    2.  Open the `index.html` file in your browser.

**Important:** For Jellyfin integration to work, you **must run this from a local web server**. If you open `index.html` directly as a file, the browser's security policy (CORS) will block API requests to your Jellyfin server.

A simple local server:
```bash
# If you have Python
python -m http.server

# If you have Node.js
npx http-server