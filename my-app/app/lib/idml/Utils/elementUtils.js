// Element utilities for IDML rendering

import { resolveSwatchRGB, applyTint } from "./colorUtils.js";

/**
 * Apply element styles to a DOM element
 * @param {HTMLElement} domElement - DOM element to style
 * @param {Object} element - Element object with styling properties
 * @param {Object} colors - Colors object for color resolution
 * @param {Object} offsets - Offset object with ox, oy properties
 */
export function applyElementStyles(
  domElement,
  element,
  colors,
  offsets = { ox: 0, oy: 0 }
) {
  domElement.style.position = "absolute";
  domElement.style.boxSizing = "border-box";

  // Calculate the total transform by combining element transform with parent transform
  let totalTransform = element.transform || {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: 0,
    ty: 0,
  };

  if (element.parentTransform) {
    // Combine parent transform with element transform
    const parent = element.parentTransform;
    const child = totalTransform;

    totalTransform = {
      a: parent.a * child.a + parent.c * child.b,
      b: parent.b * child.a + parent.d * child.b,
      c: parent.a * child.c + parent.c * child.d,
      d: parent.b * child.c + parent.d * child.d,
      tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
      ty: parent.b * child.tx + parent.d * child.ty + parent.ty,
    };
  }

  const x = (element.bounds?.x || 0) + totalTransform.tx + (offsets.ox || 0);
  const y = (element.bounds?.y || 0) + totalTransform.ty + (offsets.oy || 0);

  domElement.style.left = `${x}pt`;
  domElement.style.top = `${y}pt`;
  domElement.style.width = `${element.bounds?.width || 0}pt`;
  domElement.style.height = `${element.bounds?.height || 0}pt`;

  // Positioning debug log
  try {
    console.debug("[IDML:position]", {
      type: element.type,
      name: element.name,
      left: x,
      top: y,
      width: element.bounds?.width || 0,
      height: element.bounds?.height || 0,
      offsets,
      bounds: element.bounds,
      transform: element.transform || null,
      parentTransform: element.parentTransform || null,
      totalTransform,
    });
  } catch (_) {}

  // Apply background color only for non-SVG elements
  if (
    element.type !== "polygon" &&
    element.type !== "oval" &&
    element.fillColor
  ) {
    let base = resolveSwatchRGB(colors, element.fillColor);
    if (element.fillTint !== undefined && element.fillTint !== null) {
      base = applyTint(base, element.fillTint);
    }
    if (base) domElement.style.backgroundColor = base;
  }

  // Apply border only for non-SVG elements
  if (element.type !== "polygon" && element.type !== "oval") {
    if (element.strokeWeight > 0 && element.strokeColor) {
      let base = resolveSwatchRGB(colors, element.strokeColor);
      if (
        base &&
        element.strokeTint !== undefined &&
        element.strokeTint !== null
      ) {
        base = applyTint(base, element.strokeTint);
      }
      if (base)
        domElement.style.border = `${element.strokeWeight}pt solid ${base}`;
    } else if (element.type === "rectangle") {
      domElement.style.border = "1px dashed red";
    }
  }

  if (element.dropShadow) {
    const ds = element.dropShadow;
    domElement.style.filter = `drop-shadow(${ds.offsetX}pt ${ds.offsetY}pt ${ds.blurRadius}pt ${ds.color})`;
  }

  // Apply the total transform matrix (excluding translation which we handle via left/top)
  if (
    totalTransform.a !== 1 ||
    totalTransform.b !== 0 ||
    totalTransform.c !== 0 ||
    totalTransform.d !== 1
  ) {
    domElement.style.transform = `matrix(${totalTransform.a}, ${totalTransform.b}, ${totalTransform.c}, ${totalTransform.d}, 0, 0)`;
  }

  if (element.visible === false) domElement.style.display = "none";
}

/**
 * Compute offsets for elements to handle negative coordinates
 * @param {Array} elements - Array of element objects
 * @returns {Object} - Offset object with ox, oy properties
 */
export function computeOffsets(elements) {
  let minX = 0;
  let minY = 0;
  for (const el of elements || []) {
    const x = (el?.bounds?.x || 0) + (el?.transform?.tx || 0);
    const y = (el?.bounds?.y || 0) + (el?.transform?.ty || 0);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return { ox: minX < 0 ? -minX : 0, oy: minY < 0 ? -minY : 0 };
}
