"use client";
import { useEffect, useMemo, useRef } from "react";
import { IDMLParser } from "../lib/idmlParser";

export default function IDMLViewer({ idmlJson }) {
  const containerRef = useRef(null);

  const { parser, docInfo, elements, colors, stories, offsets } =
    useMemo(() => {
      const parser = new IDMLParser(idmlJson);
      const elements = parser.getSpreadElements();
      const offsets = computeOffsets(elements);
      return {
        parser,
        docInfo: parser.getDocumentInfo(),
        colors: parser.getColors(),
        stories: parser.getStories(),
        elements,
        offsets,
      };
    }, [idmlJson]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    container.style.position = "relative";
    container.style.width = `${docInfo.width}px`;
    container.style.height = `${docInfo.height}px`;
    container.style.overflow = "hidden";
    const paper = pickSwatchRGB(colors, "Paper");
    container.style.background = paper || "white";
    container.style.border = "1px solid #ddd";

    for (const el of elements) {
      const dom = createElement(el, colors, stories, offsets);
      if (dom) container.appendChild(dom);
    }
  }, [docInfo, elements, colors, stories, offsets]);

  return (
    <div>
      <div ref={containerRef} />
    </div>
  );
}

function createElement(element, colors, stories, offsets) {
  switch (element.type) {
    case "rectangle":
      return renderBox(element, colors, offsets);
    case "textframe":
      return renderTextFrame(element, colors, stories, offsets);
    case "polygon":
      return renderBox(element, colors, offsets); // minimal for now
    default:
      return null;
  }
}

function renderBox(element, colors, offsets) {
  const div = document.createElement("div");
  div.style.zIndex = "1";
  applyElementStyles(div, element, colors, offsets);
  return div;
}

function renderTextFrame(element, colors, stories, offsets) {
  const div = document.createElement("div");
  div.style.zIndex = "10";
  const story = stories?.[element.storyId];
  if (story) {
    // Multi-column + insets + vertical justification
    const prefs = element.textFramePreferences || {};
    const cols = Math.max(1, parseInt(prefs.columnCount) || 1);
    const gutter = parseFloat(prefs.columnGutter) || 0;
    const insets = prefs.insets || { top: 0, right: 0, bottom: 0, left: 0 };

    const inner = document.createElement("div");
    inner.style.position = "absolute";
    inner.style.left = `${insets.left}px`;
    inner.style.top = `${insets.top}px`;
    inner.style.right = `${insets.right}px`;
    inner.style.bottom = `${insets.bottom}px`;
    inner.style.height = `calc(100% - ${insets.top + insets.bottom}px)`;
    inner.style.width = `calc(100% - ${insets.left + insets.right}px)`;
    inner.style.overflow = "hidden";

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
    else inner.style.justifyContent = "flex-start";

    const paras = story.paragraphs || [];
    for (const p of paras) {
      const pEl = document.createElement("div");
      if (p.justification === "CenterAlign") pEl.style.textAlign = "center";
      if (p.justification === "RightAlign") pEl.style.textAlign = "right";
      pEl.style.whiteSpace = "pre-wrap";
      for (const s of p.spans || []) {
        const span = document.createElement("span");
        span.textContent = s.text || "";
        if (s.font) span.style.fontFamily = s.font;
        if (s.fontSize) span.style.fontSize = `${s.fontSize}px`;
        if (s.fontStyle) {
          if (String(s.fontStyle).toLowerCase().includes("bold")) {
            span.style.fontWeight = "700";
          }
          if (String(s.fontStyle).toLowerCase().includes("italic")) {
            span.style.fontStyle = "italic";
          }
        }
        if (s.position) {
          const pos = String(s.position);
          if (pos === "Subscript") span.style.verticalAlign = "sub";
          else if (pos === "Superscript") span.style.verticalAlign = "super";
        }
        if (
          s.underline === true ||
          s.underline === "true" ||
          s.underline === "UnderlineOn"
        ) {
          span.style.textDecoration = span.style.textDecoration
            ? `${span.style.textDecoration} underline`
            : "underline";
        }
        if (
          s.strikeThru === true ||
          s.strikeThru === "true" ||
          s.strikeThru === "StrikeThruOn"
        ) {
          span.style.textDecoration = span.style.textDecoration
            ? `${span.style.textDecoration} line-through`
            : "line-through";
        }
        if (
          typeof s.baselineShift === "number" &&
          !Number.isNaN(s.baselineShift)
        ) {
          span.style.position = "relative";
          span.style.top = `${-s.baselineShift}px`;
        }
        if (
          s.kerningMethod === "Manual" &&
          typeof s.kerningValue === "number"
        ) {
          // kerning value is 1/1000 em typically; approximate via letter-spacing in px by font size
          const size = s.fontSize || 12;
          const em = s.kerningValue / 1000;
          const px = em * size;
          span.style.letterSpacing = `${px}px`;
        }
        if (s.capitalization) {
          const cap = String(s.capitalization);
          if (cap === "AllCaps") span.style.textTransform = "uppercase";
          else if (cap === "SmallCaps") span.style.fontVariant = "small-caps";
          else if (cap === "CapToSmallCaps") {
            span.style.textTransform = "uppercase";
            span.style.fontVariant = "small-caps";
          }
        }
        {
          const rgb = resolveSwatchRGB(colors, s.fillColor);
          if (rgb) span.style.color = rgb;
        }
        if (s.strokeWeight > 0 && s.strokeColor) {
          const rgbStroke = resolveSwatchRGB(colors, s.strokeColor);
          if (rgbStroke)
            span.style.webkitTextStroke = `${s.strokeWeight}px ${rgbStroke}`;
        }
        if (s.tracking) span.style.letterSpacing = `${s.tracking / 1000}em`;
        pEl.appendChild(span);
      }
      inner.appendChild(pEl);
    }
    div.appendChild(inner);
  }
  applyElementStyles(div, element, colors, offsets);
  return div;
}

function applyElementStyles(
  domElement,
  element,
  colors,
  offsets = { ox: 0, oy: 0 }
) {
  domElement.style.position = "absolute";
  domElement.style.boxSizing = "border-box";
  const x =
    (element.bounds?.x || 0) + (element.transform?.tx || 0) + (offsets.ox || 0);
  const y =
    (element.bounds?.y || 0) + (element.transform?.ty || 0) + (offsets.oy || 0);
  domElement.style.left = `${x}px`;
  domElement.style.top = `${y}px`;
  domElement.style.width = `${element.bounds?.width || 0}px`;
  domElement.style.height = `${element.bounds?.height || 0}px`;
  if (element.fillColor && colors[element.fillColor]) {
    domElement.style.backgroundColor = colors[element.fillColor].rgb;
  }
  if (
    element.strokeWeight > 0 &&
    element.strokeColor &&
    colors[element.strokeColor]
  ) {
    domElement.style.border = `${element.strokeWeight}px solid ${
      colors[element.strokeColor].rgb
    }`;
  } else {
    domElement.style.border = "1px dashed red";
  }
  if (element.dropShadow) {
    const ds = element.dropShadow;
    domElement.style.filter = `drop-shadow(${ds.offsetX}px ${ds.offsetY}px ${ds.blurRadius}px ${ds.color})`;
  }
  if (element.transform) {
    const t = element.transform;
    if (t.a !== 1 || t.b !== 0 || t.c !== 0 || t.d !== 1) {
      domElement.style.transform = `matrix(${t.a}, ${t.b}, ${t.c}, ${t.d}, 0, 0)`;
    }
  }
  if (element.visible === false) domElement.style.display = "none";
}

function computeOffsets(elements) {
  let minX = 0;
  let minY = 0;
  for (const el of elements || []) {
    const x = (el?.bounds?.x || 0) + (el?.transform?.tx || 0);
    const y = (el?.bounds?.y || 0) + (el?.transform?.ty || 0);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return { ox: minX < 0 ? -minX : 0, oy: minY < 0 ? -minY : 0 };
}

function pickSwatchRGB(colors, name) {
  if (!colors) return null;
  // direct key
  if (colors[name]?.rgb) return colors[name].rgb;
  // fallback: allow "Color/Paper" reference style
  const alt = colors[name.replace(/^Color\//, "")]?.rgb;
  if (alt) return alt;
  return null;
}

function resolveSwatchRGB(colors, ref) {
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

function cmykToRgbCss(C, M, Y, K) {
  const c = (isFinite(C) ? C : 0) / 100;
  const m = (isFinite(M) ? M : 0) / 100;
  const y = (isFinite(Y) ? Y : 0) / 100;
  const k = (isFinite(K) ? K : 0) / 100;
  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));
  return `rgb(${r}, ${g}, ${b})`;
}
