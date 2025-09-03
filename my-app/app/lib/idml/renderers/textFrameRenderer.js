// Text frame renderer for IDML elements

import { applyElementStyles } from "../Utils/elementUtils.js";
import {
  applyParagraphStyle,
  applyCharacterStyle,
  applyInlineSpanProperties,
} from "../Utils/styleUtils.js";
import { cleanFontName, extractFontFamily } from "../Utils/fontUtils.js";
import { resolveSwatchRGB } from "../Utils/colorUtils.js";

/**
 * Render a text frame element
 * @param {Object} element - Element object with bounds and styling
 * @param {Object} colors - Colors object for color resolution
 * @param {Object} stories - Stories object containing text content
 * @param {Object} offsets - Offset object with ox, oy properties
 * @param {Object} parser - Parser object for style resolution
 * @returns {HTMLElement} - Rendered div element containing text content
 */
export function renderTextFrame(element, colors, stories, offsets, parser) {
  const div = document.createElement("div");
  div.style.zIndex = "10";
  const story = stories?.[element.storyId];
  if (story) {
    const prefs = element.textFramePreferences || {};
    const cols = Math.max(1, parseInt(prefs.columnCount) || 1);
    const gutter = parseFloat(prefs.columnGutter) || 0;
    const insets = prefs.insets || { top: 0, right: 0, bottom: 0, left: 0 };

    const inner = document.createElement("div");
    inner.style.position = "absolute";
    inner.style.left = `${insets.left}pt`;
    inner.style.top = `${insets.top}pt`;
    inner.style.right = `${insets.right}pt`;
    inner.style.bottom = `${insets.bottom}pt`;
    inner.style.height = `calc(100% - ${insets.top + insets.bottom}pt)`;
    inner.style.width = `calc(100% - ${insets.left + insets.right}pt)`;
    inner.style.overflow = "hidden";

    // First baseline handling (approximation)
    const firstBaseline = String(prefs.firstBaselineOffset || "");
    const minFirstBaseline = parseFloat(prefs.minimumFirstBaselineOffset) || 0;
    if (
      firstBaseline === "Fixed" ||
      firstBaseline === "CapHeight" ||
      firstBaseline === "LeadingOffset"
    ) {
      // Add additional top padding to approximate first-baseline offset
      const existingPadTop = 0;
      inner.style.paddingTop = `${existingPadTop + minFirstBaseline}pt`;
    }

    if (cols > 1) {
      const totalWidth = Math.max(
        0,
        (element.bounds?.width || 0) - insets.left - insets.right
      );
      const colWidth = (totalWidth - gutter * (cols - 1)) / cols;
      inner.style.display = "grid";
      inner.style.gridTemplateColumns = `repeat(${cols}, ${colWidth}px)`;
      inner.style.columnGap = `${gutter}px`;
      inner.style.gap = `${gutter}px`;
      inner.style.alignContent = "start";
    } else {
      inner.style.display = "flex";
      inner.style.flexDirection = "column";
    }

    const vj = prefs.verticalJustification;
    if (vj === "CenterAlign") inner.style.justifyContent = "center";
    else if (vj === "BottomAlign") inner.style.justifyContent = "flex-end";
    else if (vj === "JustifyAlign")
      inner.style.justifyContent = "space-between";
    else inner.style.justifyContent = "flex-start"; // TopAlign and default

    const paras = story.paragraphs || [];
    for (const p of paras) {
      const pEl = document.createElement("div");

      // Get paragraph style if we have a reference and a parser
      let paraStyle = null;
      if (parser && p.appliedParagraphStyle) {
        paraStyle = parser.resolveParagraphStyle(p.appliedParagraphStyle);

        // Apply paragraph style properties if found
        if (paraStyle) {
          // Debug log for style resolution
          console.debug("[IDML:paraStyle]", {
            ref: p.appliedParagraphStyle,
            resolved: paraStyle,
          });

          // Apply paragraph style
          applyParagraphStyle(pEl, paraStyle, colors);
        }
      }

      // Apply inline paragraph properties (these override the style properties)
      const just = String(p.justification || "");
      if (just) {
        if (just === "CenterAlign" || just === "CenterJustified")
          pEl.style.textAlign = "center";
        else if (just === "RightAlign" || just === "RightJustified")
          pEl.style.textAlign = "right";
        else if (
          just === "LeftAlign" ||
          just === "LeftJustified" ||
          just === ""
        )
          pEl.style.textAlign = "left";
        else if (just === "JustifyAll" || just === "JustifyAlign")
          pEl.style.textAlign = "justify";
      }

      if (isFinite(p.leftIndent)) pEl.style.paddingLeft = `${p.leftIndent}pt`;
      if (isFinite(p.rightIndent))
        pEl.style.paddingRight = `${p.rightIndent}pt`;
      if (isFinite(p.firstLineIndent))
        pEl.style.textIndent = `${p.firstLineIndent}pt`;
      if (isFinite(p.spaceBefore)) pEl.style.marginTop = `${p.spaceBefore}pt`;
      if (isFinite(p.spaceAfter)) pEl.style.marginBottom = `${p.spaceAfter}pt`;
      if (isFinite(p.leading)) pEl.style.lineHeight = `${p.leading}pt`;

      pEl.style.whiteSpace = "pre-wrap";
      for (const s of p.spans || []) {
        const span = document.createElement("span");
        span.textContent = s.text || "";

        // Apply character style if available
        let charStyle = null;
        if (parser && s.appliedCharacterStyle) {
          charStyle = parser.resolveCharacterStyle(s.appliedCharacterStyle);

          // Apply character style properties if found
          if (charStyle) {
            // Debug log for character style resolution
            console.debug("[IDML:charStyle]", {
              ref: s.appliedCharacterStyle,
              resolved: charStyle,
            });

            // Apply character style
            applyCharacterStyle(span, charStyle, colors);
          }
        }

        // Apply inline span properties (these override the style properties)
        applyInlineSpanProperties(span, s, colors);

        pEl.appendChild(span);
      }
      inner.appendChild(pEl);
    }
    div.appendChild(inner);
  }
  applyElementStyles(div, element, colors, offsets);
  return div;
}
