// No utils imports needed for story parsing

/**
 * Parse story content from IDML data
 * @param {Object} storyData - IDML story data
 * @returns {Object} Parsed story content with paragraphs and text
 */
export function parseStoryContent(storyData) {
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
    // Extract the applied paragraph style reference
    const appliedParaStyle = pr?.["@_AppliedParagraphStyle"] || null;
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
      // Extract the applied character style reference
      const appliedCharStyle = cr?.["@_AppliedCharacterStyle"] || null;

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
            if (node.Br !== undefined || node["br"] !== undefined) text += "\n";
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
        appliedCharacterStyle: appliedCharStyle, // Add character style reference
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
      appliedParagraphStyle: appliedParaStyle, // Include the paragraph style reference
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
