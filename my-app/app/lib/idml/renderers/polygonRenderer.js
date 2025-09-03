// Polygon renderer for IDML elements

import { applyElementStyles } from "../Utils/elementUtils.js";
import {
  generatePathData,
  applySVGShapeStyling,
  appendTextOnPath,
} from "../Utils/svgUtils.js";
import { renderBox } from "./boxRenderer.js";
import { renderOval } from "./ovalRenderer.js";

/**
 * Render a polygon element
 * @param {Object} element - Element object with bounds and styling
 * @param {Object} colors - Colors object for color resolution
 * @param {Object} stories - Stories object for text on path
 * @param {Object} offsets - Offset object with ox, oy properties
 * @returns {HTMLElement} - Rendered div element containing SVG
 */
export function renderPolygon(element, colors, stories, offsets) {
  // Create a container div to hold the SVG
  const containerDiv = document.createElement("div");
  containerDiv.style.position = "absolute";
  containerDiv.style.zIndex = "2";

  // Add shape type attribute
  containerDiv.setAttribute("data-shape-type", element.type || "unknown");

  // Extract points data from the polygon
  if (
    !element.bounds ||
    !element.bounds.points ||
    element.bounds.points.length === 0
  ) {
    // If this is an oval type, render as ellipse instead of rectangle
    if (element.type === "oval") {
      return renderOval(element, colors, stories, offsets);
    }

    // For other Bézier-like shapes, try to create a basic shape if we have bounds
    if (
      element.bounds &&
      (element.bounds.width > 0 || element.bounds.height > 0)
    ) {
      const basicDiv = renderBox(element, colors, offsets);
      basicDiv.setAttribute("data-fallback", "bounds-only");
      basicDiv.setAttribute("data-original-type", element.type || "unknown");
      return basicDiv;
    }

    // For other shapes, fallback to rectangle
    const fallbackBox = renderBox(element, colors, offsets);
    fallbackBox.setAttribute("data-fallback", "true");
    fallbackBox.setAttribute("data-original-type", element.type || "unknown");
    return fallbackBox;
  }

  const points = element.bounds.points;

  // Compute point-space bounding box relative to element bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const pt of points) {
    const px = pt.anchor[0] - element.bounds.x;
    const py = pt.anchor[1] - element.bounds.y;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxX)) maxX = element.bounds.width || 0;
  if (!Number.isFinite(maxY)) maxY = element.bounds.height || 0;

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  // Add a debug class to help identify the shape type
  containerDiv.className = `idml-polygon shape-${points.length}-points`;

  // Create SVG element sized to the polygon point bounding box
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", `${width}pt`);
  svg.setAttribute("height", `${height}pt`);
  svg.style.position = "absolute";
  svg.style.overflow = "visible"; // Allow paths to extend beyond SVG bounds if needed

  // Define a tight viewBox around the normalized shape (no padding)
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // Check if path is open or closed
  const isPathOpen = element.isPathOpen === true;

  // Special case for triangles and other simple polygons with straight lines only
  const isSimplePolygon = points.every((point) => {
    // Check if all control points are the same as anchor points (straight lines)
    const anchor = point.anchor;
    const leftDirection = point.leftDirection;
    const rightDirection = point.rightDirection;

    return (
      anchor[0] === leftDirection[0] &&
      anchor[1] === leftDirection[1] &&
      anchor[0] === rightDirection[0] &&
      anchor[1] === rightDirection[1]
    );
  });

  if (isSimplePolygon) {
    // For simple polygons, use the simpler polygon notation
    const polygonPoints = points
      .map((point) => {
        const x = point.anchor[0] - element.bounds.x - minX;
        const y = point.anchor[1] - element.bounds.y - minY;
        return `${x},${y}`;
      })
      .join(" ");

    const polygon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    polygon.setAttribute("points", polygonPoints);

    // Apply styling to the polygon
    applySVGShapeStyling(polygon, element, colors);

    svg.appendChild(polygon);
  } else {
    // For complex shapes with curves, use the path element
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Generate the SVG path data from the polygon points
    const pathData = generatePathData(points, element.bounds, isPathOpen);
    path.setAttribute("d", pathData);

    // Apply styling
    applySVGShapeStyling(path, element, colors);

    svg.appendChild(path);
  }

  // Add the SVG to the container
  containerDiv.appendChild(svg);

  // Add debug info if needed
  if (typeof window !== "undefined" && window.DEBUG_IDML_SHAPES) {
    const debugInfo = document.createElement("div");
    debugInfo.style.position = "absolute";
    debugInfo.style.top = "0";
    debugInfo.style.left = "0";
    debugInfo.style.background = "rgba(255,255,255,0.8)";
    debugInfo.style.fontSize = "10px";
    debugInfo.style.padding = "2px";
    debugInfo.style.pointerEvents = "none";
    debugInfo.textContent = `Points: ${points.length}, ${
      isSimplePolygon ? "Simple" : "Complex"
    }`;
    containerDiv.appendChild(debugInfo);
  }

  // Apply element styles to position the container
  // Shift container by minX/minY so normalized path stays visually aligned
  const normalizedOffsets = {
    ox: (offsets?.ox || 0) + minX,
    oy: (offsets?.oy || 0) + minY,
  };
  applyElementStyles(containerDiv, element, colors, normalizedOffsets);

  // Ensure container sizing matches the polygon content, not original bounds
  containerDiv.style.width = "auto";
  containerDiv.style.height = "auto";
  containerDiv.style.minWidth = `${width}pt`;
  containerDiv.style.minHeight = `${height}pt`;

  // Handle text on path if present
  if (
    element.textPath &&
    element.textPath.storyId &&
    stories &&
    stories[element.textPath.storyId]
  ) {
    appendTextOnPath(
      svg,
      svg.querySelector("path") || svg.querySelector("polygon"), // Use either path or polygon
      element.textPath,
      stories[element.textPath.storyId],
      colors
    );
  }

  return containerDiv;
}
