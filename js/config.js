// ======================
// Global Variables
// ======================
const slotsImages = []; // Global array to store slotsImages for each slot

const dataLists = {};

let FONT_DATABASE = null;

const webSafeFonts = [
  "Arial", "Verdana", "Times New Roman", "Helvetica",
  "Georgia", "Courier New", "Brush Script MT"
]

window.Tabs = {}; // Will store tab elements

window.composite = {
  size: {
    width: 1920,
    height: 1080
  }
};

var doneLoading = false;

// ======================
// Config Object
// ======================

var Setup = {
  Sizes: {
    cover: {
      width: 480,
      height: 270,
      quality: 80,
    },
    poster: {
      width: 270,
      height: 480,
      quality: 60
    },
    square: {
      width: 1,
      height: 1,
      quality: 100
    },
    custom: {
      width: 1920,
      height: 1080,
      quality: 100
    }
  },
  Library: {
    loadedLibrary: null
  },
  Images: {
    loading: "images/loading.gif",
    error: "images/error.png",
  },
  loadingType: 'lazy',
  Settings: {
    textLayers: [],
    canvas: {
      composite: {},
      format: "cover",
      effects: []
    },
    export: {
      format: "png",
      jpegQuality: 0.95
    }
  },
  defaults: {
    composite: {
      "type": "line",
      "params": {}
    },
    shadow: {
      color: "#000000",
      blur: 5,
      offsetX: 5,
      offsetY: 5,
      enabled: true // ⭐️ ADDED enabled property
    },
    stroke: {
      color: "#000000",
      width: 2,
      opacity: 1,
      style: "rgba(0, 0, 0, 1)", // Will be built by updateTextSettings
      enabled: true // ⭐️ ADDED enabled property
    },
    effects: {}, 
    TextLayer: {
      overlayText: "Movies",
      font: {
        family: 'Arial',
        size: 327,
        color: '#ffffff',
        opacity: 0.8
      },
      fontStyle: "", // Will be built by updateTextSettings
      fillStyle: "", // Will be built by updateTextSettings
      position: {
        x: 0,
        y: 0,
        textAlign: "center",
        textBaseline: "middle",
        rotation: 0 // ⭐️ ADDED rotation property
      },
      strokes: [], // ⭐️ CHANGED to an array
      shadows: [], // ⭐️ CHANGED to an array
      effects: [],
      enabled: true // ⭐️ ADDED enabled property
    }
  }
}

Setup.Settings.textLayers = [
  JSON.parse(JSON.stringify(Setup.defaults.TextLayer))
]