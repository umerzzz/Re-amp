/**
 * Utility functions for IDML parsing
 */

/**
 * Parse transformation matrix from a string
 * @param {string} transformString - Transform string in the format "a b c d tx ty"
 * @returns {Object} Transform object with a, b, c, d, tx, ty properties
 */
export function parseTransform(transformString) {
  const values = String(transformString || "1 0 0 1 0 0")
    .split(" ")
    .map(Number);
  return {
    a: values[0] || 1,
    b: values[1] || 0,
    c: values[2] || 0,
    d: values[3] || 1,
    tx: values[4] || 0,
    ty: values[5] || 0,
  };
}

/**
 * Parse geometry data from IDML path geometry
 * @param {Object} pathGeometry - IDML path geometry object
 * @returns {Object|null} Parsed geometry object or null if invalid
 */
export function parseGeometry(pathGeometry) {
  // Check if pathGeometry exists and has the right structure
  if (!pathGeometry) {
    return null;
  }

  // Log the geometry type for debugging
  const geometryType = pathGeometry?.GeometryPathType || null;
  // shape debug log removed

  // Log the full pathGeometry structure for debugging
  if (typeof window !== "undefined" && window.DEBUG_IDML_SHAPES) {
    // shape debug log removed
  }

  // Get the path points
  const pts = pathGeometry?.GeometryPathType?.PathPointArray?.PathPointType;
  if (!pts) {
    // shape debug log removed

    // Check if we have GeometryBounds as fallback
    const geomBounds = pathGeometry?.GeometryBounds;
    if (geomBounds) {
      // shape debug log removed
      const bounds_str = String(geomBounds || "0 0 100 70");
      const [y1, x1, y2, x2] = bounds_str.split(" ").map(Number);
      if (isFinite(x2) && isFinite(x1) && isFinite(y2) && isFinite(y1)) {
        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          points: [], // No points available, but we have bounds
        };
      }
    }

    return null;
  }

  // Convert to array if it's a single point
  const array = Array.isArray(pts) ? pts : [pts];
  // shape debug log removed

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  // Process each point to find the bounding box
  for (const point of array) {
    const [x, y] = String(point?.["@_Anchor"] || "0 0")
      .split(" ")
      .map(Number);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    x: isFinite(minX) ? minX : 0,
    y: isFinite(minY) ? minY : 0,
    width: isFinite(maxX - minX) ? maxX - minX : 0,
    height: isFinite(maxY - minY) ? maxY - minY : 0,
    points: array.map((p) => ({
      anchor: String(p?.["@_Anchor"] || "0 0")
        .split(" ")
        .map(Number),
      leftDirection: String(p?.["@_LeftDirection"] || "0 0")
        .split(" ")
        .map(Number),
      rightDirection: String(p?.["@_RightDirection"] || "0 0")
        .split(" ")
        .map(Number),
    })),
  };
}

/**
 * Parse drop shadow properties
 * @param {Object} ds - Drop shadow settings object
 * @returns {Object|null} Drop shadow properties or null if not applicable
 */
export function parseDropShadow(ds) {
  if (!ds || ds?.["@_Mode"] !== "Drop") return null;
  return {
    offsetX: parseFloat(ds?.["@_XOffset"]) || 0,
    offsetY: parseFloat(ds?.["@_YOffset"]) || 0,
    blurRadius: parseFloat(ds?.["@_Size"]) || 0,
    color: ds?.["@_EffectColor"] || "rgba(0,0,0,0.5)",
  };
}

/**
 * Convert CMYK color values to RGB string
 * @param {string} space - Color space
 * @param {Array} values - Color values
 * @returns {string} RGB color string
 */
export function convertToRGB(space, values) {
  if (space === "CMYK" && Array.isArray(values) && values.length === 4) {
    const [c, m, y, k] = values.map((v) => (Number.isFinite(v) ? v / 100 : 0));
    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));
    return `rgb(${r}, ${g}, ${b})`;
  }
  return "rgb(0, 0, 0)";
}

/**
 * Convert various color spaces to CSS RGB
 * @param {string} space - Color space
 * @param {Array} values - Color values
 * @returns {string|null} CSS RGB color string or null if invalid
 */
export function convertToCssRGB(space, values) {
  const s = String(space || "").toUpperCase();
  if (s === "CMYK" && values?.length === 4) return convertToRGB("CMYK", values);
  if (s === "RGB" && values?.length === 3) {
    const [r, g, b] = values.map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
    );
    return `rgb(${r}, ${g}, ${b})`;
  }
  if ((s === "GRAY" || s === "GREY") && values?.length >= 1) {
    const g = Math.max(
      0,
      Math.min(255, Math.round((1 - values[0] / 100) * 255))
    );
    return `rgb(${g}, ${g}, ${g})`;
  }
  return null;
}

/**
 * Base shape parser with common properties
 * @param {Object} element - IDML element data
 * @param {string} type - Shape type identifier
 * @returns {Object} Basic shape object with common properties
 */
export function parseBaseShape(element, type) {
  return {
    type,
    id: element?.["@_Self"],
    name: element?.["@_Name"],
    visible: element?.["@_Visible"] !== "false",
    fillColor: element?.["@_FillColor"],
    fillTint:
      element?.["@_FillTint"] !== undefined && element?.["@_FillTint"] !== ""
        ? Number(element?.["@_FillTint"])
        : undefined,
    strokeColor: element?.["@_StrokeColor"],
    strokeWeight: parseFloat(element?.["@_StrokeWeight"]) || 0,
    strokeTint:
      element?.["@_StrokeTint"] !== undefined &&
      element?.["@_StrokeTint"] !== ""
        ? Number(element?.["@_StrokeTint"])
        : undefined,
  };
}

/**
 * Get a value from a nested path with optional chaining
 * @param {Object} obj - The object to get the value from
 * @param {string} path - Dot notation path
 * @param {any} defaultValue - Default value if path doesn't exist
 * @returns {any} The value at the path or the default value
 */
export function get(obj, path, defaultValue = undefined) {
  const travel = (regexp) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce(
        (res, key) => (res !== null && res !== undefined ? res[key] : res),
        obj
      );
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
}
