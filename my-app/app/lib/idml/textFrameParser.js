import {
  parseGeometry,
  parseTransform,
  parseBaseShape,
  parseDropShadow,
} from "./utils";

/**
 * Parse text frame element from IDML data
 * @param {Object} frame - IDML text frame data
 * @returns {Object} Parsed text frame element
 */
export function parseTextFrame(frame) {
  const bounds = parseGeometry(frame?.Properties?.PathGeometry);
  const transform = parseTransform(frame?.["@_ItemTransform"]);
  const storyId = frame?.["@_ParentStory"];

  const tfp =
    frame?.TextFramePreference || frame?.Properties?.TextFramePreference || {};

  const columnCount = parseInt(tfp?.["@_TextColumnCount"]) || 1;
  const columnGutter = parseFloat(tfp?.["@_TextColumnGutter"]) || 0;
  const verticalJustification = tfp?.["@_VerticalJustification"] || null; // TopAlign, CenterAlign, BottomAlign, JustifyAlign

  // Insets can be compound or individual
  const topInset = parseFloat(tfp?.["@_TopInset"]) || null;
  const leftInset = parseFloat(tfp?.["@_LeftInset"]) || null;
  const bottomInset = parseFloat(tfp?.["@_BottomInset"]) || null;
  const rightInset = parseFloat(tfp?.["@_RightInset"]) || null;
  const insetSpacing = (tfp?.["@_InsetSpacing"] || "").trim();

  let insets = null;
  if (
    topInset !== null ||
    leftInset !== null ||
    bottomInset !== null ||
    rightInset !== null
  ) {
    insets = {
      top: topInset || 0,
      right: rightInset || 0,
      bottom: bottomInset || 0,
      left: leftInset || 0,
    };
  } else if (insetSpacing) {
    const parts = insetSpacing.split(" ").map((n) => parseFloat(n) || 0);
    // Expect up to 4 values: top left bottom right
    insets = {
      top: parts[0] || 0,
      left: parts[1] || 0,
      bottom: parts[2] || parts[0] || 0,
      right: parts[3] || parts[1] || 0,
    };
  }

  return {
    ...parseBaseShape(frame, "textframe"),
    bounds,
    transform,
    storyId,
    dropShadow: parseDropShadow(frame?.TransparencySetting?.DropShadowSetting),
    textFramePreferences: {
      columnCount,
      columnGutter,
      verticalJustification,
      insets,
    },
  };
}
