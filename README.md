# Collection Cover Maker

## Overview

Collection Cover Maker is a web-based application that allows you to design and generate custom cover images for your media collections. Whether you're organizing movies, TV shows, or music, this tool helps you create visually appealing covers with various customization options. It can be used as a standalone tool or integrated with Jellyfin to fetch images from your media library.

## Features

*   **Create Composite Images:** Combine multiple images into a single cover.
*   **Flexible Image Sourcing:**
    *   Load images from your local computer.
    *   Drag and drop images directly into slots.
    *   Paste images from your clipboard.
*   **Jellyfin Integration:**
    *   Connect to your Jellyfin server.
    *   Browse your Jellyfin libraries.
    *   Fetch existing covers or images directly from your Jellyfin instance to use in your composite image.
    *   Randomize images from your Jellyfin library to fill slots.
*   **Customization Options:**
    *   **Text Overlay:** Add custom text with adjustable font, size, color, boldness, and opacity.
    *   **Image Layout:**
        *   Define the number of image slots.
        *   Adjust margins between images.
        *   Apply blur effects to image reflections.
        *   Control reflection distance and scale.
        *   Adjust overall poster scale.
    *   **Overlay Effects:** Control the opacity of a global overlay on the composite image.
*   **Image Management:**
    *   Pin images to slots to prevent them from being changed.
    *   Easily clear or delete individual image slots.
    *   Move images between slots.
    *   Open individual slot images or the final composite image in a new tab.
*   **Export:** Download your created cover as a PNG file.
*   **Persistent Settings:** Your settings (like Jellyfin server details, UI preferences) are saved in your browser's local storage for convenience.

## How to Use

1.  **Open the Application:** Access the Collection Cover Maker by opening the `index.html` file in your web browser or by visiting the live application URL (if available).

2.  **Adding Images to Slots:**
    *   **Image Slots Tab:** This is where you manage the images that will form your composite cover.
    *   **Add Slots:** Click the `+` icon in the "Image Slots" controls to add more image slots. The canvas will automatically adjust to accommodate the number of slots.
    *   **Load Local Images:**
        *   Click the "Load Local Image" icon (looks like a picture) on an individual slot to open a file dialog and select an image from your computer.
        *   Alternatively, you can drag and drop an image file from your computer directly onto a slot.
        *   You can also paste an image from your clipboard (Ctrl+V or Cmd+V).
    *   **Using Jellyfin Images (Optional):**
        *   **Login:** Click the "Login to Jellyfin" button. Enter your Jellyfin server URL, username, and password. Click "Connect".
        *   **Browse Libraries:** Once connected, the right-side panel will activate. Click the "Load Libraries" icon (looks like a film strip) to display your Jellyfin libraries.
        *   **Select a Library:** Click on a library banner to view its items.
        *   **Search:** Use the search bar to find specific items within the selected library.
        *   **Add to Slot:** Click on an item's cover in the Jellyfin panel to add it to the next available image slot on the left. You can also drag and drop covers from the Jellyfin panel to a specific slot.
        *   **Randomize:** Use the "Randomize Slot Image" icon (circular arrows) on a slot to fill it with a random image from your currently selected Jellyfin library/search. Use the "Fill Slots Randomly" icon in the "Image Slots" controls to fill all unpinned slots.

3.  **Arranging and Managing Images:**
    *   **Move Images:** Drag and drop a slot to reorder it. Alternatively, use the up/down arrow icons on each slot.
    *   **Pin Images:** Click the thumbtack icon on a slot to "pin" an image. Pinned images won't be affected by "Fill Slots Randomly" or if you try to add another image to a filled slot without a specific target.
    *   **Clear/Delete Slots:**
        *   Click the eraser icon on a slot to clear its image.
        *   Click the trash can icon on a slot to delete the slot itself.
        *   Use the "Clear All Slots" icon (large eraser) in the "Image Slots" controls to clear images from all slots.
    *   **Open in New Tab:** Click the "Open in New Tab" icon (box with an arrow) on a slot to view that individual image in a new browser tab.

4.  **Customizing the Composite Image (Settings Tab):**
    *   Navigate to the **Settings** tab on the left panel.
    *   **Overlay Text:**
        *   `Overlay Text`: Enter the text you want to display on the cover.
        *   `Font`: Choose a font style.
        *   `Font Size (px)`: Set the size of the text.
        *   `Font Color`: Pick a color for the text.
        *   `Bold`: Check to make the text bold.
        *   `Font Opacity (0-1)`: Adjust the transparency of the text.
    *   **Image Styling:**
        *   `Margin Size (px)`: Set the space between images on the canvas.
        *   `Blur Size (px)`: Control the amount of blur for the image reflections.
        *   `Reflex Distance (0-1)`: Adjust how far the reflection extends.
        *   `Reflex Scale (0-1)`: Control the intensity/visibility of the reflection.
        *   `Overlay Opacity (0-1)`: Set the transparency of the dark overlay on the entire composite image.
        *   `Poster Scale (0-10)`: Adjust the vertical scale of the primary images.

5.  **Previewing the Composite Image:**
    *   The central canvas area displays a live preview of your composite image as you make changes.

6.  **Exporting Your Cover:**
    *   Once you are satisfied with your design:
        *   Click the **"Export Composite Image"** button to download the cover as a PNG file.
        *   Click the **"Open Composite in New Tab"** button to view the full-resolution composite image in a new browser tab.

7.  **Managing Settings:**
    *   **Clean Saved Memory:** Click this button in the header to clear all saved settings from your browser's local storage (Jellyfin credentials, UI settings, etc.) and restore the application to its default state.

## Local Setup

This project is a static web application and does not require a complex build process or backend server to run locally.

**Prerequisites:**

*   A modern web browser (e.g., Chrome, Firefox, Edge, Safari).
*   Git (optional, for cloning the repository).

**Steps:**

1.  **Get the Code:**
    *   **Clone the repository (recommended):**
        ```bash
        git clone https://github.com/jeffersoncgo/CoverMaker.git
        cd CoverMaker
        ```
    *   **Or Download ZIP:** Download the project ZIP file from GitHub and extract it.

2.  **Run the Application:**
    *   Navigate to the project directory.
    *   Open the `index.html` file in your web browser.

That's it! The application should now be running locally.

## Live Application

You can access the live version of Collection Cover Maker here:
[https://jeffersoncgo.github.io/CoverMaker/](https://jeffersoncgo.github.io/CoverMaker/)

## Contributing

Contributions are welcome! If you have ideas for new features, find a bug, or want to improve the code, please feel free to:

*   **Open an Issue:** Report bugs or suggest features by opening an issue on the GitHub repository.
*   **Submit a Pull Request:** If you've made changes you'd like to contribute, please fork the repository and submit a pull request with a clear description of your changes.

Please try to follow the existing code style and add comments where necessary.

## License

This project is currently not distributed under a specific license. Please refer to the repository owner for licensing information or consider adding a `LICENSE` file to the project.
