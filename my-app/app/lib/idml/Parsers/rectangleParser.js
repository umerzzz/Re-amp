import { parseGeometry, parseTransform, parseBaseShape } from "../utils.js";

/**
 * Parse rectangle element from IDML data
 * @param {Object} rect - IDML rectangle data
 * @returns {Object} Parsed rectangle element
 */
export function parseRectangle(rect) {
  const bounds = parseGeometry(rect?.Properties?.PathGeometry);
  const transform = parseTransform(rect?.["@_ItemTransform"]);

  return {
    ...parseBaseShape(rect, "rectangle"),
    bounds,
    transform,
  };
}
