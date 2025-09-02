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

  const { parser, docInfo, elements, colors, stories, offsets } =
    useMemo(() => {
      console.log(
        "Creating parser with JSON data size:",
        idmlJson ? Object.keys(idmlJson).length : 0,
        "keys"
      );
      const parser = new IDMLParser(idmlJson);
      console.log("Parser created successfully");
      const elements = parser.getSpreadElements();
      console.log("Elements retrieved:", elements.length);
      const offsets = computeOffsets(elements);

      const docInfo = parser.getDocumentInfo();
      console.log("Document info:", docInfo);

      const colors = parser.getColors();
      console.log("Colors retrieved:", Object.keys(colors).length);

      const stories = parser.getStories();
      console.log("Stories retrieved:", Object.keys(stories).length);

      return {
        parser,
        docInfo,
        colors,
        stories,
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
