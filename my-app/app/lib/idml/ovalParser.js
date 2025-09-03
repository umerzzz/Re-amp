import { parseGeometry, parseTransform, parseBaseShape } from "./utils";

/**
 * Parse oval element from IDML data
 * @param {Object} oval - IDML oval data
 * @returns {Object} Parsed oval element
 */
export function parseOval(oval) {
  // shape debug log removed

  // Extract the path geometry for the oval
  const bounds = parseGeometry(oval?.Properties?.PathGeometry);

  // If bounds are not correctly parsed, create default elliptical bounds
  if (!bounds || !bounds.points || bounds.points.length === 0) {
    // shape debug log removed

    // Calculate width and height from transform matrix
    const transform = parseTransform(oval?.["@_ItemTransform"]);

    // Try to extract width and height from the transform matrix
    // The transform matrix values a and d often contain scale information
    let width = Math.abs(transform.a) || 100;
    let height = Math.abs(transform.d) || 70;

    // Try to get dimensions from GeometryBounds if available
    const geomBounds = oval?.Properties?.GeometryBounds;
    if (geomBounds) {
      const bounds_str = String(geomBounds || "0 0 100 70");
      const [y1, x1, y2, x2] = bounds_str.split(" ").map(Number);
      if (isFinite(x2) && isFinite(x1) && isFinite(y2) && isFinite(y1)) {
        width = Math.abs(x2 - x1);
        height = Math.abs(y2 - y1);
        // shape debug log removed
      }
    }

    // Create a bounds object with calculated or default dimensions
    const defaultBounds = {
      x: 0,
      y: 0,
      width: Math.max(width, 1),
      height: Math.max(height, 1),
      // Empty points array so we know this is using default values
      points: [],
    };

    // shape debug log removed

    return {
      ...parseBaseShape(oval, "oval"),
      bounds: defaultBounds,
      transform,
      isDefaultOval: true, // Flag to indicate we're using default ellipse rendering
    };
  }

  const transform = parseTransform(oval?.["@_ItemTransform"]);
  const textPath = oval?.TextPath;

  // shape debug log removed

  return {
    ...parseBaseShape(oval, "oval"),
    bounds,
    transform,
    isPathOpen:
      oval?.Properties?.PathGeometry?.GeometryPathType?.["@_PathOpen"] ===
      "true",
    textPath: textPath
      ? {
          storyId: textPath?.["@_ParentStory"],
          alignment: textPath?.["@_PathAlignment"],
          effect: textPath?.["@_PathEffect"],
        }
      : null,
  };
}
