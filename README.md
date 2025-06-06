# 🚀 README AI - CoverMaker

This repository contains the source code for **CoverMaker**, a client-side web application designed for creating custom image composites, primarily for use with media servers like Jellyfin. It allows users to load multiple images into customizable slots, apply various visual effects such as scaling, spacing, reflection, and blur, add text overlays, and finally export the result as a PNG file. The application integrates directly with a user's Jellyfin server, enabling easy browsing, searching, and importing of library covers and banners directly into the composition slots, alongside support for local file uploads and image pasting.

CoverMaker solves the problem of needing custom cover art or banners for media server content, offering a flexible visual editor within the browser. It provides a user-friendly interface for composing images without requiring complex external image editing software, streamlining the process of generating personalized media visuals.

## 📚 Table of Contents

*   [🚀 Introduction](#-introduction)
*   [✨ Features](#-features)
*   [⚙️ Installation / Setup](#️-installation--setup)
*   [📁 Project Structure](#-project-structure)
*   [📖 Detailed Usage / API Documentation](#-detailed-usage--api-documentation)
    *   [📄 File: js/script.js - Core Application Logic](#-file-jsscriptjs---core-application-logic)
    *   [📄 File: js/jellyfin.js - Jellyfin API Client](#-file-jsjellyfinjs---jellyfin-api-client)
    *   [📄 File: js/windowsHandle.js - Floating Windows](#-file-jswindowshandlejs---floating-windows)
*   [🔧 Configuration](#-configuration)
*   [🏃 Scripts / Commands](#-scripts--commands)
*   [🛡️ Security & Safety Highlights](#️-security--safety-highlights)
*   [⚠️ Limitations and Edge Cases](#️-limitations-and-edge-cases)
*   [❓ Troubleshooting](#-troubleshooting)
*   [🤝 Contributing](#-contributing)
*   [📜 License](#-license)

## ✨ Features

*   🖼️ **Multi-Slot Image Composition**: Arrange and combine multiple images on a single canvas.
*   📏 **Customizable Layout**: Control spacing, scaling, and alignment of images within slots.
*   ✨ **Visual Effects**: Apply reflection, blur, and overlay colors to enhance compositions.
*   ✍️ **Text Overlay**: Add custom text layers with adjustable font, color, and position.
*   🚀 **Direct Jellyfin Integration**: Connect to your Jellyfin server to browse, search, and import covers/banners directly.
*   📂 **Local File Support**: Easily upload images from your computer.
*   📋 **Paste Image Support**: Paste images directly from your clipboard.
*   🎲 **Random Slot Filling**: Quickly populate slots with random images from your Jellyfin library.
*   🔄 **Slot Management**: Add, delete, move, and reorder image slots via drag-and-drop.
*   💾 **State Persistence**: Saves Jellyfin connection settings locally for convenience.
*   🎨 **Canvas Export**: Export the final composite image as a PNG file.
*   ⚙️ **Configurable Image Fetching**: Control size and quality of images fetched from Jellyfin.
*   🖱️ **Interactive UI**: Utilizes draggable windows and tabbed sections for a user-friendly experience.

## ⚙️ Installation / Setup

This project is a client-side web application. To use it, you primarily need a modern web browser.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/jeffersoncgo/CoverMaker.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd CoverMaker
    ```
3.  **Open in a browser:**
    Simply open the `index.html` file located in the root of the repository using your preferred web browser.

Alternatively, you can serve the files using a simple local web server (recommended for better handling of file paths and potential future features requiring a server context, although not strictly necessary for basic usage).

Using Python's built-in HTTP server:
```bash
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

Using Node.js with `http-server` (install via `npm install -g http-server`):
```bash
http-server
# Then open the address provided (usually http://127.0.0.1:8080)
```

No additional dependencies are required beyond a web browser or a simple HTTP server to serve the static files.

## 📁 Project Structure

The repository follows a standard structure for a simple web application.

<details>
<summary>Click to Expand Project Tree</summary>

```
.
├── .github
├── css/
│   └── style.css
├── images/
│   ├── error.png
│   └── loading.gif
├── js/
│   ├── jellyfin.js
│   ├── script.js
│   └── windowsHandle.js
├── .gitattributes
├── .gitignore
├── .gitmodules
├── index.html
└── README.md
```

</details>

*   `/css`: Contains the main stylesheet (`style.css`) for the application's visual presentation.
*   `/images`: Stores static image assets used by the application, such as default loading or error images.
*   `/js`: Houses the core JavaScript logic, including modules for Jellyfin interaction (`jellyfin.js`), general application functionality (`script.js`), and UI enhancements like draggable windows (`windowsHandle.js`).
*   `.github`: Contains GitHub-specific configuration, potentially for workflows or issue templates.
*   `index.html`: The main HTML file, serving as the entry point for the application interface.
*   `.gitattributes`, `.gitignore`, `.gitmodules`: Standard Git configuration files for managing line endings, ignored files, and submodules.
*   `README.md`: This documentation file.

## 📖 Detailed Usage / API Documentation

This section provides details on the key JavaScript files and their functionalities, derived from internal analysis.

### 📄 File: js/script.js - Core Application Logic

This file contains the primary client-side script that orchestrates the user interface, manages image slots, handles user interactions, draws on the canvas, and integrates with the `Jellyfin` and `windowsHandle` modules.

**Description**:
`script.js` acts as the main controller for the CoverMaker application. It initializes the UI, loads saved settings, manages the array of images (`slotsImages`) corresponding to the visual slots, provides methods for adding, removing, and manipulating slots, handles drag-and-drop, processes user input for canvas settings, interfaces with the Jellyfin API client to fetch media images, draws the final composite image on the canvas, and exports the result. It uses event listeners to respond to user actions.

**Key Features**:
*   Manages state for image slots and canvas settings.
*   Loads and saves Jellyfin credentials to `localStorage`.
*   Handles loading images from various sources (local file, paste, URL, Jellyfin).
*   Provides UI functions for managing image slots (add, delete, move, clear).
*   Integrates drag-and-drop for slot reordering and image dropping.
*   Communicates with the Jellyfin API client for browsing and searching media.
*   Draws the composite image on an HTML5 canvas with effects.
*   Exports the canvas content as a PNG.
*   Manages tabbed UI sections and floating windows (via `windowsHandle`).
*   Uses external utilities for safe file naming and potentially state memory (`pageMemory`).

**Dependencies**:
*   Internal: `./jellyfin` (Jellyfin API client), `../../scripts/components/utils/common` (utility functions, alias `utils`), `Controller` (likely for debouncing/throttling), `pageMemory` (for state saving/restoring).
*   External (Browser): `document`, `window`, `localStorage`, `fetch`, `Image`, `Canvas`, etc.

**How to Use / API Highlights / Examples**:

The functionalities exposed by `script.js` are primarily triggered by user interactions in the UI, but the underlying functions demonstrate how different parts of the application work.

#### Example 1: Adding a New Image Slot

This demonstrates how a new slot is added to the UI and the internal image array. This is typically triggered by clicking an "Add Slot" button.

*   **Purpose**: Increases the number of available image slots for composition.
*   **Code Snippet**:
    ```javascript
    // Assuming addImageSlot() is exposed globally or accessible
    // In script.js, this is called internally by an event listener
    // Let's simulate the action:
    addImageSlot(); // Adds a new slot element to the DOM
                    // and pushes null to the slotsImages array.
    ```
*   **Output**: A new, empty image slot element appears in the `image-slots` container in the HTML. The `slotsImages` array will have one more `null` entry. The canvas will be redrawn to reflect the change in slot count.
*   **Explanation**: This function modifies both the visual structure (DOM) and the internal data structure (`slotsImages` array) that tracks the images. It's a core function for building the composition.

#### Example 2: Loading an Image (Local File) into a Slot

This shows how an image file selected by the user is processed and loaded into a specific slot or the next available one. This is triggered by interacting with the file input associated with a slot.

*   **Purpose**: To place a selected image into a specific slot in the composition.
*   **Input**: A `File` object (e.g., from an `<input type="file">` event).
*   **Code Snippet**:
    ```javascript
    // Assume fileInput is an HTMLInputElement <input type="file">
    // and 'event' is the change event object.
    const file = event.target.files[0]; // Get the selected file
    const slotIndex = 0; // Target slot index (e.g., the first slot)

    // Call the function to load the image
    // In script.js, this is handled internally based on the input's data attribute
    // Let's simulate the call:
    loadImageIntoSlot(file, slotIndex);
    ```
*   **Output**: The preview image within the specified slot in the UI updates to show the loaded image. The canvas redraws to include the newly loaded image in the composite. The `slotsImages` array element at `slotIndex` is updated with the loaded `Image` object.
*   **Explanation**: This function is central to getting images into the application. It handles reading the file and using the `Image` constructor to load it, then updates the UI and internal state.

#### Example 3: Drawing the Composite Image

This function is called whenever a change occurs that affects the final output (image loaded, slot deleted/moved, setting changed).

*   **Purpose**: To render the current state of all image slots and canvas settings onto the main HTML5 canvas.
*   **Code Snippet**:
    ```javascript
    // Assuming drawComposite() is accessible
    // This is called frequently by various event listeners in script.js
    drawComposite();
    ```
*   **Output**: The content of the main `<canvas>` element is updated. It clears the previous drawing and draws the images from `slotsImages` according to the current settings (spacing, scale, reflection, blur, overlay, text).
*   **Explanation**: This is the core rendering function. It iterates through the `slotsImages` array and uses the Canvas API to draw each image with the user-defined transformations and effects, creating the final visual output shown in the UI.

#### Example 4: Exporting the Composite as PNG

This function generates a downloadable PNG file of the current canvas content.

*   **Purpose**: To allow the user to save the created composite image to their computer.
*   **Code Snippet**:
    ```javascript
    // Assuming exportAsPNG() is accessible
    // This is called when the export button is clicked
    exportAsPNG();
    ```
*   **Output**: The browser prompts the user to download a file, typically named based on internal logic (e.g., using a safe filename derived from potential text overlays or a default name), with the `.png` extension. The downloaded file contains the exact image rendered on the canvas.
*   **Explanation**: This function leverages the canvas's `toDataURL` method to get a base64 representation of the image, then uses a standard technique involving creating a temporary anchor tag (`<a>`) with a `download` attribute to trigger a file download in the browser.

#### Example 5: Logging into Jellyfin

This initiates the connection and authentication process with a Jellyfin server using credentials from the UI.

*   **Purpose**: To establish a connection to a Jellyfin server and authenticate a user to access their libraries and media.
*   **Code Snippet**:
    ```javascript
    // Assuming Login() is accessible and reads credentials from specific UI inputs
    // This is called when the Jellyfin "Login" button is clicked
    Login();
    ```
*   **Output**: If successful, the Jellyfin library selection UI becomes active. If unsuccessful, an error message is displayed in the UI, and the library selection remains disabled. The Jellyfin instance is updated internally with server info and user token.
*   **Explanation**: This function encapsulates the interaction with the `Jellyfin` class's configuration and initialization methods. It's the gateway to using the Jellyfin integration features.

### 📄 File: js/jellyfin.js - Jellyfin API Client

This file defines a class `Jellyfin` that serves as an interface for interacting with the Jellyfin media server REST API.

**Description**:
The `Jellyfin` class handles the technical details of communicating with a Jellyfin server. It manages the server address and user credentials, performs authentication, fetches user libraries and their contents, caches this data internally, and provides methods for searching, filtering, and paginating through the cached library items. It also assists in generating URLs for fetching item images. The design choice to cache library data locally allows for fast client-side searching and filtering without repeated API calls.

**Key Features**:
*   `Jellyfin` Class for API interaction.
*   Fetches server public information.
*   Authenticates users and manages authorization headers.
*   Retrieves and caches user libraries and their items.
*   Performs client-side search, filter, sort, and pagination on cached data.
*   Generates image URLs for media items.
*   Uses callback events (`onLoginSuccess`, `onLibraryLoad`, `onSearchFinish`, etc.) for asynchronous operations.
*   Manages search parameters internally.

**Dependencies**:
*   `fetch`: Standard browser API for making HTTP requests.
*   `require("../../scripts/js/JCGWEB/controller")`: Depends on an internal `Controller` module (likely for debouncing).
*   `searchInArray`: Uses a function assumed to be available globally or imported elsewhere for performing array searches.

**How to Use / API Highlights / Examples**:

An instance of the `Jellyfin` class is created and managed by `script.js`. The following examples illustrate how its methods would be used.

#### Example 1: Instantiating the Jellyfin Client

Creating a new instance and initiating the connection process.

*   **Purpose**: To create a new client object ready to communicate with a specific Jellyfin server using provided credentials.
*   **Input**: `Host` (string), `Username` (string), `Pw` (string), `events` (object of callback functions).
*   **Code Snippet**:
    ```javascript
    // Example of creating an instance (as done internally by script.js)
    const jellyfinEvents = {
        onServerSetupError: (error) => console.error("Server setup failed:", error),
        onLoginSuccess: (user) => console.log("Logged in as:", user.Username),
        onLoginError: (error) => console.error("Login failed:", error),
        onLibraryLoad: (libraries) => console.log("Libraries loaded:", libraries.map(lib => lib.Name)),
        onSearchFinish: (results) => console.log("Search finished, items found:", results.length)
    };

    const jellyfinClient = new Jellyfin(
        "http://your-jellyfin-server:8096", // Replace with your server address
        "your_username",                     // Replace with your username
        "your_password",                     // Replace with your password
        jellyfinEvents                       // Pass the event handlers
    );

    // Instantiation automatically calls init() which starts connection/login
    ```
*   **Output**: A `Jellyfin` object instance is created. Asynchronous API calls are initiated. Based on success/failure, the corresponding event callback functions (`onLoginSuccess`, `onLoginError`, `onServerSetupError`) are triggered.
*   **Explanation**: The constructor takes server and user details along with an object containing callback functions. These callbacks are essential for the external code (`script.js`) to react to the asynchronous results of API operations like login and data loading.

#### Example 2: Searching Cached Library Items

Filtering and retrieving items from the data loaded from the Jellyfin server.

*   **Purpose**: To find items within the already loaded libraries that match specific criteria (name, library, custom query).
*   **Input**: `Name` (optional string), `library` (optional string), `query` (optional object for detailed search params).
*   **Code Snippet**:
    ```javascript
    // Assuming jellyfinClient is an initialized instance that has loaded libraries
    // Search for items containing "Star Wars" in the currently loaded library
    jellyfinClient.searchItems("Star Wars");

    // Search for items in the "Movies" library containing "Matrix"
    jellyfinClient.searchItems("Matrix", "Movies");

    // More advanced search: find items in "TV Shows" starting with "S", sorted by name ascending
    jellyfinClient.searchItems(null, "TV Shows", {
        Name: "S",
        SortBy: "SortName",
        SortOrder: "Ascending",
        StartIndex: 0, // Start from the first page
        Limit: 50      // Get up to 50 results
    });
    ```
*   **Output**: The `onSearchFinish` event callback (provided during instantiation) is triggered with an array containing the filtered, sorted, and paginated item objects. The function also returns this array. Internal state (`this.searchParams`) is updated.
*   **Explanation**: This method operates on the data that was previously fetched and cached by the `Jellyfin` instance. It's designed for fast, client-side filtering and sorting, making the UI responsive to user input in search fields and filter dropdowns.

#### Example 3: Generating an Image URL

Creating a correctly formatted URL to fetch a specific item's image from the server.

*   **Purpose**: To get the web address for an item's cover, poster, or other image, allowing control over its desired dimensions.
*   **Input**: `itemId` (string), `width` (optional number), `height` (optional number), `quality` (optional number).
*   **Code Snippet**:
    ```javascript
    // Assuming jellyfinClient is an initialized instance
    const itemId = "some_item_id_from_jellyfin"; // Replace with a real item ID

    // Get URL for the item's primary image (default size)
    const imageUrlDefault = jellyfinClient.makeImageUrl(itemId);
    console.log("Default Image URL:", imageUrlDefault);

    // Get URL for a 500px wide image
    const imageUrl500Wide = jellyfinClient.makeImageUrl(itemId, 500);
    console.log("500px Wide Image URL:", imageUrl500Wide);

    // Get URL for a 300x450 image with 80% quality
    const imageUrlSpecific = jellyfinClient.makeImageUrl(itemId, 300, 450, 80);
    console.log("Specific Size/Quality Image URL:", imageUrlSpecific);
    ```
*   **Output**: A string containing the URL to fetch the image from the configured Jellyfin server.
*   **Explanation**: This utility function correctly formats the API endpoint for image delivery, including the necessary item ID and optional parameters for requesting a specific image size and quality. This is crucial for populating `<img>` tags or CSS backgrounds in the UI.

### 📄 File: js/windowsHandle.js - Floating Windows

This JavaScript file provides functionality to make arbitrary HTML elements behave like draggable, closable windows within the browser viewport.

**Description**:
`windowsHandle.js` adds interactive window management features to web elements. It identifies elements marked with a specific class (`.floatWindow`) and automatically applies drag functionality using a designated handle element (`.windowBar`). It also adds event listeners to a close button (`.closeBtn`) if present, allowing the window to be hidden. Functions are provided to programmatically show or hide windows by ID. The script ensures windows stay within the visible browser area and brings the clicked window to the front using `zIndex`.

**Key Features**:
*   Makes HTML elements draggable within the viewport.
*   Uses a specific child element as the drag handle.
*   Constrains dragging to the visible browser window.
*   Brings the active window to the front (`zIndex`).
*   Adds close functionality via a dedicated button.
*   Provides functions to show and hide windows programmatically.
*   Automatically initializes draggable behavior for elements on page load.

**Dependencies**:
*   Relies solely on standard browser DOM APIs (`document`, `window`, `Element`, etc.).

**How to Use / API Highlights / Examples**:

The functionality is primarily applied automatically or triggered by calling the provided functions on target DOM elements.

#### Example 1: Applying Drag Behavior to an Element

The `makeDraggable` function is the core of this module, though it's often called automatically for elements with the `.floatWindow` class.

*   **Purpose**: To enable a specific HTML element to be dragged around the screen.
*   **Input**: `windowEl` (DOM element object). The element should have a child with class `windowBar` (drag handle) and optionally a child with class `closeBtn`.
*   **Code Snippet**:
    ```html
    <!-- Example HTML structure for a draggable window -->
    <div id="myDraggableWindow" class="floatWindow">
        <div class="windowBar">Window Title Bar</div>
        <div class="windowContent">... window content ...</div>
        <button class="closeBtn">Close</button>
    </div>
    ```
    ```javascript
    // Assuming windowsHandle.js is loaded
    // This happens automatically for elements with class 'floatWindow' on DOMContentLoaded
    // To manually make an element draggable (e.g., one added dynamically):
    const myWindow = document.getElementById('myDraggableWindow');
    if (myWindow) {
        makeDraggable(myWindow);
    }
    ```
*   **Output**: The specified `windowEl` element can now be dragged by clicking and holding its `windowBar` child. Clicking the element brings it to the front. Clicking the `closeBtn` hides the window.
*   **Explanation**: This function attaches event listeners (`mousedown`, `mousemove`, `mouseup`) to the element and the document to track drag movements, update the element's position (`left`, `top`), and manage its `zIndex`. It also sets up the close button listener.

#### Example 2: Showing a Hidden Window

Making a specific window element visible and centering it.

*   **Purpose**: To display a window that was previously hidden (e.g., using `hideWindow` or the close button).
*   **Input**: `windowId` (string, the `id` attribute of the window element).
*   **Code Snippet**:
    ```javascript
    // Assuming windowsHandle.js is loaded
    // To show the window with id 'myDraggableWindow'
    showWindow('myDraggableWindow');
    ```
*   **Output**: The HTML element with the ID `myDraggableWindow` changes its display style to `block` (or its previous display value) and is centered on the screen. Its `zIndex` is updated to ensure it's on top.
*   **Explanation**: This function finds the target element by ID and manipulates its `display`, `left`, `top`, and `zIndex` CSS properties to make it visible and position it appropriately.

#### Example 3: Hiding a Visible Window

Making a specific window element hidden.

*   **Purpose**: To conceal a visible window element from the user interface.
*   **Input**: `windowId` (string, the `id` attribute of the window element).
*   **Code Snippet**:
    ```javascript
    // Assuming windowsHandle.js is loaded
    // To hide the window with id 'myDraggableWindow'
    hideWindow('myDraggableWindow');
    ```
*   **Output**: The HTML element with the ID `myDraggableWindow` changes its display style to `none`.
*   **Explanation**: This function finds the target element by ID and simply sets its `display` CSS property to `none`, removing it from the visual layout.

## 🔧 Configuration

Configuration in CoverMaker is primarily managed through the `Setup` object within `js/script.js` and implicitly through the properties of the `Jellyfin` instance.

*   **`js/script.js` `Setup` Object**: This object holds settings for image dimensions and quality when fetching covers/banners from Jellyfin, as well as paths to default images.
    ```javascript
    const Setup = {
        Banner: { width: 2000, height: 2000, quality: 100 }, // Settings for Library Banners
        Cover: { width: 2000, height: 2000, quality: 100 },  // Settings for Item Covers
        Library: { loadedLibrary: null },                  // Currently selected library name
        Images: {
            loading: "./images/loading.gif",              // Path to loading image
            error: "./images/error.png"                   // Path to error image
        }
    };
    ```
    These values can be adjusted directly in the `script.js` file if you need different default image sizes or paths. The `loadedLibrary` is managed dynamically by the application based on user selection.

*   **`js/jellyfin.js` Internal State**: The `Jellyfin` class manages its configuration internally via properties like `this.Server`, `this.User`, and `this.searchParams`. These are populated when a new instance is created or when `UpdateConfig` is called. Users interact with this configuration indirectly via the UI elements that trigger `Login()` or `searchItems()` calls in `script.js`.

Most users will not need to modify these settings directly in the code, as the application's UI provides controls for Jellyfin connection details and canvas effects.

## 🏃 Scripts / Commands

This project is a client-side web application. There are no build scripts or server-side commands to run in the typical sense.

To use the application, simply **open the `index.html` file in your web browser** or serve the directory using a simple static file server (as described in the [Installation](#️-installation--setup) section).

All core functionality is executed by the browser's JavaScript engine in response to user interaction.

## 🛡️ Security & Safety Highlights

CoverMaker is designed with user safety and privacy in mind, particularly concerning its interaction with a personal Jellyfin server:

*   **Client-Side Operation**: The entire application runs in your web browser. No processing of your images or Jellyfin data occurs on external servers hosted by the project developers.
*   **Local Data Storage**: Jellyfin server credentials (host, username, password) are saved *only* in your browser's `localStorage`. This data does not leave your browser and is not transmitted anywhere other than to your specified Jellyfin server during login attempts. While `localStorage` is not encrypted, it provides a convenient way to persist settings locally without involving external databases or servers. Users should be aware that `localStorage` can be accessed by other scripts running on the *same origin* (domain/protocol/port), but this is standard browser behavior.
*   **Direct Jellyfin Connection**: The application connects directly from your browser to *your* Jellyfin server. It does not route your connection or data through any intermediary service.
*   **Safe File Naming**: The application uses a utility (`safeWindowsFileName` from `../../scripts/components/utils/common`) when exporting files to ensure generated filenames are compatible with standard operating system file naming rules, preventing potential errors or security issues related to invalid characters in filenames.
*   **Limited API Scope**: The Jellyfin integration focuses on reading library data and fetching images. It does not request permissions to modify your Jellyfin server's content or settings beyond standard user access for browsing.

By operating entirely client-side and saving sensitive (though self-hosted) credentials only in local storage, CoverMaker minimizes external dependencies and potential data exposure points, relying on the security of your browser and your own Jellyfin server setup.

## ⚠️ Limitations and Edge Cases

*   **Browser Compatibility**: The application relies heavily on modern browser features, particularly the HTML5 Canvas API and Fetch API. Older browsers may not be fully supported.
*   **Performance**: Performance can be affected by the size and number of images loaded into slots and the complexity of the canvas drawing operations. Very large images or a high number of slots might lead to slowdowns, especially on less powerful devices.
*   **Image Formats**: While modern browsers support various image formats (PNG, JPG, GIF, WebP, etc.), compatibility might vary. The application's ability to load and draw images is dependent on the browser's native support.
*   **Cross-Origin Images**: Loading images directly from external URLs (not your Jellyfin server or local files) might be subject to Cross-Origin Resource Sharing (CORS) restrictions imposed by the server hosting the image.
*   **`localStorage`**: While used for convenience, `localStorage` is not suitable for highly sensitive data and has size limitations.
*   **Jellyfin API Changes**: Changes to the Jellyfin API in future server versions could potentially break compatibility with the current `js/jellyfin.js` implementation.
*   **Missing Dependencies**: Some dependencies like `Controller` and `pageMemory` are referenced but not included in the core analysis, suggesting they might be part of a larger framework or separate modules not present in this repository or excluded from analysis. Their absence might impact certain non-core features related to performance optimization (debouncing) or state management if not provided externally.

## ❓ Troubleshooting

*   **Jellyfin Login Failed**:
    *   Double-check the Jellyfin server address (including `http://` or `https://` and the correct port, usually 8096 or 8920).
    *   Verify your Jellyfin username and password are correct.
    *   Ensure your Jellyfin server is running and accessible from the computer running the browser. Check your server's firewall and network settings.
*   **Images Not Loading (Previews or Canvas)**:
    *   For local files or pasted images, ensure the file is a supported image format (PNG, JPG, etc.).
    *   For Jellyfin images, ensure you are successfully logged into the Jellyfin server and have selected a library that contains items with images.
    *   Check your browser's developer console (usually F12) for network errors (e.g., 404 Not Found, CORS errors) or JavaScript errors related to image loading.
    *   Ensure the `images/loading.gif` and `images/error.png` files exist at the correct relative paths from `index.html`.
*   **Canvas Export Issues**:
    *   Ensure the canvas is not empty (i.e., images have been loaded into slots).
    *   Some browser extensions might interfere with file downloads. Try disabling extensions.
    *   Check browser compatibility for the Canvas `toDataURL` method.

If you encounter persistent issues, checking the browser's developer console for error messages is always the first step.

## 🤝 Contributing

This project is open source. If you find issues or have suggestions for improvements, please open an issue on the GitHub repository.

If you wish to contribute code, please:
1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes, following the existing coding style.
4.  Test your changes thoroughly.
5.  Submit a pull request with a clear description of your changes.

Please refer to any existing `CONTRIBUTING.md` file in the repository for more detailed guidelines, if available.

## 📜 License

MIT License

Copyright (c) 2025 jeffersoncgo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
