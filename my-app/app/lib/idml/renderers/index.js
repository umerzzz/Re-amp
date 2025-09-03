// Main renderer module that coordinates all shape renderers

import { renderBox } from "./boxRenderer.js";
import { renderOval } from "./ovalRenderer.js";
import { renderPolygon } from "./polygonRenderer.js";
import { renderTextFrame } from "./textFrameRenderer.js";

/**
 * Create an element by delegating to the appropriate renderer
 * @param {Object} element - Element object to render
 * @param {Object} colors - Colors object for color resolution
 * @param {Object} stories - Stories object for text content
 * @param {Object} offsets - Offset object with ox, oy properties
 * @param {Object} parser - Parser object for style resolution
 * @returns {HTMLElement|null} - Rendered element or null if type not supported
 */
export function createElement(element, colors, stories, offsets, parser) {
  switch (element.type) {
    case "rectangle":
      return renderBox(element, colors, offsets);
    case "textframe":
      return renderTextFrame(element, colors, stories, offsets, parser);
    case "polygon":
      return renderPolygon(element, colors, stories, offsets);
    case "oval":
      return renderOval(element, colors, stories, offsets, parser);
    default:
      return null;
  }
}

// Export individual renderers for direct use if needed
export { renderBox, renderOval, renderPolygon, renderTextFrame };
