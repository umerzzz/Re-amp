/**
 * Example usage of the IDML style resolver
 */

const {
  resolveAllStyles,
  resolveCharacterStyle,
  resolveParagraphStyle,
  enrichContentWithStyles,
} = require("./styleResolver");

/**
 * Process an IDML raw_data.json file and enhance it with resolved style information
 *
 * @param {Object} rawData - The parsed IDML JSON data
 * @returns {Object} The enhanced data with resolved styles
 */
function processIdmlStyles(rawData) {
  console.log("Processing IDML styles...");

  // 1. Find and resolve all styles in the document
  const allStyles = resolveAllStyles(rawData);

  console.log(
    `Found ${Object.keys(allStyles.characterStyles).length} character styles`
  );
  console.log(
    `Found ${Object.keys(allStyles.paragraphStyles).length} paragraph styles`
  );

  // 2. For a specific style reference, show the resolved style details
  const titleStyle = resolveCharacterStyle("CharacterStyle/title", rawData);
  if (titleStyle) {
    console.log("\nResolved 'title' character style:");
    console.log("- Name:", titleStyle["@_Name"]);
    console.log("- Point Size:", titleStyle["@_PointSize"]);
    console.log(
      "- Other attributes:",
      Object.keys(titleStyle).filter(
        (k) => k.startsWith("@_") && k !== "@_Self" && k !== "@_Name"
      )
    );
  }

  // 3. Enhance the content with resolved style information
  const enhancedData = enrichContentWithStyles(rawData);

  // 4. Find an example of content with the "title" style and show its enhanced data
  const titleContentExample = findExampleWithStyle(
    enhancedData,
    "CharacterStyle/title"
  );
  if (titleContentExample) {
    console.log("\nExample content with 'title' style:");
    console.log("- Content:", titleContentExample.Content);
    console.log(
      "- Resolved style:",
      JSON.stringify(titleContentExample._resolvedCharacterStyle, null, 2)
    );
  }

  return enhancedData;
}

/**
 * Find an example content element that uses a specific style
 *
 * @param {Object} data - The enhanced IDML data
 * @param {string} styleRef - The style reference to search for
 * @returns {Object|null} An example content element or null if none found
 */
function findExampleWithStyle(data, styleRef) {
  let example = null;

  // Recursive function to find a content element with the specified style
  function findInObject(obj) {
    if (!obj || typeof obj !== "object") return false;

    // Check if this is a content element with the specified style
    if (obj.Content && obj["@_AppliedCharacterStyle"] === styleRef) {
      example = obj;
      return true;
    }

    // Continue searching in child elements
    for (const key in obj) {
      const value = obj[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (findInObject(item)) return true;
        }
      } else if (typeof value === "object" && value !== null) {
        if (findInObject(value)) return true;
      }
    }

    return false;
  }

  findInObject(data);
  return example;
}

module.exports = { processIdmlStyles };
