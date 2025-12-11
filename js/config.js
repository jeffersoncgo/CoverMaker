// ======================
// Global Variables
// ======================
const slotsImages = []; // Global array to store slotsImages for each slot

const dataLists = {};

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
  defaults: {
    "composite": {
      "type": "line",
      "params": {
        "salt": 76
      },
      "enabled": true
    },
    effects: {},
    textLayers: {
      "font": {
        "family": "Bangers",
        "weight": "lighter",
        "style": "normal",
        "size": 362,
        "color": "#ffffff",
        "opacity": 1
      },
      "position": {
        "textAlign": "center",
        "textBaseline": "middle",
        "x": 0,
        "y": 0,
        "rotation": 0
      },
      "overlayText": "MOVIES",
      "enabled": true,
      "fontStyle": "normal lighter 362px \"Bangers\"",
      "fillStyle": "rgba(255, 255, 255, 1)",
      "effects": [
        {
          "type": "outline",
          "enabled": true,
          "params": {
            "color": "#000000",
            "thickness": 10.5
          }
        },
        {
          "type": "longShadow",
          "enabled": true,
          "params": {
            "color": "#000000",
            "blur": 2,
            "length": 48,
            "angle": 43,
            "opacity": 1
          }
        },
        {
          "type": "outline",
          "enabled": true,
          "params": {
            "color": "#ffffff",
            "thickness": 12
          }
        }
      ]
    },
    customFonts: {}
  },
  Export: {
    Project: {
      Images: {
        format: "webp",
        quality: 0.95
      }
    },
    Canvas: {
      format: "png",
      quality: 1.0
    }
  }
}

var projectConfig = {
  textLayers: [
    {
      "font": {
        "family": "Bangers",
        "weight": "lighter",
        "style": "normal",
        "size": 362,
        "color": "#ffffff",
        "opacity": 1
      },
      "position": {
        "textAlign": "center",
        "textBaseline": "middle",
        "x": 0,
        "y": 0,
        "rotation": 0
      },
      "id": "layer_1",
      "overlayText": "MOVIES",
      "enabled": true,
      "fontStyle": "normal lighter 362px \"Bangers\"",
      "fillStyle": "rgba(255, 255, 255, 1)",
      "effects": [
        {
          "type": "outline",
          "enabled": true,
          "params": {
            "color": "#000000",
            "thickness": 10.5
          }
        },
        {
          "type": "longShadow",
          "enabled": true,
          "params": {
            "color": "#000000",
            "blur": 2,
            "length": 48,
            "angle": 43,
            "opacity": 1
          }
        },
        {
          "type": "outline",
          "enabled": true,
          "params": {
            "color": "#ffffff",
            "thickness": 12
          }
        }
      ]
    }
  ],
  canvas: {
    "type": "line",
    "format": "cover",
    "opacity": 0,
    "overlayColorStart": "#000000",
    "overlayColorStartRGB": {
        "r": 0,
        "g": 0,
        "b": 0
    },
    "overlayColorEnd": "#000000",
    "overlayColorEndRGB": {
        "r": 0,
        "g": 0,
        "b": 0
    },
    "overlayOpacityStart": 0.1,
    "overlayOpacityEnd": 0.4,
    "reflectionDistance": 0.7,
    "reflectionScale": 0.8,
    "baseScale": 1.4,
    "blurAmount": 5,
    "spacing": 1,
    "salt": 3,
    "composite": {
        "type": "line",
        "params": {
            "enableReflection": true,
            "baseScale": 1.35,
            "spacing": 3,
            "salt": 0,
            "reflectionDistance": 0.68,
            "reflectionScale": 0.87,
            "blurAmount": 3.5,
            "startColor": "#000000",
            "endColor": "#000000",
            "startOpacity": 0.1,
            "endOpacity": 1
        },
        "enabled": true
    },
    "effects": [
        {
            "type": "vignette",
            "params": {
                "intensity": 0.78
            },
            "enabled": true
        },
        {
            "type": "overlay",
            "params": {
                "startColor": "#000000",
                "startOpacity": 0.05,
                "endColor": "#000000",
                "endOpacity": 0.14
            },
            "enabled": true
        },
        {
            "type": "scanLines",
            "params": {
                "opacity": 0.53,
                "density": 10
            },
            "enabled": true
        }
    ]
}
};

projectConfig.textLayers = [
  JSON.parse(JSON.stringify(Setup.defaults.textLayers))
]