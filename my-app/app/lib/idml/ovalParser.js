import { parseGeometry, parseTransform, parseBaseShape } from "./utils";

/**
 * Parse oval element from IDML data
 * @param {Object} oval - IDML oval data
 * @returns {Object} Parsed oval element
 */
export function parseOval(oval) {
  // Log the oval properties for debugging
  console.log("Parsing Oval:", oval?.["@_Name"], "ID:", oval?.["@_Self"]);

  // Extract the path geometry for the oval
  const bounds = parseGeometry(oval?.Properties?.PathGeometry);

  // If bounds are not correctly parsed, create default elliptical bounds
  if (!bounds || !bounds.points || bounds.points.length === 0) {
    console.log("No points found for oval, using default ellipse dimensions");
    // Calculate width and height from transform or use defaults
    const transform = parseTransform(oval?.["@_ItemTransform"]);
    const width = 100; // Default width if we can't determine from the data
    const height = 70; // Default height if we can't determine from the data

    // Create a bounds object with default dimensions
    const defaultBounds = {
      x: 0,
      y: 0,
      width: width,
      height: height,
      // Empty points array so we know this is using default values
      points: [],
    };

    return {
      ...parseBaseShape(oval, "oval"),
      bounds: defaultBounds,
      transform,
      isDefaultOval: true, // Flag to indicate we're using default ellipse rendering
    };
  }

  const transform = parseTransform(oval?.["@_ItemTransform"]);
  const textPath = oval?.TextPath;

  console.log("Oval bounds:", bounds);

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
