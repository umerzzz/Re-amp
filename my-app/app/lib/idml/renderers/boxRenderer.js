// Box renderer for IDML elements

import { applyElementStyles } from "../Utils/elementUtils.js";

/**
 * Render a box/rectangle element
 * @param {Object} element - Element object with bounds and styling
 * @param {Object} colors - Colors object for color resolution
 * @param {Object} offsets - Offset object with ox, oy properties
 * @returns {HTMLElement} - Rendered div element
 */
export function renderBox(element, colors, offsets) {
  const div = document.createElement("div");
  div.style.zIndex = "1";
  applyElementStyles(div, element, colors, offsets);
  return div;
}
