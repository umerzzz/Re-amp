import { parseGeometry, parseTransform, parseBaseShape } from "./utils";

/**
 * Parse polygon element from IDML data
 * @param {Object} polygon - IDML polygon data
 * @returns {Object} Parsed polygon element
 */
export function parsePolygon(polygon) {
  const bounds = parseGeometry(polygon?.Properties?.PathGeometry);
  const transform = parseTransform(polygon?.["@_ItemTransform"]);
  const textPath = polygon?.TextPath;

  return {
    ...parseBaseShape(polygon, "polygon"),
    bounds,
    transform,
    isPathOpen:
      polygon?.Properties?.PathGeometry?.GeometryPathType?.["@_PathOpen"] ===
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
