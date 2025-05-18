# Collection Cover Maker

A powerful web application that lets you create beautiful collection covers by combining multiple images into a single composite with professional effects. It features direct integration with Jellyfin media server, allowing you to easily access and use your media library images.

## Features

- **Jellyfin Integration**
  - Direct connection to your Jellyfin server
  - Browse and search your media libraries
  - Use movie posters and show artwork directly
  - Secure authentication support

- **Image Management**
  - Add multiple image slots
  - Drag and drop support
  - Local image upload
  - Random image selection from Jellyfin
  - Pin images to prevent changes
  - Reorder images easily

- **Professional Effects**
  - Customizable reflection effects
  - Blur control
  - Adjustable spacing
  - Overlay text with font customization
  - Opacity controls
  - Dynamic scaling

- **Export Options**
  - Export as high-quality PNG
  - Preview in new tab
  - Zoom functionality in preview

## Connecting to Jellyfin

1. Click the "Login to Jellyfin" button
2. Enter your Jellyfin server URL (e.g., `http://yourserver:8096`)
3. Provide your username and password
4. Click "Connect"

Once connected, you can:
- Browse your media libraries
- Search for specific titles
- Click on any poster to add it to your composition
- Use the random selection feature to discover new images

## Creating a Cover

1. Add image slots using the "+" button
2. Fill slots with images by:
   - Selecting from your Jellyfin library
   - Uploading local images
   - Pasting images from clipboard
   - Dragging and dropping
   - Using the random fill feature
3. Adjust the composition settings:
   - Modify reflection properties
   - Change spacing and blur
   - Add and customize overlay text
4. Export your creation as a PNG or preview in a new tab

## Tips

- Use the pin feature to lock important images in place
- Drag images between slots to reorder them
- Drag images from covers list to a slot, to load it.
- Adjust the poster scale to find the perfect fit
- Use the blur effect to create depth
- Experiment with reflection settings for different looks

## Browser Support

The application works best in modern browsers that support:
- Canvas API
- Drag and Drop API
- File API
- Modern CSS features

## Privacy & Security

- Your Jellyfin credentials are stored locally in your browser
- No data is sent to external servers except your Jellyfin instance
- All image processing happens in your browser
