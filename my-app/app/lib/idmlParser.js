export class IDMLParser {
  constructor(idmlJson) {
    this.data = idmlJson || {};
    this.document = this.data["designmap.xml"]?.Document;
  }

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

  getColors() {
    const colors = {};
    // designmap points to Resources/Graphic.xml
    const graphicRel = this.document?.["idPkg:Graphic"]?.["@_src"]; // e.g., Resources/Graphic.xml
    const key = graphicRel?.replace(/\//g, "\\");
    const colorData = key && this.data[key]?.["idPkg:Graphic"]?.Color;
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

      const rgb = this.convertToCssRGB(space, values);
      const entry = { space, values, rgb };

      // Key by multiple common references
      put(selfId, entry);
      put(name, entry);
      if (selfId && selfId.startsWith("Color/"))
        put(selfId.replace(/^Color\//, ""), entry);
      if (name && name.startsWith("Color/"))
        put(name.replace(/^Color\//, ""), entry);
      const cmykNameMatch =
        name && name.match(/^C=\d+\s+M=\d+\s+Y=\d+\s+K=\d+$/);
      if (cmykNameMatch) put(cmykNameMatch[0], entry);
    }
    return colors;
  }

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

  getStories() {
    const stories = {};
    for (const key of Object.keys(this.data)) {
      if (key.startsWith("Stories\\") && key.endsWith(".xml")) {
        const storyData = this.data[key]?.["idPkg:Story"]?.Story;
        if (!storyData) continue;
        const idFromSelf = storyData?.["@_Self"] || null;
        const idFromNameMatch = key.match(/Stories\\\\Story_(.+)\\.xml/);
        const idFromName = idFromNameMatch?.[1] || null;
        const storyId = idFromSelf || idFromName;
        if (storyId) {
          stories[storyId] = this.parseStoryContent(storyData);
        }
      }
    }
    return stories;
  }

  parseStoryContent(storyData) {
    const paraRanges = storyData?.ParagraphStyleRange;
    const paragraphsArray = Array.isArray(paraRanges)
      ? paraRanges
      : paraRanges
      ? [paraRanges]
      : [];

    const paragraphs = [];
    for (const pr of paragraphsArray) {
      const justification = pr?.["@_Justification"] || null;
      const spaceBefore = parseFloat(pr?.["@_SpaceBefore"]) || 0;
      const spaceAfter = parseFloat(pr?.["@_SpaceAfter"]) || 0;
      const paraLeading = parseFloat(pr?.["@_Leading"]) || null;
      const charRanges = pr?.CharacterStyleRange;
      const charArray = Array.isArray(charRanges)
        ? charRanges
        : charRanges
        ? [charRanges]
        : [];

      const spans = [];
      for (const cr of charArray) {
        const contentNode = cr?.Content;
        const brNode = cr?.Br;
        let text = "";
        if (Array.isArray(contentNode)) {
          const maxLen = Math.max(
            contentNode.length,
            Array.isArray(brNode) ? brNode.length : 0
          );
          for (let i = 0; i < maxLen; i += 1) {
            const node = contentNode[i];
            if (typeof node === "string") text += node;
            else if (node && typeof node === "object") {
              if (node.Br !== undefined || node["br"] !== undefined)
                text += "\n";
              else if (typeof node["#text"] === "string") text += node["#text"];
            }
            // Insert a newline between content items to reflect comma boundaries
            if (i < contentNode.length - 1) text += "\n";
            // If there is an explicit Br entry at this index, add an additional newline
            if (Array.isArray(brNode) && typeof brNode[i] !== "undefined") {
              text += "\n";
            }
          }
        } else if (typeof contentNode === "string") {
          text = contentNode;
          // If Br exists, append appropriate number of newlines
          if (Array.isArray(brNode)) {
            for (let i = 0; i < brNode.length; i += 1) text += "\n";
          }
        }

        spans.push({
          text,
          font: cr?.Properties?.AppliedFont?.["#text"] || cr?.["@_AppliedFont"],
          fontStyle: cr?.["@_FontStyle"],
          capitalization: cr?.["@_Capitalization"],
          position: cr?.["@_Position"],
          underline: cr?.["@_Underline"],
          strikeThru: cr?.["@_StrikeThru"],
          baselineShift:
            cr?.["@_BaselineShift"] !== undefined
              ? Number(cr?.["@_BaselineShift"])
              : null,
          kerningMethod: cr?.["@_KerningMethod"],
          kerningValue:
            cr?.["@_KerningValue"] !== undefined
              ? Number(cr?.["@_KerningValue"])
              : null,
          fontSize: parseFloat(cr?.["@_PointSize"]) || 12,
          fillColor: cr?.["@_FillColor"],
          strokeColor: cr?.["@_StrokeColor"],
          strokeWeight: parseFloat(cr?.["@_StrokeWeight"]) || 0,
          tracking: parseFloat(cr?.["@_Tracking"]) || 0,
          leading:
            typeof cr?.["@_Leading"] === "string"
              ? parseFloat(cr?.["@_Leading"]) || null
              : parseFloat(cr?.["@_Leading"]) || null,
        });
      }

      paragraphs.push({
        justification,
        spans,
        spaceBefore,
        spaceAfter,
        leading: paraLeading,
      });
    }

    if (paragraphs.length === 0) {
      return { paragraphs: [], text: "" };
    }

    const flatText = paragraphs
      .map((p) => p.spans.map((s) => s.text).join(""))
      .join("\n");

    return { paragraphs, text: flatText };
  }

  getSpreadElements() {
    const elements = [];
    // Try to discover spreads by scanning data keys
    const spreadKeys = Object.keys(this.data).filter((k) =>
      k.startsWith("Spreads\\")
    );
    for (const key of spreadKeys) {
      const spread = this.data[key]?.["idPkg:Spread"]?.Spread;
      if (!spread) continue;
      // TextFrames
      const frames = Array.isArray(spread.TextFrame)
        ? spread.TextFrame
        : spread.TextFrame
        ? [spread.TextFrame]
        : [];
      for (const frame of frames) elements.push(this.parseTextFrame(frame));
      // Rectangles
      const rects = Array.isArray(spread.Rectangle)
        ? spread.Rectangle
        : spread.Rectangle
        ? [spread.Rectangle]
        : [];
      for (const r of rects) elements.push(this.parseRectangle(r));
      // Polygons
      const polys = Array.isArray(spread.Polygon)
        ? spread.Polygon
        : spread.Polygon
        ? [spread.Polygon]
        : [];
      for (const p of polys) elements.push(this.parsePolygon(p));
    }
    return elements;
  }

  parseTextFrame(frame) {
    const bounds = this.parseGeometry(frame?.Properties?.PathGeometry);
    const transform = this.parseTransform(frame?.["@_ItemTransform"]);
    const storyId = frame?.["@_ParentStory"];
    const tfp =
      frame?.TextFramePreference ||
      frame?.Properties?.TextFramePreference ||
      {};
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
      type: "textframe",
      id: frame?.["@_Self"],
      name: frame?.["@_Name"],
      bounds,
      transform,
      storyId,
      visible: frame?.["@_Visible"] !== "false",
      fillColor: frame?.["@_FillColor"],
      strokeColor: frame?.["@_StrokeColor"],
      strokeWeight: parseFloat(frame?.["@_StrokeWeight"]) || 0,
      dropShadow: this.parseDropShadow(
        frame?.TransparencySetting?.DropShadowSetting
      ),
      textFramePreferences: {
        columnCount,
        columnGutter,
        verticalJustification,
        insets,
      },
    };
  }

  parseRectangle(rect) {
    const bounds = this.parseGeometry(rect?.Properties?.PathGeometry);
    const transform = this.parseTransform(rect?.["@_ItemTransform"]);
    return {
      type: "rectangle",
      id: rect?.["@_Self"],
      name: rect?.["@_Name"],
      bounds,
      transform,
      visible: rect?.["@_Visible"] !== "false",
      fillColor: rect?.["@_FillColor"],
      strokeColor: rect?.["@_StrokeColor"],
      strokeWeight: parseFloat(rect?.["@_StrokeWeight"]) || 0,
    };
  }

  parsePolygon(polygon) {
    const bounds = this.parseGeometry(polygon?.Properties?.PathGeometry);
    const transform = this.parseTransform(polygon?.["@_ItemTransform"]);
    const textPath = polygon?.TextPath;
    return {
      type: "polygon",
      id: polygon?.["@_Self"],
      name: polygon?.["@_Name"],
      bounds,
      transform,
      visible: polygon?.["@_Visible"] !== "false",
      strokeColor: polygon?.["@_StrokeColor"],
      strokeWeight: parseFloat(polygon?.["@_StrokeWeight"]) || 0,
      textPath: textPath
        ? {
            storyId: textPath?.["@_ParentStory"],
            alignment: textPath?.["@_PathAlignment"],
            effect: textPath?.["@_PathEffect"],
          }
        : null,
    };
  }

  parseGeometry(pathGeometry) {
    const pts = pathGeometry?.GeometryPathType?.PathPointArray?.PathPointType;
    if (!pts) return null;
    const array = Array.isArray(pts) ? pts : [pts];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
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

  parseTransform(transformString) {
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

  parseDropShadow(ds) {
    if (!ds || ds?.["@_Mode"] !== "Drop") return null;
    return {
      offsetX: parseFloat(ds?.["@_XOffset"]) || 0,
      offsetY: parseFloat(ds?.["@_YOffset"]) || 0,
      blurRadius: parseFloat(ds?.["@_Size"]) || 0,
      color: ds?.["@_EffectColor"] || "rgba(0,0,0,0.5)",
    };
  }

  convertToRGB(space, values) {
    if (space === "CMYK" && Array.isArray(values) && values.length === 4) {
      const [c, m, y, k] = values.map((v) =>
        Number.isFinite(v) ? v / 100 : 0
      );
      const r = Math.round(255 * (1 - c) * (1 - k));
      const g = Math.round(255 * (1 - m) * (1 - k));
      const b = Math.round(255 * (1 - y) * (1 - k));
      return `rgb(${r}, ${g}, ${b})`;
    }
    return "rgb(0, 0, 0)";
  }

  convertToCssRGB(space, values) {
    const s = String(space || "").toUpperCase();
    if (s === "CMYK" && values?.length === 4)
      return this.convertToRGB("CMYK", values);
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
}
