// Style processing and application utilities for IDML rendering

import { cleanFontName, extractFontFamily } from "./fontUtils.js";
import { resolveSwatchRGB, applyTint } from "./colorUtils.js";

/**
 * Apply paragraph style properties to a DOM element
 * @param {HTMLElement} element - DOM element to apply styles to
 * @param {Object} paraStyle - Paragraph style object
 * @param {Object} colors - Colors object for color resolution
 */
export function applyParagraphStyle(element, paraStyle, colors) {
  if (!paraStyle) return;

  // Process all Properties
  if (paraStyle.Properties) {
    Object.entries(paraStyle.Properties).forEach(([key, value]) => {
      if (value && value["#text"] !== undefined) {
        const propValue = value["#text"];

        // Font family
        if (key === "AppliedFont") {
          // Extract the base font family name
          const baseFontName = extractFontFamily(propValue);
          // Clean font names for CSS
          const cleanedBaseName = cleanFontName(baseFontName);
          const cleanedFullName = cleanFontName(propValue);
          // Set font family with fallbacks
          element.style.fontFamily = `"${cleanedBaseName}", "${cleanedFullName}", sans-serif`;
          // Store the original font name as a data attribute for debugging
          element.dataset.originalFont = propValue;
          element.dataset.fontFamily = baseFontName;
          element.dataset.cleanedFontFamily = cleanedBaseName;
        }

        // Leading (line height)
        else if (key === "Leading" && propValue !== "Auto") {
          element.style.lineHeight = `${propValue}pt`;
        }

        // Store all properties as data attributes for debugging and custom processing
        element.dataset[`idmlProp${key}`] = propValue;
      }
    });
  }

  // Process all direct attributes (starting with @_)
  Object.entries(paraStyle).forEach(([key, value]) => {
    if (key.startsWith("@_") && value !== undefined && value !== null) {
      const cssKey = key.substring(2); // Remove the @_ prefix

      // Handle special cases for CSS mapping

      // Font size
      if (cssKey === "PointSize") {
        element.style.fontSize = `${value}pt`;
      }

      // Font style (bold/italic)
      else if (cssKey === "FontStyle") {
        const fontStyle = String(value).toLowerCase();
        if (fontStyle.includes("bold")) {
          element.style.fontWeight = "bold";
        }
        if (fontStyle.includes("italic")) {
          element.style.fontStyle = "italic";
        }
      }

      // Text color
      else if (cssKey === "FillColor" && colors) {
        const fillColor = resolveSwatchRGB(colors, value);
        if (fillColor) {
          element.style.color = fillColor;
        }
      }

      // Fill opacity/tint
      else if (cssKey === "FillTint" && value !== -1) {
        // Store for later use with fillColor
        element.dataset.fillTint = value;
      }

      // Text alignment
      else if (cssKey === "Justification") {
        const styleJust = String(value);
        if (styleJust.includes("Center")) {
          element.style.textAlign = "center";
        } else if (styleJust.includes("Right")) {
          element.style.textAlign = "right";
        } else if (styleJust.includes("Left")) {
          element.style.textAlign = "left";
        } else if (styleJust.includes("Justify")) {
          element.style.textAlign = "justify";
        }
      }

      // Margins
      else if (cssKey === "SpaceBefore") {
        element.style.marginTop = `${value}pt`;
      } else if (cssKey === "SpaceAfter") {
        element.style.marginBottom = `${value}pt`;
      } else if (cssKey === "LeftIndent") {
        element.style.paddingLeft = `${value}pt`;
      } else if (cssKey === "RightIndent") {
        element.style.paddingRight = `${value}pt`;
      } else if (cssKey === "FirstLineIndent") {
        element.style.textIndent = `${value}pt`;
      }

      // Leading (line height) - use if not already set from Properties
      else if (cssKey === "Leading" && !element.style.lineHeight) {
        element.style.lineHeight = `${value}pt`;
      }

      // Store all style attributes as data attributes
      element.dataset[`idml${cssKey}`] = value;
    }
  });

  // Apply fill color with tint if both are present
  if (
    element.style.color &&
    element.dataset.fillTint &&
    element.dataset.fillTint !== "-1"
  ) {
    const tint = parseFloat(element.dataset.fillTint);
    if (!isNaN(tint)) {
      // Parse current color
      let color = element.style.color;
      // Apply tint/opacity to the color
      if (color.startsWith("rgb")) {
        // Convert tint to opacity (0-100 to 0-1)
        const opacity = tint / 100;
        // Apply as opacity in rgba
        const rgbValues = color.match(/\d+/g);
        if (rgbValues && rgbValues.length >= 3) {
          element.style.color = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${opacity})`;
        }
      }
    }
  }
}

/**
 * Apply character style properties to a DOM element
 * @param {HTMLElement} element - DOM element to apply styles to
 * @param {Object} charStyle - Character style object
 * @param {Object} colors - Colors object for color resolution
 */
export function applyCharacterStyle(element, charStyle, colors) {
  if (!charStyle) return;

  // Process all Properties from character style
  if (charStyle.Properties) {
    Object.entries(charStyle.Properties).forEach(([key, value]) => {
      if (value && value["#text"] !== undefined) {
        const propValue = value["#text"];

        // Font family
        if (key === "AppliedFont") {
          // Extract the base font family name
          const baseFontName = extractFontFamily(propValue);
          // Clean font names for CSS
          const cleanedBaseName = cleanFontName(baseFontName);
          const cleanedFullName = cleanFontName(propValue);
          // Set font family with fallbacks
          element.style.fontFamily = `"${cleanedBaseName}", "${cleanedFullName}", sans-serif`;
          // Store the original font name as a data attribute for debugging
          element.dataset.originalFont = propValue;
          element.dataset.fontFamily = baseFontName;
          element.dataset.cleanedFontFamily = cleanedBaseName;
        }

        // Store all properties as data attributes
        element.dataset[`idmlProp${key}`] = propValue;
      }
    });
  }

  // Process all direct attributes from character style
  Object.entries(charStyle).forEach(([key, value]) => {
    if (key.startsWith("@_") && value !== undefined && value !== null) {
      const cssKey = key.substring(2); // Remove the @_ prefix

      // Font size
      if (cssKey === "PointSize") {
        element.style.fontSize = `${value}pt`;
      }

      // Font style
      else if (cssKey === "FontStyle") {
        const fontStyle = String(value).toLowerCase();
        if (fontStyle.includes("bold")) {
          element.style.fontWeight = "bold";
        }
        if (fontStyle.includes("italic")) {
          element.style.fontStyle = "italic";
        }
      }

      // Text color
      else if (cssKey === "FillColor" && colors) {
        const fillColor = resolveSwatchRGB(colors, value);
        if (fillColor) {
          element.style.color = fillColor;
        }
      }

      // Fill opacity/tint
      else if (cssKey === "FillTint" && value !== -1) {
        element.dataset.fillTint = value;
      }

      // Other properties
      else if (cssKey === "Tracking") {
        element.style.letterSpacing = `${value / 1000}em`;
      }

      // Store all style attributes as data attributes
      element.dataset[`idml${cssKey}`] = value;
    }
  });

  // Apply fill color with tint if both are present
  if (
    element.style.color &&
    element.dataset.fillTint &&
    element.dataset.fillTint !== "-1"
  ) {
    const tint = parseFloat(element.dataset.fillTint);
    if (!isNaN(tint)) {
      // Parse current color
      let color = element.style.color;
      // Apply tint/opacity to the color
      if (color.startsWith("rgb")) {
        // Convert tint to opacity (0-100 to 0-1)
        const opacity = tint / 100;
        // Apply as opacity in rgba
        const rgbValues = color.match(/\d+/g);
        if (rgbValues && rgbValues.length >= 3) {
          element.style.color = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${opacity})`;
        }
      }
    }
  }
}

/**
 * Apply inline span properties to a DOM element
 * @param {HTMLElement} element - DOM element to apply styles to
 * @param {Object} span - Span object with inline properties
 * @param {Object} colors - Colors object for color resolution
 */
export function applyInlineSpanProperties(element, span, colors) {
  if (span.font) {
    // Extract the base font family name
    const baseFontName = extractFontFamily(span.font);
    // Clean font names for CSS
    const cleanedBaseName = cleanFontName(baseFontName);
    const cleanedFullName = cleanFontName(span.font);
    // Set font family with fallbacks
    element.style.fontFamily = `"${cleanedBaseName}", "${cleanedFullName}", sans-serif`;
    // Store the original font name as a data attribute for debugging
    element.dataset.originalFont = span.font;
    element.dataset.fontFamily = baseFontName;
    element.dataset.cleanedFontFamily = cleanedBaseName;
  }

  // Prefer explicit point size; default to treating fontSize as points
  const pointSize =
    typeof span.pointSize === "number" ? span.pointSize : span.fontSize;
  if (pointSize) element.style.fontSize = `${pointSize}pt`;

  if (span.fontStyle) {
    if (String(span.fontStyle).toLowerCase().includes("bold")) {
      element.style.fontWeight = "700";
    }
    if (String(span.fontStyle).toLowerCase().includes("italic")) {
      element.style.fontStyle = "italic";
    }
  }

  if (span.position) {
    const pos = String(span.position);
    if (pos === "Subscript") element.style.verticalAlign = "sub";
    else if (pos === "Superscript") element.style.verticalAlign = "super";
  }

  const transforms = [];
  if (isFinite(span.horizontalScale) && Number(span.horizontalScale) !== 100) {
    const sx = Number(span.horizontalScale) / 100;
    transforms.push(`scaleX(${sx})`);
  }
  if (isFinite(span.verticalScale) && Number(span.verticalScale) !== 100) {
    const sy = Number(span.verticalScale) / 100;
    transforms.push(`scaleY(${sy})`);
  }
  if (isFinite(span.skew) && Number(span.skew) !== 0) {
    const sk = Number(span.skew);
    transforms.push(`skewX(${sk}deg)`);
  }
  if (transforms.length) {
    element.style.display = "inline-block";
    element.style.transformOrigin = "left bottom";
    element.style.transform = transforms.join(" ");
  }

  if (
    span.underline === true ||
    span.underline === "true" ||
    span.underline === "UnderlineOn"
  ) {
    element.style.textDecoration = element.style.textDecoration
      ? `${element.style.textDecoration} underline`
      : "underline";
  }

  if (
    span.strikeThru === true ||
    span.strikeThru === "true" ||
    span.strikeThru === "StrikeThruOn"
  ) {
    element.style.textDecoration = element.style.textDecoration
      ? `${element.style.textDecoration} line-through`
      : "line-through";
  }

  if (
    typeof span.baselineShift === "number" &&
    !Number.isNaN(span.baselineShift)
  ) {
    element.style.position = "relative";
    element.style.top = `${-span.baselineShift}pt`;
  }

  if (
    span.kerningMethod === "Manual" &&
    typeof span.kerningValue === "number"
  ) {
    // Use em so it scales naturally with font size
    const em = span.kerningValue / 1000;
    element.style.letterSpacing = `${em}em`;
  }

  if (span.capitalization) {
    const cap = String(span.capitalization);
    if (cap === "AllCaps") element.style.textTransform = "uppercase";
    else if (cap === "SmallCaps") element.style.fontVariant = "small-caps";
    else if (cap === "CapToSmallCaps") {
      element.style.textTransform = "uppercase";
      element.style.fontVariant = "small-caps";
    }
  }

  const rgb = resolveSwatchRGB(colors, span.fillColor);
  if (rgb) element.style.color = rgb;

  if (span.strokeWeight > 0 && span.strokeColor) {
    const rgbStroke = resolveSwatchRGB(colors, span.strokeColor);
    if (rgbStroke)
      element.style.webkitTextStroke = `${span.strokeWeight}px ${rgbStroke}`;
  }

  if (span.tracking) element.style.letterSpacing = `${span.tracking / 1000}em`;
}
