// Font handling utilities for IDML rendering

// Track loaded fonts to avoid duplicates
let loadedFonts = new Set();

/**
 * Clean a font name for use in CSS by removing special characters
 * Example: "Susie's Hand" -> "SusiesHand"
 * @param {string} fontName - Font name to clean
 * @returns {string} - Cleaned font name safe for CSS
 */
export function cleanFontName(fontName) {
  if (!fontName) return "";

  // First, replace apostrophes, spaces and special chars with empty string
  let cleaned = fontName
    .replace(/['´`']/g, "") // Remove apostrophes and similar characters
    .replace(/\s+/g, "") // Remove spaces
    .replace(/[^\w-]/g, ""); // Remove any remaining special chars except - and _

  return cleaned || fontName; // Fall back to original name if cleaning resulted in empty string
}

/**
 * Extract font family name from a full font name (removing style suffixes)
 * Example: "Aileron-Bold" -> "Aileron"
 * @param {string} fontName - Full font name including style suffixes
 * @returns {string} - Base font family name
 */
export function extractFontFamily(fontName) {
  // Common style suffixes to remove
  const styleSuffixes = [
    "-Regular",
    "-Bold",
    "-Italic",
    "-BoldItalic",
    "-Medium",
    "-Light",
    "-Heavy",
    "-Black",
    "-Thin",
    "-Oblique",
    "Regular",
    "Bold",
    "Italic",
    "BoldItalic",
    "Medium",
    "Light",
    "Heavy",
    "Black",
    "Thin",
    "Oblique",
  ];

  let baseName = fontName;

  // Try to extract the base font family by removing common style suffixes
  for (const suffix of styleSuffixes) {
    if (fontName.endsWith(suffix)) {
      baseName = fontName.substring(0, fontName.length - suffix.length);
      break;
    }
  }

  // Remove trailing dash if present
  if (baseName.endsWith("-")) {
    baseName = baseName.substring(0, baseName.length - 1);
  }

  return baseName || fontName; // Fall back to original name if we couldn't extract family
}

/**
 * Generates the path to the Fonts directory for a specific upload
 * @param {string} uploadId - The upload ID (timestamp)
 * @returns {string} - The relative path to the Fonts directory
 */
export function getFontDirectoryPath(uploadId) {
  if (!uploadId) return null;
  return `/uploads/${uploadId}/Fonts`;
}

/**
 * Loads custom fonts from the upload's Fonts directory
 * @param {string} uploadId - The upload ID (timestamp)
 * @returns {Promise<Array>} - Array of loaded font names
 */
export async function loadCustomFonts(uploadId) {
  if (typeof document === "undefined" || !uploadId) {
    console.log("Cannot load fonts: document undefined or no uploadId");
    return [];
  }

  const fontDir = getFontDirectoryPath(uploadId);
  console.log(`Looking for fonts in directory: ${fontDir}`);
  if (!fontDir) return [];

  try {
    // Fetch the list of fonts in the directory
    const response = await fetch(
      `/api/fonts?uploadId=${encodeURIComponent(uploadId)}`
    );
    if (!response.ok) {
      console.warn(
        `Font API response not OK: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const fonts = await response.json();
    console.log(
      `Fonts API returned ${fonts.length} fonts for upload ${uploadId}`
    );
    const loadPromises = [];
    const loadedFontNames = [];

    // Load each font using CSS @font-face
    for (const font of fonts) {
      const fontId = `${uploadId}-${font.name}`;
      if (loadedFonts.has(fontId)) {
        // Skip if already loaded but include in returned names
        const rawFontName = font.name.split(".")[0];
        const existingFontName = cleanFontName(rawFontName);
        loadedFontNames.push(existingFontName);
        continue;
      }

      // Use the API endpoint to serve fonts directly
      // Request the sanitized filename (server strips spaces/apostrophes)
      const ext = font.name.split(".").pop();
      const base = font.name.slice(0, -(ext.length + 1));
      const cleanedForFs = base.replace(/[ '\u00B4`]/g, "");
      const sanitizedName = `${cleanedForFs}.${ext}`;
      const fontPath = `/api/serve-font?uploadId=${encodeURIComponent(
        uploadId
      )}&fontName=${encodeURIComponent(sanitizedName)}`;

      // Extract font name without extension and clean it for CSS
      // For fonts like "Aileron-Bold.otf" we want to register as "Aileron-Bold"
      const rawFontName = font.name.split(".")[0];
      const fontName = cleanFontName(rawFontName);
      // Create @font-face rule
      console.log(`Creating FontFace for ${fontName} from ${fontPath}`);
      const fontFace = new FontFace(fontName, `url("${fontPath}")`);
      // Store family name for debugging - use the cleaned name
      fontFace.family = fontName;

      // Create a promise for this font's loading
      const loadPromise = fontFace
        .load()
        .then((loadedFont) => {
          document.fonts.add(loadedFont);
          loadedFontNames.push(fontName);
          loadedFonts.add(fontId);
          console.log(`Loaded font: ${fontName}`);
          return fontName;
        })
        .catch((err) => {
          console.error(`Error loading font ${fontName}:`, err);
          return null;
        });

      loadPromises.push(loadPromise);
    }

    // Wait for all fonts to finish loading
    await Promise.all(loadPromises);

    // Return the names of all loaded fonts
    return loadedFontNames.filter(Boolean);
  } catch (err) {
    console.error("Error loading custom fonts:", err);
    return [];
  }
}
