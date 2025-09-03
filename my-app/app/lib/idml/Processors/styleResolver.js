/**
 * Utility functions for resolving character styles in IDML documents
 */

/**
 * Resolves a character style reference to its full style definition
 *
 * @param {string} styleReference - The style reference (e.g., "CharacterStyle/title")
 * @param {Object} idmlData - The parsed IDML document data
 * @returns {Object|null} The resolved style definition or null if not found
 */
function resolveCharacterStyle(styleReference, idmlData) {
  if (!styleReference || !idmlData) {
    return null;
  }

  // Extract style name from the reference
  const styleName = styleReference.split("/").pop();

  try {
    // Navigate to the styles section
    const styles = idmlData["Resources\\Styles.xml"]?.["idPkg:Styles"];
    if (!styles) {
      console.warn("Styles section not found in IDML data");
      return null;
    }

    const characterStyles = styles.RootCharacterStyleGroup?.CharacterStyle;
    if (!characterStyles) {
      console.warn("Character styles not found in IDML data");
      return null;
    }

    // Search for matching style
    if (Array.isArray(characterStyles)) {
      return (
        characterStyles.find((style) => {
          // Check if this style matches either by Self or Name
          return (
            style["@_Self"] === styleReference ||
            style["@_Name"] === styleName ||
            style["@_Name"] === `$ID/${styleName}`
          );
        }) || null
      );
    } else if (
      characterStyles["@_Self"] === styleReference ||
      characterStyles["@_Name"] === styleName ||
      characterStyles["@_Name"] === `$ID/${styleName}`
    ) {
      return characterStyles;
    }

    return null;
  } catch (error) {
    console.error("Error resolving character style:", error);
    return null;
  }
}

/**
 * Resolves a paragraph style reference to its full style definition
 *
 * @param {string} styleReference - The style reference (e.g., "ParagraphStyle/Title")
 * @param {Object} idmlData - The parsed IDML document data
 * @returns {Object|null} The resolved style definition or null if not found
 */
function resolveParagraphStyle(styleReference, idmlData) {
  if (!styleReference || !idmlData) {
    return null;
  }

  // Extract style name from the reference
  const styleName = styleReference.split("/").pop();

  try {
    // Navigate to the styles section
    const styles = idmlData["Resources\\Styles.xml"]?.["idPkg:Styles"];
    if (!styles) {
      console.warn("Styles section not found in IDML data");
      return null;
    }

    const paragraphStyles = styles.RootParagraphStyleGroup?.ParagraphStyle;
    if (!paragraphStyles) {
      console.warn("Paragraph styles not found in IDML data");
      return null;
    }

    // Search for matching style
    if (Array.isArray(paragraphStyles)) {
      return (
        paragraphStyles.find((style) => {
          // Check if this style matches either by Self or Name
          return (
            style["@_Self"] === styleReference ||
            style["@_Name"] === styleName ||
            style["@_Name"] === `$ID/${styleName}`
          );
        }) || null
      );
    } else if (
      paragraphStyles["@_Self"] === styleReference ||
      paragraphStyles["@_Name"] === styleName ||
      paragraphStyles["@_Name"] === `$ID/${styleName}`
    ) {
      return paragraphStyles;
    }

    return null;
  } catch (error) {
    console.error("Error resolving paragraph style:", error);
    return null;
  }
}

/**
 * Resolves all styles (character and paragraph) for content elements in IDML data
 *
 * @param {Object} idmlData - The parsed IDML document data
 * @returns {Object} Mapping of style references to their definitions
 */
function resolveAllStyles(idmlData) {
  if (!idmlData) {
    return { characterStyles: {}, paragraphStyles: {} };
  }

  const resolvedStyles = {
    characterStyles: {},
    paragraphStyles: {},
  };

  try {
    // Find all unique character style references in content elements
    const characterStyleRefs = findAllCharacterStyleReferences(idmlData);
    const paragraphStyleRefs = findAllParagraphStyleReferences(idmlData);

    // Resolve each character style
    characterStyleRefs.forEach((styleRef) => {
      const resolved = resolveCharacterStyle(styleRef, idmlData);
      if (resolved) {
        resolvedStyles.characterStyles[styleRef] = resolved;
      } else {
        console.warn(`Could not resolve character style: ${styleRef}`);
      }
    });

    // Resolve each paragraph style
    paragraphStyleRefs.forEach((styleRef) => {
      const resolved = resolveParagraphStyle(styleRef, idmlData);
      if (resolved) {
        resolvedStyles.paragraphStyles[styleRef] = resolved;
      } else {
        console.warn(`Could not resolve paragraph style: ${styleRef}`);
      }
    });
  } catch (error) {
    console.error("Error resolving all styles:", error);
  }

  return resolvedStyles;
}

/**
 * Finds all character style references in the IDML document
 *
 * @param {Object} idmlData - The parsed IDML document data
 * @returns {Array<string>} Array of unique character style references
 */
function findAllCharacterStyleReferences(idmlData) {
  const styleRefs = new Set();

  // Recursive function to traverse the IDML data structure
  function traverse(obj) {
    if (!obj || typeof obj !== "object") return;

    // Check if this object has an AppliedCharacterStyle attribute
    if (
      obj["@_AppliedCharacterStyle"] &&
      typeof obj["@_AppliedCharacterStyle"] === "string" &&
      obj["@_AppliedCharacterStyle"].startsWith("CharacterStyle/")
    ) {
      styleRefs.add(obj["@_AppliedCharacterStyle"]);
    }

    // Continue traversing
    Object.values(obj).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => traverse(item));
      } else if (typeof value === "object" && value !== null) {
        traverse(value);
      }
    });
  }

  traverse(idmlData);
  return [...styleRefs];
}

/**
 * Finds all paragraph style references in the IDML document
 *
 * @param {Object} idmlData - The parsed IDML document data
 * @returns {Array<string>} Array of unique paragraph style references
 */
function findAllParagraphStyleReferences(idmlData) {
  const styleRefs = new Set();

  // Recursive function to traverse the IDML data structure
  function traverse(obj) {
    if (!obj || typeof obj !== "object") return;

    // Check if this object has an AppliedParagraphStyle attribute
    if (
      obj["@_AppliedParagraphStyle"] &&
      typeof obj["@_AppliedParagraphStyle"] === "string" &&
      obj["@_AppliedParagraphStyle"].startsWith("ParagraphStyle/")
    ) {
      styleRefs.add(obj["@_AppliedParagraphStyle"]);
    }

    // Continue traversing
    Object.values(obj).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => traverse(item));
      } else if (typeof value === "object" && value !== null) {
        traverse(value);
      }
    });
  }

  traverse(idmlData);
  return [...styleRefs];
}

/**
 * Process content elements and enrich them with resolved style information
 *
 * @param {Object} idmlData - The parsed IDML document data
 * @returns {Object} The enhanced IDML data with resolved styles
 */
function enrichContentWithStyles(idmlData) {
  if (!idmlData) return idmlData;

  // First, resolve all styles
  const resolvedStyles = resolveAllStyles(idmlData);

  // Create a deep copy of the IDML data
  const enrichedData = JSON.parse(JSON.stringify(idmlData));

  // Recursive function to process content elements
  function processContent(obj) {
    if (!obj || typeof obj !== "object") return;

    // Check if this is a content element with character style
    if (
      obj.Content &&
      obj["@_AppliedCharacterStyle"] &&
      obj["@_AppliedCharacterStyle"].startsWith("CharacterStyle/")
    ) {
      // Add resolved style information
      const styleRef = obj["@_AppliedCharacterStyle"];
      const resolvedStyle = resolvedStyles.characterStyles[styleRef];

      if (resolvedStyle) {
        obj._resolvedCharacterStyle = {
          name: resolvedStyle["@_Name"],
          pointSize: resolvedStyle["@_PointSize"],
          // Add other style properties as needed
          properties: resolvedStyle.Properties || {},
        };
      }
    }

    // Check if this element has paragraph style
    if (
      obj["@_AppliedParagraphStyle"] &&
      obj["@_AppliedParagraphStyle"].startsWith("ParagraphStyle/")
    ) {
      // Add resolved style information
      const styleRef = obj["@_AppliedParagraphStyle"];
      const resolvedStyle = resolvedStyles.paragraphStyles[styleRef];

      if (resolvedStyle) {
        obj._resolvedParagraphStyle = {
          name: resolvedStyle["@_Name"],
          pointSize: resolvedStyle["@_PointSize"],
          justification: resolvedStyle["@_Justification"],
          // Add other style properties as needed
          properties: resolvedStyle.Properties || {},
        };
      }
    }

    // Continue processing child elements
    Object.values(obj).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => processContent(item));
      } else if (typeof value === "object" && value !== null) {
        processContent(value);
      }
    });
  }

  processContent(enrichedData);
  return enrichedData;
}

module.exports = {
  resolveCharacterStyle,
  resolveParagraphStyle,
  resolveAllStyles,
  findAllCharacterStyleReferences,
  findAllParagraphStyleReferences,
  enrichContentWithStyles,
};
