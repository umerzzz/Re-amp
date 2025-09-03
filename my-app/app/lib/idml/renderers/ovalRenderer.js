// Oval renderer for IDML elements

import { applyElementStyles } from "../Utils/elementUtils.js";
import {
  generateOvalPathData,
  applySVGShapeStyling,
} from "../Utils/svgUtils.js";

/**
 * Render an oval element
 * @param {Object} element - Element object with bounds and styling
 * @param {Object} colors - Colors object for color resolution
 * @param {Object} stories - Stories object (unused for ovals)
 * @param {Object} offsets - Offset object with ox, oy properties
 * @returns {HTMLElement} - Rendered div element containing SVG
 */
export function renderOval(element, colors, stories, offsets) {
  // Create a container div to hold the SVG
  const containerDiv = document.createElement("div");
  containerDiv.style.position = "absolute";
  containerDiv.style.zIndex = "2";
  containerDiv.setAttribute("data-shape-type", "oval");

  // Get dimensions from the element
  let width = Math.max(element.bounds?.width || 0, 1);
  let height = Math.max(element.bounds?.height || 0, 1);

  // If bounds are very small or zero, try to get dimensions from transform
  if (width <= 1 || height <= 1) {
    if (element.transform) {
      const transformWidth = Math.abs(element.transform.a) || 0;
      const transformHeight = Math.abs(element.transform.d) || 0;
      if (transformWidth > 1) width = transformWidth;
      if (transformHeight > 1) height = transformHeight;
    }
  }

  // Create SVG element
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", `${width}pt`);
  svg.setAttribute("height", `${height}pt`);
  svg.style.position = "absolute";
  svg.style.overflow = "visible";

  // Define a viewBox
  const padding = 10;
  svg.setAttribute(
    "viewBox",
    `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`
  );

  // For ovals, use path data to create accurate shape based on Bézier curves
  const shapeElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );

  // Generate path data from points
  const points = element.bounds.points;
  const pathData = generateOvalPathData(points, element.bounds);
  shapeElement.setAttribute("d", pathData);

  // Apply styling to the shape element
  applySVGShapeStyling(shapeElement, element, colors);

  svg.appendChild(shapeElement);
  containerDiv.appendChild(svg);

  // Add debug info
  if (typeof window !== "undefined" && window.DEBUG_IDML_SHAPES) {
    const debugInfo = document.createElement("div");
    debugInfo.style.position = "absolute";
    debugInfo.style.top = "0";
    debugInfo.style.left = "0";
    debugInfo.style.background = "rgba(255,255,255,0.8)";
    debugInfo.style.fontSize = "10px";
    debugInfo.style.padding = "2px";
    debugInfo.style.pointerEvents = "none";
    debugInfo.textContent = `Oval: ${width}×${height} (${
      element.bounds?.points?.length || 0
    } pts)`;
    containerDiv.appendChild(debugInfo);
  }

  // Apply element styles to position the container
  applyElementStyles(containerDiv, element, colors, offsets);

  // For ovals, override the width/height constraints to allow natural ellipse shape
  containerDiv.style.width = "auto";
  containerDiv.style.height = "auto";
  containerDiv.style.minWidth = `${width}pt`;
  containerDiv.style.minHeight = `${height}pt`;

  return containerDiv;
}
