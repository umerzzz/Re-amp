"use client";
import { useEffect, useMemo, useRef } from "react";
import { IDMLParser } from "../lib/idmlParser";
import {
  createElement,
  computeOffsets,
  pickSwatchRGB,
} from "../lib/idmlRenderUtils";

export default function IDMLViewer({ idmlJson }) {
  const containerRef = useRef(null);

  const { parser, docInfo, pages, colors, stories } = useMemo(() => {
    console.log(
      "Creating parser with JSON data size:",
      idmlJson ? Object.keys(idmlJson).length : 0,
      "keys"
    );
    const parser = new IDMLParser(idmlJson);
    console.log("Parser created successfully");
    const pages = parser.getPages();
    console.log("Pages retrieved:", pages.length);

    const docInfo = parser.getDocumentInfo();
    console.log("Document info:", docInfo);

    const colors = parser.getColors();
    console.log("Colors retrieved:", Object.keys(colors).length);

    const stories = parser.getStories();
    console.log("Stories retrieved:", Object.keys(stories).length);

    return { parser, docInfo, colors, stories, pages };
  }, [idmlJson]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    container.style.position = "relative";
    container.style.width = `${docInfo.width}px`;
    container.style.minHeight = `${docInfo.height}px`;
    container.style.overflow = "hidden";
    const paper = pickSwatchRGB(colors, "Paper");
    container.style.background = paper || "white";
    container.style.border = "1px solid #ddd";

    let pageIndex = 0;
    for (const page of pages) {
      const pageWrap = document.createElement("div");
      pageWrap.style.position = "relative";
      pageWrap.style.width = `${docInfo.width}px`;
      pageWrap.style.height = `${docInfo.height}px`;
      pageWrap.style.marginBottom = "24px";
      pageWrap.setAttribute(
        "data-page",
        String(page.pageName ?? pageIndex + 1)
      );
      const offsets = computeOffsets(page.elements);
      for (const el of page.elements) {
        const dom = createElement(el, colors, stories, offsets);
        if (dom) pageWrap.appendChild(dom);
      }
      container.appendChild(pageWrap);
      if (pageIndex < pages.length - 1) {
        const sep = document.createElement("div");
        sep.style.width = `${docInfo.width}px`;
        sep.style.height = "0";
        sep.style.borderTop = "2px dashed #bbb";
        sep.style.margin = "12px 0 24px 0";
        sep.setAttribute("aria-hidden", "true");
        container.appendChild(sep);
      }
      pageIndex += 1;
    }
  }, [docInfo, pages, colors, stories]);

  return (
    <div>
      <div ref={containerRef} />
    </div>
  );
}
