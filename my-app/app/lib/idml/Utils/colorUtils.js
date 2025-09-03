// Color and swatch utilities for IDML rendering

/**
 * Pick RGB color from swatch by name
 * @param {Object} colors - Colors object containing swatches
 * @param {string} name - Color name to look up
 * @returns {string|null} - RGB color string or null if not found
 */
export function pickSwatchRGB(colors, name) {
  if (!colors) return null;
  if (colors[name]?.rgb) return colors[name].rgb;
  const alt = colors[name.replace(/^Color\//, "")]?.rgb;
  if (alt) return alt;
  return null;
}

/**
 * Resolve RGB color from swatch reference
 * @param {Object} colors - Colors object containing swatches
 * @param {string} ref - Color reference to resolve
 * @returns {string|null} - RGB color string or null if not found
 */
export function resolveSwatchRGB(colors, ref) {
  if (!ref) return null;
  if (colors?.[ref]?.rgb) return colors[ref].rgb;
  const trimmed = String(ref).replace(/^Color\//, "");
  if (colors?.[trimmed]?.rgb) return colors[trimmed].rgb;
  const m = trimmed.match(/C=(\d+)\s*M=(\d+)\s*Y=(\d+)\s*K=(\d+)/i);
  if (m) {
    const c = Number(m[1]);
    const m2 = Number(m[2]);
    const y = Number(m[3]);
    const k = Number(m[4]);
    return cmykToRgbCss(c, m2, y, k);
  }
  return null;
}

/**
 * Convert CMYK values to RGB CSS string
 * @param {number} C - Cyan value (0-100)
 * @param {number} M - Magenta value (0-100)
 * @param {number} Y - Yellow value (0-100)
 * @param {number} K - Black value (0-100)
 * @returns {string} - RGB CSS string
 */
export function cmykToRgbCss(C, M, Y, K) {
  const c = (isFinite(C) ? C : 0) / 100;
  const m = (isFinite(M) ? M : 0) / 100;
  const y = (isFinite(Y) ? Y : 0) / 100;
  const k = (isFinite(K) ? K : 0) / 100;
  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Apply an InDesign-style tint percentage (0-100) to an RGB color string
 * @param {string} rgbString - RGB color string
 * @param {number} tintPercent - Tint percentage (0-100)
 * @returns {string} - Tinted RGB color string
 */
export function applyTint(rgbString, tintPercent) {
  if (!rgbString || typeof rgbString !== "string") return rgbString;
  const m = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (!m) return rgbString;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const t = Math.max(0, Math.min(100, Number(tintPercent)));
  const factor = t / 100; // 100 -> original, 0 -> white
  const tr = Math.round(255 - (255 - r) * factor);
  const tg = Math.round(255 - (255 - g) * factor);
  const tb = Math.round(255 - (255 - b) * factor);
  return `rgb(${tr}, ${tg}, ${tb})`;
}
