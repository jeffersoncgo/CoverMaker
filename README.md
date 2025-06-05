# 🚀 README AI - CoverMaker

CoverMaker is a client-side web application designed to help users easily create custom image composites, primarily for generating visual banners or posters. It provides a flexible interface for arranging multiple images onto a canvas, offering granular control over layout, scaling, spacing, reflection effects, and text overlays. A key feature is its seamless integration with Jellyfin media servers, allowing users to browse their libraries and directly pull item covers and banners into their compositions. Whether you're creating artwork for media libraries, generating custom wallpapers, or simply experimenting with image layouts, CoverMaker offers a straightforward tool accessible directly from your web browser.

## 📚 Table of Contents

*   [🚀 Features](#-features)
*   [🛠️ Requirements](#️-requirements)
*   [⬇️ Installation / Setup](#️-installation--setup)
*   [📂 Project Structure](#-project-structure)
*   [📖 Detailed Usage / API Documentation](#-detailed-usage--api-documentation)
    *   [📁 File: js/script.js - Core Application Logic](#-file-jsscriptjs---core-application-logic)
    *   [📁 File: js/jellyfin.js - Jellyfin API Client](#-file-jsjellyfinjs---jellyfin-api-client)
    *   [📁 File: js/windowsHandle.js - Floating Window Manager](#-file-jswindowshandlejs---floating-window-manager)
*   [⚙️ Configuration](#️-configuration)
*   [🛡️ Security & Safety Highlights](#️-security--safety-highlights)
*   [🚧 Limitations and Edge Cases](#-limitations-and-edge-cases)
*   [🤝 Contributing](#-contributing)
*   [📄 License](#-license)
*   [🚧 Work in Progress](#-work-in-progress)

## 🚀 Features

*   🖼️ **Image Slot Management:** Easily add, delete, clear, move, and pin image placeholders.
*   📂 **Flexible Image Loading:** Load images from local files, URLs, clipboard paste, or integrated Jellyfin server.
*   ✨ **Canvas Composition:** Draw multiple images onto a single canvas with customizable layout.
*   📏 **Layout Controls:** Adjust image scaling, spacing, and alignment within the composition.
*   🪞 **Reflection Effects:** Apply realistic reflections with adjustable distance, scale, and blur.
*   🅰️ **Text Overlay:** Add custom text to the composite with control over font, size, color, and opacity.
*   📺 **Jellyfin Integration:** Browse and select covers/banners directly from your Jellyfin server.
*   🔍 **Jellyfin Search & Pagination:** Search your Jellyfin library content and navigate through results.
*   ⬇️ **Image Export:** Save the final composite as a PNG file or open it in a new browser tab.
*   💾 **Local Storage:** Persist Jellyfin login credentials securely in the browser's local storage.
*   🖱️ **Drag and Drop:** Rearrange image slots and drag Jellyfin covers directly into slots.
*   🪟 **Floating Windows:** Interactive, draggable window elements for UI components.

## 🛠️ Requirements

*   A modern web browser with JavaScript enabled (e.g., Chrome, Firefox, Edge, Safari).
*   (Optional) Access to a running Jellyfin media server if you wish to use the Jellyfin integration features.

## ⬇️ Installation / Setup

CoverMaker is a client-side web application and does not require server-side installation or complex build steps.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/jeffersoncgo/CoverMaker.git
    ```
2.  **Navigate to the repository directory:**
    ```bash
    cd CoverMaker
    ```
3.  **Open `index.html`:**
    Simply open the `index.html` file in your preferred web browser. You can do this directly from your file explorer or via the browser's "File > Open" menu.

The application will load in your browser, ready for use.

## 📂 Project Structure

The repository is organized as follows:

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

*   `.github/`: Contains GitHub-specific configuration files, potentially for workflows or issue templates.
*   `css/`: Holds the cascading style sheets (`style.css`) that define the visual presentation and layout of the application.
*   `images/`: Contains static image assets used by the application, such as loading indicators (`loading.gif`) and error placeholders (`error.png`).
*   `js/`: Houses the core JavaScript files that provide the application's functionality, including the main script (`script.js`), the Jellyfin client (`jellyfin.js`), and the window management utility (`windowsHandle.js`).
*   `.gitattributes`: Defines attributes per path, often used for normalizing line endings.
*   `.gitignore`: Specifies intentionally untracked files that Git should ignore.
*   `.gitmodules`: Used for tracking submodules if the project incorporates other repositories.
*   `index.html`: The main entry point of the application, the HTML file that the user opens in their browser.
*   `README.md`: This file, providing documentation for the project.

## 📖 Detailed Usage / API Documentation

This section details the key JavaScript components and how they are used within the application.

### 📁 File: js/script.js - Core Application Logic

This file contains the main client-side logic, managing the UI, image slots, canvas drawing, and integrating the other components.

*   **Description**: This script orchestrates the entire application flow. It handles user interactions with the UI, manages the state of the image slots, draws the composite image on the canvas based on user settings, and integrates functionality from the Jellyfin API client and window manager.
*   **Key Features**:
    *   Manages a dynamic list of image "slots".
    *   Supports loading images from various sources.
    *   Draws a composite image on canvas with settings control.
    *   Integrates Jellyfin browsing and image selection.
    *   Handles image export.
    *   Saves and loads Jellyfin credentials via local storage.
    *   Manages UI tabs and drag/drop functionality.
*   **Dependencies**:
    *   Internal: `./jellyfin.js` (`Jellyfin` class), `./pageMemory.js` (for `window.memory`), `./Controller.js` (for `searchController`), `../../scripts/components/utils/common.js` (`utils`).
    *   External: Browser DOM, Canvas API, FileReader, Image, localStorage, Clipboard API, Drag and Drop API, `window.open`, `fetch`.

*   **How to Use / API Highlights / Examples**:

    The `script.js` file exposes various functions globally or attaches listeners to DOM elements. Below are examples of how core functionalities work or could be programmatically triggered if used as a library (though primarily designed as a direct application script).

    **Example 1: Loading a Local Image into a Slot**

    This demonstrates how a user action (selecting a file) triggers the image loading and slot update process.

    *   **Input**: A `File` object obtained from a file input element.
    *   **Code Snippet**:
        ```javascript
        // Assume 'localImageInput' is an HTML input element of type="file"
        const localImageInput = document.getElementById('localImageInput');

        localImageInput.addEventListener('change', function(event) {
            const file = event.target.files[0]; // Get the first selected file
            if (file) {
                // loadImageIntoSlot is a function likely available globally or through event listeners
                loadImageIntoSlot(file); // Load the file into the first available slot
                console.log('Attempting to load image:', file.name);
            }
        });
        ```
    *   **Output**: The selected image appears in the first available image slot preview, and the composite canvas is redrawn to include the new image. A loading indicator might appear temporarily.
    *   **Explanation**: This is the standard way users add local images. The `loadImageIntoSlot` function handles reading the file (or fetching if it were a URL), creating an `Image` element, and updating the UI and internal state.

    **Example 2: Redrawing the Composite Canvas**

    The composite canvas needs to be redrawn whenever an image changes or a setting is adjusted.

    *   **Input**: None (relies on the current state of `slotsImages` and setting inputs).
    *   **Code Snippet**:
        ```javascript
        // Assume 'spacingInput' is an HTML input element
        const spacingInput = document.getElementById('spacingInput');

        spacingInput.addEventListener('input', function() {
            // drawComposite is a function likely available globally or through event listeners
            drawComposite(); // Redraw the canvas whenever spacing changes
            console.log('Spacing changed, redrawing canvas.');
        });

        // This function is also called internally whenever an image slot is updated
        // or other relevant settings change.
        ```
    *   **Output**: The `canvas` element is cleared and redrawn with the images arranged according to the latest settings, including the updated spacing.
    *   **Explanation**: The `drawComposite` function is the core rendering loop. It reads all necessary parameters from the UI and internal state (`slotsImages`) and uses the Canvas API to render the final image.

    **Example 3: Exporting the Composite Image**

    How the application handles saving the final output.

    *   **Input**: None (relies on the current state of the `canvas`).
    *   **Code Snippet**:
        ```javascript
        // Assume 'exportButton' is an HTML button element
        const exportButton = document.getElementById('exportButton');

        exportButton.addEventListener('click', function() {
            // exportAsPNG is a function likely available globally or through event listeners
            exportAsPNG(); // Trigger the download
            console.log('Exporting canvas as PNG.');
        });
        ```
    *   **Output**: The browser initiates a file download of the canvas content as a PNG image file.
    *   **Explanation**: The `exportAsPNG` function uses `canvas.toDataURL('image/png')` to get a base64 representation of the image and then creates a temporary link element to trigger a download.

    **Example 4: Logging into Jellyfin and Searching**

    Illustrates the flow for connecting to Jellyfin and performing a search.

    *   **Input**: Server URL, Username, and Password entered into designated input fields.
    *   **Code Snippet**:
        ```javascript
        // Assume input fields and a login button exist
        const loginButton = document.getElementById('loginButton');

        loginButton.addEventListener('click', function() {
            // Login is a function likely available globally or through event listeners
            Login(); // Attempt to log in using the current input values
            console.log('Attempting Jellyfin login...');
        });

        // After successful login (handled by the Jellyfin class callback),
        // a search might be automatically triggered or the user can type in the search box.
        const searchInput = document.getElementById('jellyfinSearchInput');
        searchInput.addEventListener('input', function() {
             // searchOnLibrary is a function likely available globally or through event listeners
             // useDelay=true is common for input events to debounce the search
             searchOnLibrary(this.value, false, true);
             console.log('Search input changed, searching Jellyfin library...');
        });
        ```
    *   **Output**:
        *   Upon clicking Login: The application attempts to connect to the Jellyfin server. UI elements related to Jellyfin browsing become visible/hidden based on success/failure.
        *   Upon typing in Search: The Jellyfin library is filtered based on the input, and matching covers/banners are displayed in the Jellyfin browsing area.
    *   **Explanation**: The `Login` function reads credentials from the UI and calls the `UpdateConfig` method on the `window.jellyfin` instance, which handles the actual API interaction and authentication. The `searchOnLibrary` function updates the search parameters and triggers the client-side search within the `jellyfin` instance, then updates the UI with the results.

### 📁 File: js/jellyfin.js - Jellyfin API Client

This file contains a dedicated class for interacting with a Jellyfin server's API.

*   **Description**: The `Jellyfin` class provides methods to connect to a server, authenticate a user, fetch user libraries, load library items, perform client-side searching/filtering over loaded items, and generate image URLs. It acts as a wrapper around the Jellyfin REST API relevant to browsing content.
*   **Key Features**:
    *   Connects to Jellyfin server.
    *   Authenticates users with username/password.
    *   Fetches user's libraries and their items.
    *   Performs client-side search on loaded items.
    *   Supports pagination for search results.
    *   Generates URLs for item images (covers, banners, etc.).
    *   Provides event callbacks for login, library load, and search finish.
*   **Dependencies**:
    *   Internal: `../../scripts/js/JCGWEB/controller.js` (aliased as `Controller`).
    *   External: Standard browser `fetch` API, global `searchInArray` function (assumed).

*   **How to Use / API Highlights / Examples**:

    The `Jellyfin` class is typically instantiated once and its methods are called by the main application script (`script.js`).

    **Example 1: Initializing the Jellyfin Client**

    Creating an instance to start interacting with the server.

    *   **Input**: Server Host, Username, Password, and an optional `events` object with callback functions.
    *   **Code Snippet**:
        ```javascript
        import Jellyfin from './jellyfin.js';

        const jellyfinEvents = {
            onServerSetupError: (error) => console.error('Jellyfin server setup failed:', error),
            onLoginSuccess: (user) => console.log('Jellyfin login successful:', user),
            onLoginError: (error) => console.error('Jellyfin login failed:', error),
            onLibraryLoad: (libraries) => console.log('Jellyfin libraries loaded:', libraries),
            onSearchFinish: (results) => console.log('Jellyfin search finished, results count:', results.length)
        };

        // Assuming config variables are loaded from localStorage or user input
        const serverHost = localStorage.getItem('jellyfinHost') || 'http://localhost:8096';
        const username = localStorage.getItem('jellyfinUsername') || '';
        const password = ''; // Password is not typically stored long-term

        const jellyfinClient = new Jellyfin(serverHost, username, password, jellyfinEvents);

        // The constructor automatically calls init() to attempt connection and login.
        ```
    *   **Output**: A `Jellyfin` instance is created. An asynchronous process begins to check server availability, attempt login, and load libraries. Console logs will show the progress and any errors via the provided callbacks.
    *   **Explanation**: The constructor sets up the instance and immediately tries to establish a connection using the provided credentials. The `events` object is crucial for the calling code to react to the outcomes of these asynchronous operations.

    **Example 2: Searching for Items**

    Filtering the loaded library items based on criteria.

    *   **Input**: Optional `Name` (string), `library` (string), and a `query` object.
    *   **Code Snippet**:
        ```javascript
        // Assuming jellyfinClient is already initialized and libraries are loaded

        // Perform a basic search for items containing "Matrix" in the name
        const searchResults = jellyfinClient.searchItems("Matrix");
        console.log("Search results for 'Matrix':", searchResults);

        // Perform a search specifically in the "Movies" library for items containing "Wars",
        // sorting by name descending, showing results 11-20 (page 2 with limit 10)
        const advancedSearchResults = jellyfinClient.searchItems(
            "Wars",
            "Movies",
            { sortBy: "Name", order: "desc", page: 2, limit: 10 }
        );
        console.log("Advanced search results:", advancedSearchResults);
        ```
    *   **Output**: The `searchItems` method returns an array of item objects matching the criteria from the items loaded in memory. The `onSearchFinish` event callback is also triggered with these results. Pagination state (`hasNextPage`, `hasPreviousPage`) on the `jellyfinClient` instance is updated.
    *   **Explanation**: This method performs a client-side filter and sort on the data previously fetched by `loadLibraryItems`. This design allows for very fast filtering once the initial load is complete, but depends on `loadLibraryItems` successfully fetching all relevant data first.

    **Example 3: Navigating Pagination**

    Moving through search results pages.

    *   **Input**: None for `nextPage` or `previousPage`.
    *   **Code Snippet**:
        ```javascript
        // Assuming a search has been performed and jellyfinClient.hasNextPage is true

        if (jellyfinClient.hasNextPage) {
            console.log("Loading next page...");
            const nextPageResults = jellyfinClient.nextPage();
            console.log("Next page results:", nextPageResults);
        } else {
            console.log("No more pages available.");
        }

        // Similarly for previousPage:
        if (jellyfinClient.hasPreviousPage) {
            console.log("Loading previous page...");
            const previousPageResults = jellyfinClient.previousPage();
            console.log("Previous page results:", previousPageResults);
        }
        ```
    *   **Output**: The internal page/offset state of the `jellyfinClient` is updated, and `searchItems` is called internally to return the results for the new page. The `onSearchFinish` event is triggered again.
    *   **Explanation**: `nextPage` and `previousPage` are convenience methods that modify the internal `searchParams.page` and `searchParams.offset` and then re-run the `searchItems` logic to get the appropriate slice of the loaded data.

    **Example 4: Generating Image URLs**

    Getting the correct URL to display item artwork.

    *   **Input**: `itemId` (string), and optional `width`, `height`, `quality` (numbers).
    *   **Code Snippet**:
        ```javascript
        // Assuming jellyfinClient is initialized and you have an item object with an Id property
        const sampleItemId = 'a1b2c3d4e5f6'; // Example item ID

        // Get URL for the primary image with default dimensions (2000x2000)
        const imageUrlDefault = jellyfinClient.makeImageUrl(sampleItemId);
        console.log("Default image URL:", imageUrlDefault);

        // Get URL for a smaller thumbnail, specifying width and height
        const imageUrlThumbnail = jellyfinClient.makeImageUrl(sampleItemId, 300, 450);
        console.log("Thumbnail URL:", imageUrlThumbnail);

        // Get URL with specific quality setting
        const imageUrlLowQuality = jellyfinClient.makeImageUrl(sampleItemId, 1000, 1000, 50);
        console.log("Low quality image URL:", imageUrlLowQuality);
        ```
    *   **Output**: Returns a string representing the HTTP URL to fetch the specified image from the Jellyfin server.
    *   **Explanation**: This method correctly formats the URL path and query parameters required by the Jellyfin API to request a specific image (`Primary`, `Banner`, `Logo`, etc. - although the implementation seems to default to `Primary`) for a given item, optionally resizing and compressing it.

### 📁 File: js/windowsHandle.js - Floating Window Manager

This script provides functionality for creating and managing draggable window elements in the browser.

*   **Description**: This file contains functions to make arbitrary HTML elements behave like simple floating windows. It enables dragging using a designated handle, closing via a button, constraining movement to the viewport, bringing the active window to the front, and programmatically showing/hiding windows by their ID.
*   **Key Features**:
    *   Makes elements draggable via a child handle (`.windowBar`).
    *   Restricts dragging within the viewport boundaries.
    *   Brings dragged or shown windows to the front using `z-index`.
    *   Hides windows when a child close button (`.closeBtn`) is clicked.
    *   Provides functions to show and hide windows by ID.
    *   Automatically initializes elements with the class `floatWindow` on page load.
*   **Dependencies**:
    *   Internal: None.
    *   External: Standard browser DOM APIs and event handling.

*   **How to Use / API Highlights / Examples**:

    The functions in `windowsHandle.js` are typically called automatically on page load for elements with the `floatWindow` class, or can be invoked programmatically.

    **Example 1: Automatically Initialized Draggable Window**

    Elements with the correct class structure are made draggable on `DOMContentLoaded`.

    *   **Input**: An HTML element with the class `floatWindow` containing a child element with class `windowBar`.
    *   **Code Snippet**:
        ```html
        <!-- Example HTML structure -->
        <div id="myFloatingWindow" class="floatWindow">
            <div class="windowBar">Window Title <button class="closeBtn">X</button></div>
            <div class="windowContent">
                <p>This is the content of the floating window.</p>
            </div>
        </div>

        <style>
            /* Basic styles required for positioning */
            .floatWindow {
                position: absolute; /* Needed for top/left positioning */
                /* Initial centering style applied by the script on load */
                /* transform: translate(-50%, -50%); */
                /* top: 50%; left: 50%; */
                /* Other styling like border, background, etc. */
            }
            .windowBar {
                cursor: grab; /* Indicate it's draggable */
                /* Styling for the drag handle */
            }
        </style>
        <script src="js/windowsHandle.js"></script>
        ```
    *   **Output**: When the page loads, the `div` with `id="myFloatingWindow"` will be automatically positioned (initially centered) and enabled for dragging by clicking and dragging the `div` with class `windowBar`. Clicking the button with class `closeBtn` will hide the window.
    *   **Explanation**: The script listens for the `DOMContentLoaded` event. When it fires, it finds all elements with the class `floatWindow` and calls `makeDraggable` on each, setting up the necessary event listeners for drag behavior and close functionality.

    **Example 2: Programmatically Showing a Window**

    Making a hidden window visible via a button click or other event.

    *   **Input**: The string ID of the window element (`windowId`).
    *   **Code Snippet**:
        ```javascript
        // Assume you have a button to open the window
        const openWindowButton = document.getElementById('openSettingsButton');

        openWindowButton.addEventListener('click', function() {
            // showWindow function is available globally
            showWindow('myFloatingWindow'); // Use the ID defined in HTML
            console.log('Showing window with ID "myFloatingWindow"');
        });
        ```
    *   **Output**: The HTML element with `id="myFloatingWindow"` becomes visible (`display: block`) and its `z-index` is set to a high value to ensure it appears on top of other windows.
    *   **Explanation**: The `showWindow` function finds the element by its ID and directly manipulates its `display` and `z-index` CSS properties.

    **Example 3: Programmatically Hiding a Window**

    Concealing a window using its ID.

    *   **Input**: The string ID of the window element (`windowId`).
    *   **Code Snippet**:
        ```javascript
        // Assume you have a button or other event to close the window
        const closeProgrammaticallyButton = document.getElementById('closeAlertButton');

        closeProgrammaticallyButton.addEventListener('click', function() {
            // hideWindow function is available globally
            hideWindow('myFloatingWindow'); // Use the ID defined in HTML
            console.log('Hiding window with ID "myFloatingWindow"');
        });
        ```
    *   **Output**: The HTML element with `id="myFloatingWindow"` becomes hidden (`display: none`).
    *   **Explanation**: The `hideWindow` function finds the element by its ID and sets its `display` style to 'none'. Note that the close button mechanism handled by `makeDraggable` internally uses a similar logic.

## ⚙️ Configuration

The primary configuration for CoverMaker resides within the `js/script.js` file in the `Setup` constant object. Additionally, Jellyfin connection details are managed using browser `localStorage`.

*   **Canvas Composition Settings:**
    The `Setup` object defines default dimensions and quality settings for fetching Jellyfin images (`Banner`, `Cover`). These can be adjusted directly in the `js/script.js` file if you need different defaults. Most user-facing settings (scaling, spacing, reflection, text) are controlled directly via the input fields in the application's UI.

*   **Jellyfin Login Configuration:**
    Your Jellyfin server address and username are automatically saved to and loaded from your browser's `localStorage` when you interact with the Jellyfin login fields. The password is not saved to local storage for security reasons.
    *   `localStorage.getItem('jellyfinHost')`: Retrieves the saved server address.
    *   `localStorage.getItem('jellyfinUsername')`: Retrieves the saved username.
    *   `localStorage.setItem('jellyfinHost', value)`: Saves the server address.
    *   `localStorage.setItem('jellyfinUsername', value)`: Saves the username.

    These values are used by the `CreateJellyfin` and `Login` functions in `script.js` to initialize and update the `Jellyfin` client instance.

## 🛡️ Security & Safety Highlights

CoverMaker is designed with a focus on client-side operation and user control:

*   **Client-Side Execution:** The application runs entirely within your web browser. No data is processed or stored on a remote server operated by the project maintainers.
*   **Local File Handling:** When loading local files, they are processed directly by your browser using the FileReader API. Files are not uploaded anywhere.
*   **Jellyfin Integration:** The Jellyfin client (`js/jellyfin.js`) connects *directly* from your browser to the Jellyfin server address *you provide*. Credentials are sent directly to your server. Your Jellyfin data does not pass through any third-party servers.
*   **Local Storage for Credentials:** Server address and username for Jellyfin are stored in your browser's local storage. While convenient for persistence, users should be aware that local storage is accessible to other scripts running on the *same origin* (i.e., files served from the same location as `index.html`). The password is *not* stored.
*   **No External Dependencies (Runtime):** The core application relies only on standard browser APIs and the provided JavaScript files. It does not pull external libraries or scripts from CDNs at runtime, reducing the risk of unexpected code execution.

As long as you obtain the code from a trusted source (like the official GitHub repository) and use it in a secure browser environment, the primary security considerations relate to the security of your local machine and the network connection to your Jellyfin server (if used).

## 🚧 Limitations and Edge Cases

*   **Client-Side Jellyfin Search Memory:** The `Jellyfin` class in `js/jellyfin.js` loads all library items into memory for client-side searching. This might consume significant memory for users with extremely large Jellyfin libraries (tens or hundreds of thousands of items), potentially impacting browser performance.
*   **Direct DOM Manipulation:** The `js/script.js` file uses direct DOM manipulation and relies heavily on global variables. While effective for this application, this architecture can become challenging to scale or maintain for more complex projects compared to using modern frameworks.
*   **Error Handling:** Basic error handling is present (e.g., image loading errors, fetch errors in `jellyfin.js`), but comprehensive handling for all possible network issues or invalid inputs might require further refinement.
*   **Canvas Performance:** Compositing and redrawing on the HTML5 canvas might become slow with a very large number of high-resolution images or complex reflection settings, depending on the user's hardware.
*   **Browser Compatibility:** While using standard APIs, subtle differences in browser implementations of Canvas, Drag and Drop, or other features might exist.
*   **Jellyfin API Coverage:** The `Jellyfin` class only implements the specific API calls needed for this application's browsing and image fetching features. It is not a full-featured Jellyfin API client library.

## 🤝 Contributing

Contributions are welcome! If you find a bug, have a feature request, or want to contribute code, please refer to the project's guidelines (if available) or submit an issue or pull request on the GitHub repository.

## 📄 License

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

## 🚧 Work in Progress

This repository and its documentation are under active development. Features and structure may change.
