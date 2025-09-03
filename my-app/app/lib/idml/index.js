import { parseRectangle } from "./Parsers/rectangleParser.js";
import { parsePolygon } from "./Parsers/polygonParser.js";
import { parseOval } from "./Parsers/ovalParser.js";
import { parseTextFrame } from "./Parsers/textFrameParser.js";
import { parseStoryContent } from "./Parsers/storyParser.js";
import { convertToCssRGB } from "./utils.js";
import {
  resolveAllStyles,
  resolveCharacterStyle,
  resolveParagraphStyle,
  enrichContentWithStyles,
} from "./Processors/styleResolver.js";

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
   * Resolve an idPkg @ _src pointer to the loaded JSON entry.
   * Tries as-is, backslashes, and filename-only keys.
   * @param {string} src
   * @param {string} topKey e.g. "idPkg:Preferences"
   * @returns {any|null}
   */
  resolveSrc(src, topKey) {
    if (!src) return null;
    let key = src;
    let node = this.data[key]?.[topKey];
    if (node) return node;
    key = src.replace(/\//g, "\\");
    node = this.data[key]?.[topKey];
    if (node) return node;
    key = src.split("/").pop();
    node = this.data[key]?.[topKey];
    if (node) return node;
    return null;
  }

  /**
   * Get basic document information
   * @returns {Object} Document dimensions and bleed settings
   */
  getDocumentInfo() {
    const prefSrc = this.document?.["idPkg:Preferences"]?.["@_src"];
    const prefRoot = this.resolveSrc(prefSrc, "idPkg:Preferences");
    const docPrefs =
      prefRoot?.DocumentPreference || this.document?.DocumentPreference || {};

    return {
      width: parseFloat(docPrefs?.["@_PageWidth"]),
      height: parseFloat(docPrefs?.["@_PageHeight"]),
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
    // shape debug log removed

    // Try both forward slash and backslash versions of the path
    let key = graphicRel;
    let colorData = key && this.data[key]?.["idPkg:Graphic"]?.Color;

    // If not found, try with backslashes
    if (!colorData && key) {
      key = graphicRel?.replace(/\//g, "\\");
      // shape debug log removed
      colorData = key && this.data[key]?.["idPkg:Graphic"]?.Color;
    }

    // If still not found, try just the filename
    if (!colorData && graphicRel) {
      key = graphicRel.split("/").pop();
      // shape debug log removed
      colorData = key && this.data[key]?.["idPkg:Graphic"]?.Color;
    }

    // shape debug log removed
    // Gather base Color swatches
    const swatches = Array.isArray(colorData)
      ? colorData
      : colorData
      ? [colorData]
      : [];

    // Also pull any colors embedded in ColorGroup -> ColorGroupSwatch
    const colorGroup = this.data[key]?.["idPkg:Graphic"]?.ColorGroup;
    const groupSwatches = Array.isArray(colorGroup?.ColorGroupSwatch)
      ? colorGroup.ColorGroupSwatch
      : colorGroup?.ColorGroupSwatch
      ? [colorGroup.ColorGroupSwatch]
      : [];

    const put = (k, entry) => {
      if (!k) return;
      if (!colors[k]) colors[k] = entry;
    };

    // Helper to register a swatch from a Color element
    const putColor = (sw) => {
      const selfId = sw?.["@_Self"]; // e.g., Color/Black
      const name = sw?.["@_Name"]; // e.g., Black
      const space = String(sw?.["@_Space"] || "").toUpperCase();
      const valueStr = String(sw?.["@_ColorValue"] || "").trim();
      const values = valueStr
        .split(" ")
        .filter((t) => t !== "")
        .map((t) => Number(t));

      const rgb = convertToCssRGB(space, values);
      const entry = { space, values, rgb };

      const put = (k, entry) => {
        if (!k) return;
        if (!colors[k]) colors[k] = entry;
      };

      put(selfId, entry);
      put(name, entry);
      if (selfId && selfId.startsWith("Color/"))
        put(selfId.replace(/^Color\//, ""), entry);
      if (name && name.startsWith("Color/"))
        put(name.replace(/^Color\//, ""), entry);
      const cmykNameMatch =
        name && name.match(/^C=\d+\s+M=\d+\s+Y=\d+\s+K=\d+$/);
      if (cmykNameMatch) put(cmykNameMatch[0], entry);
    };

    for (const sw of swatches) {
      putColor(sw);
    }

    // Register colors referenced by ColorGroupSwatch entries (they point to swatch items)
    for (const gsw of groupSwatches) {
      const ref = gsw?.["@_SwatchItemRef"]; // e.g., Color/C=6 M=66 Y=98 K=3
      if (ref && colors[ref]) continue; // already present
      if (ref && String(ref).startsWith("Color/")) {
        // Attempt to synthesize from the name if it's a CMYK string
        const name = ref.replace(/^Color\//, "");
        let values = null;
        let m = name.match(/^C=(\d+)\s*M=(\d+)\s*Y=(\d+)\s*K=(\d+)/i);
        if (m) {
          values = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
        }
        if (!values) {
          m = name.match(/^c(\d+)m(\d+)y(\d+)k(\d+)$/i);
          if (m)
            values = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
        }
        if (values) {
          const rgb = convertToCssRGB("CMYK", values);
          colors[ref] = { space: "CMYK", values, rgb };
          colors[name] = colors[ref];
        }
      }
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
        // shape debug log removed
        const storyData = this.data[key]?.["idPkg:Story"]?.Story;
        if (!storyData) {
          // shape debug log removed
          continue;
        }

        const idFromSelf = storyData?.["@_Self"] || null;

        // Match both backslash and forward slash patterns
        const idFromNameMatch = key.match(/Stories[\\\/]Story_(.+)\.xml/);
        const idFromName = idFromNameMatch?.[1] || null;
        const storyId = idFromSelf || idFromName;

        if (storyId) {
          // shape debug log removed
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

    // shape debug log removed

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
      // shape debug log removed
      for (const group of groups) {
        this.extractNestedShapes(group, elements, combinedTransform);
      }
    }

    // Check for nested rectangles
    if (container.Rectangle) {
      const rects = Array.isArray(container.Rectangle)
        ? container.Rectangle
        : [container.Rectangle];
      // shape debug log removed
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
      // shape debug log removed
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
      // shape debug log removed
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
      // shape debug log removed
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
    // shape debug log removed
    const elements = [];
    // Try to discover spreads by scanning data keys
    const spreadKeys = Object.keys(this.data).filter((k) =>
      k.startsWith("Spreads\\")
    );
    // shape debug log removed
    for (const key of spreadKeys) {
      const spreadData = this.data[key];
      const spread = spreadData?.["idPkg:Spread"]?.Spread;
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

    // shape debug log removed
    return elements;
  }

  /**
   * Get pages with their elements grouped per spread/page
   * Uses Spreads/*.xml and Page @ _Name where available.
   * @returns {Array<{pageName:number|string, elements:Array}>}
   */
  getPages() {
    const pages = [];
    const spreadKeys = Object.keys(this.data).filter((k) =>
      k.startsWith("Spreads\\")
    );
    // Build a lookup of master spreads by id
    const masterMap = {};
    const masterKeys = Object.keys(this.data).filter((k) =>
      k.startsWith("MasterSpreads\\")
    );
    for (const mkey of masterKeys) {
      const m = this.data[mkey]?.["idPkg:MasterSpread"]?.MasterSpread;
      if (m?.["@_Self"]) masterMap[m["@_Self"]] = m;
    }
    for (const key of spreadKeys) {
      const spreadData = this.data[key];
      const spread = spreadData?.["idPkg:Spread"]?.Spread;
      if (!spread) continue;

      // Gather elements for this spread (including applied master items)
      const elements = [];

      // If the page applies a master, bring its items first
      const pageEntry = Array.isArray(spread.Page)
        ? spread.Page[0]
        : spread.Page;
      const appliedMasterId = pageEntry?.["@_AppliedMaster"];
      if (
        appliedMasterId &&
        appliedMasterId !== "n" &&
        masterMap[appliedMasterId]
      ) {
        const mm = masterMap[appliedMasterId];
        const mFrames = Array.isArray(mm.TextFrame)
          ? mm.TextFrame
          : mm.TextFrame
          ? [mm.TextFrame]
          : [];
        for (const f of mFrames) {
          elements.push(parseTextFrame(f));
          this.extractNestedShapes(f, elements);
        }
        const mRects = Array.isArray(mm.Rectangle)
          ? mm.Rectangle
          : mm.Rectangle
          ? [mm.Rectangle]
          : [];
        for (const r of mRects) {
          elements.push(parseRectangle(r));
          this.extractNestedShapes(r, elements);
        }
        const mPolys = Array.isArray(mm.Polygon)
          ? mm.Polygon
          : mm.Polygon
          ? [mm.Polygon]
          : [];
        for (const p of mPolys) {
          elements.push(parsePolygon(p));
          this.extractNestedShapes(p, elements);
        }
        const mOvals = Array.isArray(mm.Oval)
          ? mm.Oval
          : mm.Oval
          ? [mm.Oval]
          : [];
        for (const o of mOvals) {
          elements.push(parseOval(o));
          this.extractNestedShapes(o, elements);
        }
        const mGroups = Array.isArray(mm.Group)
          ? mm.Group
          : mm.Group
          ? [mm.Group]
          : [];
        for (const g of mGroups) {
          this.extractNestedShapes(g, elements);
        }
      }

      const frames = Array.isArray(spread.TextFrame)
        ? spread.TextFrame
        : spread.TextFrame
        ? [spread.TextFrame]
        : [];
      for (const frame of frames) {
        elements.push(parseTextFrame(frame));
        this.extractNestedShapes(frame, elements);
      }

      const rects = Array.isArray(spread.Rectangle)
        ? spread.Rectangle
        : spread.Rectangle
        ? [spread.Rectangle]
        : [];
      for (const r of rects) {
        elements.push(parseRectangle(r));
        this.extractNestedShapes(r, elements);
      }

      const polys = Array.isArray(spread.Polygon)
        ? spread.Polygon
        : spread.Polygon
        ? [spread.Polygon]
        : [];
      for (const p of polys) {
        elements.push(parsePolygon(p));
        this.extractNestedShapes(p, elements);
      }

      const ovals = Array.isArray(spread.Oval)
        ? spread.Oval
        : spread.Oval
        ? [spread.Oval]
        : [];
      for (const o of ovals) {
        elements.push(parseOval(o));
        this.extractNestedShapes(o, elements);
      }

      const groups = Array.isArray(spread.Group)
        ? spread.Group
        : spread.Group
        ? [spread.Group]
        : [];
      for (const group of groups) {
        this.extractNestedShapes(group, elements);
      }

      // Determine page name from Spread.Page if present
      const pageName = pageEntry?.["@_Name"] || pages.length + 1;
      const pageNumber = Number(pageName);

      pages.push({
        pageName,
        pageNumber: isNaN(pageNumber) ? null : pageNumber,
        elements,
      });
    }
    // Sort by numeric page number when available, otherwise preserve discovery order
    pages.sort((a, b) => {
      if (a.pageNumber != null && b.pageNumber != null)
        return a.pageNumber - b.pageNumber;
      if (a.pageNumber != null) return -1;
      if (b.pageNumber != null) return 1;
    });
    return pages;
  }

  /**
   * Get all character styles defined in the document
   * @returns {Object} Map of character style references to their definitions
   */
  getCharacterStyles() {
    const allStyles = resolveAllStyles(this.data);
    return allStyles.characterStyles;
  }

  /**
   * Get all paragraph styles defined in the document
   * @returns {Object} Map of paragraph style references to their definitions
   */
  getParagraphStyles() {
    const allStyles = resolveAllStyles(this.data);
    return allStyles.paragraphStyles;
  }

  /**
   * Resolve a character style reference to its definition
   * @param {string} styleRef - The character style reference (e.g., "CharacterStyle/title")
   * @returns {Object|null} The resolved style definition or null if not found
   */
  resolveCharacterStyle(styleRef) {
    return resolveCharacterStyle(styleRef, this.data);
  }

  /**
   * Resolve a paragraph style reference to its definition
   * @param {string} styleRef - The paragraph style reference (e.g., "ParagraphStyle/Title")
   * @returns {Object|null} The resolved style definition or null if not found
   */
  resolveParagraphStyle(styleRef) {
    return resolveParagraphStyle(styleRef, this.data);
  }

  /**
   * Enhance IDML content with resolved style information
   * @param {Object} contentData - A portion of IDML data containing content elements (optional)
   * @returns {Object} The enhanced data with resolved styles
   */
  enrichContentWithStyles(contentData = null) {
    return enrichContentWithStyles(contentData || this.data);
  }
}
