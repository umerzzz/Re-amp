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
   * Recursively extract shapes from a container (like groups, rectangles with nested content)
   * @param {Object} container - The container object to search
   * @param {Array} elements - Array to add found elements to
   * @param {Object} parentTransform - Accumulated transform from parent containers
   */
  extractNestedShapes(container, elements, parentTransform = null) {
    if (!container) return;

    console.log(
      "Extracting nested shapes from container:",
      container?.["@_Self"] || "unknown",
      "with parent transform:",
      parentTransform
    );

    // Get the current container's transform and combine with parent
    const containerTransform = this.parseTransform(
      container?.["@_ItemTransform"]
    );
    const combinedTransform = this.combineTransforms(
      parentTransform,
      containerTransform
    );

    // Check for nested groups
    if (container.Group) {
      const groups = Array.isArray(container.Group)
        ? container.Group
        : [container.Group];
      console.log(`Found ${groups.length} nested groups`);
      for (const group of groups) {
        this.extractNestedShapes(group, elements, combinedTransform);
      }
    }

    // Check for nested rectangles
    if (container.Rectangle) {
      const rects = Array.isArray(container.Rectangle)
        ? container.Rectangle
        : [container.Rectangle];
      console.log(`Found ${rects.length} nested rectangles`);
      for (const rect of rects) {
        const parsedRect = parseRectangle(rect);
        // Apply parent transform to the element
        if (combinedTransform) {
          parsedRect.parentTransform = combinedTransform;
        }
        elements.push(parsedRect);
        this.extractNestedShapes(rect, elements, combinedTransform); // Recursively check inside rectangles
      }
    }

    // Check for nested polygons
    if (container.Polygon) {
      const polys = Array.isArray(container.Polygon)
        ? container.Polygon
        : [container.Polygon];
      console.log(`Found ${polys.length} nested polygons`);
      for (const poly of polys) {
        const parsedPoly = parsePolygon(poly);
        // Apply parent transform to the element
        if (combinedTransform) {
          parsedPoly.parentTransform = combinedTransform;
        }
        elements.push(parsedPoly);
        this.extractNestedShapes(poly, elements, combinedTransform); // Recursively check inside polygons
      }
    }

    // Check for nested ovals
    if (container.Oval) {
      const ovals = Array.isArray(container.Oval)
        ? container.Oval
        : [container.Oval];
      console.log(`Found ${ovals.length} nested ovals`);
      for (const oval of ovals) {
        const parsedOval = parseOval(oval);
        // Apply parent transform to the element
        if (combinedTransform) {
          parsedOval.parentTransform = combinedTransform;
        }
        elements.push(parsedOval);
        this.extractNestedShapes(oval, elements, combinedTransform); // Recursively check inside ovals
      }
    }

    // Check for nested text frames
    if (container.TextFrame) {
      const frames = Array.isArray(container.TextFrame)
        ? container.TextFrame
        : [container.TextFrame];
      console.log(`Found ${frames.length} nested text frames`);
      for (const frame of frames) {
        const parsedFrame = parseTextFrame(frame);
        // Apply parent transform to the element
        if (combinedTransform) {
          parsedFrame.parentTransform = combinedTransform;
        }
        elements.push(parsedFrame);
        this.extractNestedShapes(frame, elements, combinedTransform); // Recursively check inside text frames
      }
    }
  }

  /**
   * Parse transform string into transform object
   * @param {string} transformString - Transform string in format "a b c d tx ty"
   * @returns {Object|null} Transform object or null if no transform
   */
  parseTransform(transformString) {
    if (!transformString) return null;
    const values = String(transformString).split(" ").map(Number);
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
   * Combine two transform matrices
   * @param {Object|null} parent - Parent transform matrix
   * @param {Object|null} child - Child transform matrix
   * @returns {Object|null} Combined transform matrix
   */
  combineTransforms(parent, child) {
    if (!parent && !child) return null;
    if (!parent) return child;
    if (!child) return parent;

    // Matrix multiplication: parent * child
    // [a c tx]   [a' c' tx']   [aa'+cb'  ac'+cd'  atx'+cty'+tx]
    // [b d ty] * [b' d' ty'] = [ba'+db'  bc'+dd'  btx'+dty'+ty]
    // [0 0  1]   [ 0  0  1]   [   0        0           1     ]

    return {
      a: parent.a * child.a + parent.c * child.b,
      b: parent.b * child.a + parent.d * child.b,
      c: parent.a * child.c + parent.c * child.d,
      d: parent.b * child.c + parent.d * child.d,
      tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
      ty: parent.b * child.tx + parent.d * child.ty + parent.ty,
    };
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

      // TextFrames (top-level)
      const frames = Array.isArray(spread.TextFrame)
        ? spread.TextFrame
        : spread.TextFrame
        ? [spread.TextFrame]
        : [];
      for (const frame of frames) {
        elements.push(parseTextFrame(frame));
        this.extractNestedShapes(frame, elements); // Check for nested shapes
      }

      // Rectangles (top-level)
      const rects = Array.isArray(spread.Rectangle)
        ? spread.Rectangle
        : spread.Rectangle
        ? [spread.Rectangle]
        : [];
      for (const r of rects) {
        elements.push(parseRectangle(r));
        this.extractNestedShapes(r, elements); // Check for nested shapes
      }

      // Polygons (top-level)
      const polys = Array.isArray(spread.Polygon)
        ? spread.Polygon
        : spread.Polygon
        ? [spread.Polygon]
        : [];
      for (const p of polys) {
        elements.push(parsePolygon(p));
        this.extractNestedShapes(p, elements); // Check for nested shapes
      }

      // Ovals (top-level)
      const ovals = Array.isArray(spread.Oval)
        ? spread.Oval
        : spread.Oval
        ? [spread.Oval]
        : [];
      for (const o of ovals) {
        elements.push(parseOval(o));
        this.extractNestedShapes(o, elements); // Check for nested shapes
      }

      // Groups (top-level)
      const groups = Array.isArray(spread.Group)
        ? spread.Group
        : spread.Group
        ? [spread.Group]
        : [];
      for (const group of groups) {
        this.extractNestedShapes(group, elements); // Groups don't get rendered directly, just extract their contents
      }
    }

    console.log(`Total elements found (including nested): ${elements.length}`);
    return elements;
  }
}
