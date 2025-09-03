// Main utility functions for rendering IDML elements in React
// This file now serves as the main entry point, importing from modularized utilities

// Import font utilities
export {
  cleanFontName,
  extractFontFamily,
  getFontDirectoryPath,
  loadCustomFonts,
} from "./idml/Utils/fontUtils.js";

// Import color utilities
export {
  pickSwatchRGB,
  resolveSwatchRGB,
  cmykToRgbCss,
  applyTint,
} from "./idml/Utils/colorUtils.js";

// Import element utilities
export {
  applyElementStyles,
  computeOffsets,
} from "./idml/Utils/elementUtils.js";

// Import renderer functions
export {
  createElement,
  renderBox,
  renderOval,
  renderPolygon,
  renderTextFrame,
} from "./idml/renderers/index.js";
