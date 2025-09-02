import { parseRectangle } from "./rectangleParser";
import { parsePolygon } from "./polygonParser";
import { parseOval } from "./ovalParser";
import { parseTextFrame } from "./textFrameParser";
import { parseStoryContent } from "./storyParser";
import { convertToCssRGB } from "./utils";

/**
 * Main IDML Parser class that coordinates parsing of IDML JSON data
 */
export class IDMLParser {
  /**
   * Constructor for the IDMLParser class
   * @param {Object} idmlJson - The parsed IDML JSON data
   */
  constructor(idmlJson) {
    this.data = idmlJson || {};
    this.document = this.data["designmap.xml"]?.Document;
  }

  /**
   * Get basic document information
   * @returns {Object} Document dimensions and bleed settings
   */
  getDocumentInfo() {
    const docPrefs = this.document?.DocumentPreference;
    return {
      width: parseFloat(docPrefs?.["@_PageWidth"]) || 800,
      height: parseFloat(docPrefs?.["@_PageHeight"]) || 600,
      bleed: {
        top: parseFloat(docPrefs?.["@_DocumentBleedTopOffset"]) || 0,
        bottom: parseFloat(docPrefs?.["@_DocumentBleedBottomOffset"]) || 0,
        left: parseFloat(docPrefs?.["@_DocumentBleedInsideOrLeftOffset"]) || 0,
        right:
          parseFloat(docPrefs?.["@_DocumentBleedOutsideOrRightOffset"]) || 0,
      },
    };
  }

  /**
   * Get all color definitions from the document
   * @returns {Object} Color definitions mapped by ID
   */
  getColors() {
    const colors = {};
    // designmap points to Resources/Graphic.xml
    const graphicRel = this.document?.["idPkg:Graphic"]?.["@_src"]; // e.g., Resources/Graphic.xml
    console.log("Graphic rel path:", graphicRel);

    // Try both forward slash and backslash versions of the path
    let key = graphicRel;
    let colorData = key && this.data[key]?.["idPkg:Graphic"]?.Color;

    // If not found, try with backslashes
    if (!colorData && key) {
      key = graphicRel?.replace(/\//g, "\\");
      console.log("Trying backslash key for graphic data:", key);
      colorData = key && this.data[key]?.["idPkg:Graphic"]?.Color;
    }

    // If still not found, try just the filename
    if (!colorData && graphicRel) {
      key = graphicRel.split("/").pop();
      console.log("Trying filename only key for graphic data:", key);
      colorData = key && this.data[key]?.["idPkg:Graphic"]?.Color;
    }

    console.log("Color data found:", !!colorData);
    const swatches = Array.isArray(colorData)
      ? colorData
      : colorData
      ? [colorData]
      : [];

    const put = (k, entry) => {
      if (!k) return;
      if (!colors[k]) colors[k] = entry;
    };

    for (const sw of swatches) {
      const selfId = sw?.["@_Self"]; // e.g., Color/Black or Color/C=0 M=0 Y=100 K=0
      const name = sw?.["@_Name"]; // e.g., Black or C=0 M=0 Y=100 K=0
      const space = String(sw?.["@_Space"] || "").toUpperCase();
      const valueStr = String(sw?.["@_ColorValue"] || "").trim();
      const values = valueStr
        .split(" ")
        .filter((t) => t !== "")
        .map((t) => Number(t));

      const rgb = convertToCssRGB(space, values);
      const entry = { space, values, rgb };

      // Key by multiple common references
      put(selfId, entry);
      put(name, entry);
      if (selfId && selfId.startsWith("Color/"))
        put(selfId.replace(/^Color\//, ""), entry);
      if (name && name.startsWith("Color/"))
        put(name.replace(/^Color\//, ""), entry);
      const cmykNameMatch =
        name && name.match(/^C=\\d+\\s+M=\\d+\\s+Y=\\d+\\s+K=\\d+$/);
      if (cmykNameMatch) put(cmykNameMatch[0], entry);
    }
    return colors;
  }

  /**
   * Get all font definitions from the document
   * @returns {Object} Font definitions grouped by family
   */
  getFonts() {
    const fonts = {};
    const fontsRel = this.document?.["idPkg:Fonts"]?.["@_src"]; // Resources/Fonts.xml
    const key = fontsRel?.replace(/\//g, "\\");
    const fontData = key && this.data[key]?.["idPkg:Fonts"]?.FontFamily;
    const families = Array.isArray(fontData)
      ? fontData
      : fontData
      ? [fontData]
      : [];
    for (const family of families) {
      const familyName = family?.["@_Name"];
      if (!familyName) continue;
      fonts[familyName] = {};
      const variants = Array.isArray(family.Font)
        ? family.Font
        : family.Font
        ? [family.Font]
        : [];
      for (const font of variants) {
        if (!font) continue;
        fonts[familyName][font["@_FontStyleName"]] = {
          postscriptName: font["@_PostScriptName"],
          status: font["@_Status"],
          fullName: font["@_FullName"],
        };
      }
    }
    return fonts;
  }

  /**
   * Get all stories (text content) from the document
   * @returns {Object} Stories mapped by ID
   */
  getStories() {
    const stories = {};
    for (const key of Object.keys(this.data)) {
      // Check for both forward slash and backslash paths
      if (
        (key.startsWith("Stories\\") || key.startsWith("Stories/")) &&
        key.endsWith(".xml")
      ) {
        console.log("Processing story file:", key);
        const storyData = this.data[key]?.["idPkg:Story"]?.Story;
        if (!storyData) {
          console.log("No story data found in", key);
          continue;
        }

        const idFromSelf = storyData?.["@_Self"] || null;

        // Match both backslash and forward slash patterns
        const idFromNameMatch = key.match(/Stories[\\\/]Story_(.+)\.xml/);
        const idFromName = idFromNameMatch?.[1] || null;
        const storyId = idFromSelf || idFromName;

        if (storyId) {
          console.log("Adding story with ID:", storyId);
          stories[storyId] = parseStoryContent(storyData);
        }
      }
    }
    return stories;
  }

  /**
   * Get all elements from all spreads
   * @returns {Array} All parsed elements from the document
   */
  getSpreadElements() {
    console.log(
      "getSpreadElements called, data keys:",
      Object.keys(this.data).length
    );
    const elements = [];
    // Try to discover spreads by scanning data keys
    const spreadKeys = Object.keys(this.data).filter((k) =>
      k.startsWith("Spreads\\")
    );
    console.log("Found spread keys:", spreadKeys.length, spreadKeys);
    for (const key of spreadKeys) {
      console.log("Processing spread key:", key);
      const spreadData = this.data[key];
      console.log("Spread data exists:", !!spreadData);
      const spread = spreadData?.["idPkg:Spread"]?.Spread;
      console.log("Spread object exists:", !!spread);
      if (!spread) continue;

      // TextFrames
      const frames = Array.isArray(spread.TextFrame)
        ? spread.TextFrame
        : spread.TextFrame
        ? [spread.TextFrame]
        : [];
      for (const frame of frames) elements.push(parseTextFrame(frame));

      // Rectangles
      const rects = Array.isArray(spread.Rectangle)
        ? spread.Rectangle
        : spread.Rectangle
        ? [spread.Rectangle]
        : [];
      for (const r of rects) elements.push(parseRectangle(r));

      // Polygons
      const polys = Array.isArray(spread.Polygon)
        ? spread.Polygon
        : spread.Polygon
        ? [spread.Polygon]
        : [];
      for (const p of polys) elements.push(parsePolygon(p));

      // Ovals
      const ovals = Array.isArray(spread.Oval)
        ? spread.Oval
        : spread.Oval
        ? [spread.Oval]
        : [];
      for (const o of ovals) elements.push(parseOval(o));
    }
    return elements;
  }
}
