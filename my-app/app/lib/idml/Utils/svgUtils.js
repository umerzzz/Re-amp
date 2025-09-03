// SVG-specific utilities for IDML rendering

import { cleanFontName } from "./fontUtils.js";
import { resolveSwatchRGB } from "./colorUtils.js";

/**
 * Generate SVG path data from polygon points
 * @param {Array} points - Array of point objects with anchor, leftDirection, rightDirection
 * @param {Object} bounds - Bounds object with x, y coordinates
 * @param {boolean} isPathOpen - Whether the path should be open or closed
 * @returns {string} - SVG path data string
 */
export function generatePathData(points, bounds, isPathOpen = false) {
  let pathData = "";

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const anchor = point.anchor;
    const leftControl = point.leftDirection;
    const rightControl = point.rightDirection;

    // Adjust coordinates relative to the bounds origin
    const x = anchor[0] - bounds.x;
    const y = anchor[1] - bounds.y;

    if (i === 0) {
      // Move to first point
      pathData += `M ${x} ${y} `;
    } else {
      const prevPoint = points[i - 1];
      const prevRightControl = prevPoint.rightDirection;
      const prevRightX = prevRightControl[0] - bounds.x;
      const prevRightY = prevRightControl[1] - bounds.y;

      const leftControlX = leftControl[0] - bounds.x;
      const leftControlY = leftControl[1] - bounds.y;

      // Detect if control points are different from anchor points
      const isPrevControlDifferent =
        Math.abs(prevRightX - (prevPoint.anchor[0] - bounds.x)) > 0.01 ||
        Math.abs(prevRightY - (prevPoint.anchor[1] - bounds.y)) > 0.01;
      const isCurrentControlDifferent =
        Math.abs(leftControlX - x) > 0.01 || Math.abs(leftControlY - y) > 0.01;

      if (isPrevControlDifferent || isCurrentControlDifferent) {
        // Bezier curve if control points are different from anchor points
        pathData += `C ${prevRightX} ${prevRightY}, ${leftControlX} ${leftControlY}, ${x} ${y} `;
      } else {
        // Line if control points match anchor points (straight line)
        pathData += `L ${x} ${y} `;
      }
    }
  }

  // Close path if it has more than 2 points and isn't explicitly marked as open
  if (points.length > 2 && !isPathOpen) {
    // Check if we need to add a bezier curve back to the first point
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    const firstAnchorX = firstPoint.anchor[0] - bounds.x;
    const firstAnchorY = firstPoint.anchor[1] - bounds.y;

    const lastRightControlX = lastPoint.rightDirection[0] - bounds.x;
    const lastRightControlY = lastPoint.rightDirection[1] - bounds.y;

    const firstLeftControlX = firstPoint.leftDirection[0] - bounds.x;
    const firstLeftControlY = firstPoint.leftDirection[1] - bounds.y;

    const isLastControlDifferent =
      Math.abs(lastRightControlX - (lastPoint.anchor[0] - bounds.x)) > 0.01 ||
      Math.abs(lastRightControlY - (lastPoint.anchor[1] - bounds.y)) > 0.01;

    const isFirstLeftControlDifferent =
      Math.abs(firstLeftControlX - firstAnchorX) > 0.01 ||
      Math.abs(firstLeftControlY - firstAnchorY) > 0.01;

    if (isLastControlDifferent || isFirstLeftControlDifferent) {
      // Use bezier curve to close the path
      pathData += `C ${lastRightControlX} ${lastRightControlY}, ${firstLeftControlX} ${firstLeftControlY}, ${firstAnchorX} ${firstAnchorY} Z`;
    } else {
      // Simple line to close the path
      pathData += "Z";
    }
  }

  return pathData;
}

/**
 * Generate SVG path data for oval shapes
 * @param {Array} points - Array of point objects with anchor, leftDirection, rightDirection
 * @param {Object} bounds - Bounds object with x, y coordinates
 * @returns {string} - SVG path data string for oval
 */
export function generateOvalPathData(points, bounds) {
  let pathData = "";

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const anchor = point.anchor;
    const leftControl = point.leftDirection;
    const rightControl = point.rightDirection;

    // Adjust coordinates relative to the bounds origin
    const x = anchor[0] - bounds.x;
    const y = anchor[1] - bounds.y;

    if (i === 0) {
      // Move to first point
      pathData += `M ${x} ${y} `;
    } else {
      const prevPoint = points[i - 1];
      const prevRightControl = prevPoint.rightDirection;
      const prevRightX = prevRightControl[0] - bounds.x;
      const prevRightY = prevRightControl[1] - bounds.y;

      const leftControlX = leftControl[0] - bounds.x;
      const leftControlY = leftControl[1] - bounds.y;

      // Always use bezier curves for ovals to get smooth curves
      pathData += `C ${prevRightX} ${prevRightY}, ${leftControlX} ${leftControlY}, ${x} ${y} `;
    }
  }

  // Close the path for ovals
  if (points.length > 2) {
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const firstAnchorX = firstPoint.anchor[0] - bounds.x;
    const firstAnchorY = firstPoint.anchor[1] - bounds.y;
    const lastRightControlX = lastPoint.rightDirection[0] - bounds.x;
    const lastRightControlY = lastPoint.rightDirection[1] - bounds.y;
    const firstLeftControlX = firstPoint.leftDirection[0] - bounds.x;
    const firstLeftControlY = firstPoint.leftDirection[1] - bounds.y;

    pathData += `C ${lastRightControlX} ${lastRightControlY}, ${firstLeftControlX} ${firstLeftControlY}, ${firstAnchorX} ${firstAnchorY} Z`;
  }

  return pathData;
}

/**
 * Apply styling to SVG shape element
 * @param {SVGElement} shapeElement - SVG element to style
 * @param {Object} element - Element object with styling properties
 * @param {Object} colors - Colors object for color resolution
 */
export function applySVGShapeStyling(shapeElement, element, colors) {
  // Apply fill styling
  if (element.fillColor) {
    let fillColor = resolveSwatchRGB(colors, element.fillColor);
    if (
      fillColor &&
      element.fillTint !== undefined &&
      element.fillTint !== null
    ) {
      fillColor = applyTint(fillColor, element.fillTint);
    }
    shapeElement.setAttribute("fill", fillColor || "none");
  } else {
    shapeElement.setAttribute("fill", "none");
  }

  // Apply stroke styling
  if (element.strokeWeight > 0 && element.strokeColor) {
    let strokeColor = resolveSwatchRGB(colors, element.strokeColor);
    if (
      strokeColor &&
      element.strokeTint !== undefined &&
      element.strokeTint !== null
    ) {
      strokeColor = applyTint(strokeColor, element.strokeTint);
    }
    shapeElement.setAttribute("stroke", strokeColor || "black");
    shapeElement.setAttribute("stroke-width", element.strokeWeight);
  } else {
    shapeElement.setAttribute("stroke", "none");
  }
}

/**
 * Apply tint to a color (helper function for SVG styling)
 * @param {string} rgbString - RGB color string
 * @param {number} tintPercent - Tint percentage
 * @returns {string} - Tinted color string
 */
function applyTint(rgbString, tintPercent) {
  if (!rgbString || typeof rgbString !== "string") return rgbString;
  const m = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (!m) return rgbString;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const t = Math.max(0, Math.min(100, Number(tintPercent)));
  const factor = t / 100;
  const tr = Math.round(255 - (255 - r) * factor);
  const tg = Math.round(255 - (255 - g) * factor);
  const tb = Math.round(255 - (255 - b) * factor);
  return `rgb(${tr}, ${tg}, ${tb})`;
}

/**
 * Append text on path to SVG element
 * @param {SVGElement} svg - SVG element to append text to
 * @param {SVGElement} pathElement - Path element for text to follow
 * @param {Object} textPathInfo - Text path information
 * @param {Object} story - Story object containing text content
 * @param {Object} colors - Colors object for color resolution
 */
export function appendTextOnPath(
  svg,
  pathElement,
  textPathInfo,
  story,
  colors
) {
  if (
    !story ||
    !story.paragraphs ||
    story.paragraphs.length === 0 ||
    !pathElement
  ) {
    return;
  }

  // Create a unique ID for the path
  const pathId = `text-path-${Math.random().toString(36).substr(2, 9)}`;
  pathElement.setAttribute("id", pathId);

  // If we're dealing with a polygon, we need to convert it to a path for text to follow
  if (pathElement.tagName.toLowerCase() === "polygon") {
    // Get polygon points
    const points = pathElement
      .getAttribute("points")
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y };
      });

    if (points.length > 0) {
      // Create a path element that follows the polygon outline
      const pathForText = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );

      // Generate path data from polygon points
      let pathData = `M ${points[0].x} ${points[0].y} `;
      for (let i = 1; i < points.length; i++) {
        pathData += `L ${points[i].x} ${points[i].y} `;
      }
      pathData += "Z";

      pathForText.setAttribute("d", pathData);
      pathForText.setAttribute("id", pathId);
      pathForText.style.fill = "none"; // Make the path invisible
      pathForText.style.stroke = "none";

      // Replace the original reference with the new path
      svg.appendChild(pathForText);
      pathElement = pathForText;
    }
  }

  // Create text element
  const textElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );

  // Create textPath element
  const textPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "textPath"
  );
  textPath.setAttribute("href", `#${pathId}`);

  // Handle alignment
  if (textPathInfo.alignment === "CenterAlign") {
    textPath.setAttribute("text-anchor", "middle");
    textPath.setAttribute("startOffset", "50%");
  } else if (textPathInfo.alignment === "RightAlign") {
    textPath.setAttribute("text-anchor", "end");
    textPath.setAttribute("startOffset", "100%");
  } else {
    // Default to left alignment
    textPath.setAttribute("startOffset", "0%");
  }

  // Handle text effect
  if (textPathInfo.effect === "RainbowPath") {
    // Rainbow effect could be simulated with gradients
    const gradient = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "linearGradient"
    );
    const gradientId = `rainbow-${Math.random().toString(36).substr(2, 9)}`;
    gradient.setAttribute("id", gradientId);

    // Add rainbow stops
    const rainbowColors = [
      "#ff0000",
      "#ff7f00",
      "#ffff00",
      "#00ff00",
      "#0000ff",
      "#4b0082",
      "#8b00ff",
    ];
    rainbowColors.forEach((color, i) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", `${i * (100 / (rainbowColors.length - 1))}%`);
      stop.setAttribute("stop-color", color);
      gradient.appendChild(stop);
    });

    svg.appendChild(gradient);
    textPath.setAttribute("fill", `url(#${gradientId})`);
  }

  // Add text content from story
  let combinedText = "";
  for (const para of story.paragraphs) {
    for (const span of para.spans) {
      combinedText += span.text || "";
    }
  }

  textPath.textContent = combinedText;

  // Apply font properties from the first span (simplification)
  if (
    story.paragraphs[0] &&
    story.paragraphs[0].spans &&
    story.paragraphs[0].spans[0]
  ) {
    const span = story.paragraphs[0].spans[0];
    if (span.font) {
      const cleanedFont = cleanFontName(span.font);
      textPath.setAttribute("font-family", cleanedFont);
    }
    const pointSize =
      typeof span.pointSize === "number" ? span.pointSize : span.fontSize;
    if (pointSize) textPath.setAttribute("font-size", `${pointSize}pt`);
    if (span.fillColor) {
      const color = resolveSwatchRGB(colors, span.fillColor);
      if (color) textPath.setAttribute("fill", color);
    }
  }

  textElement.appendChild(textPath);
  svg.appendChild(textElement);
}
