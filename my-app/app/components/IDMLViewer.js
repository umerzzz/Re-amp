"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { IDMLParser } from "../lib/idmlParser";
import {
  createElement,
  computeOffsets,
  pickSwatchRGB,
  loadCustomFonts,
} from "../lib/idmlRenderUtils";

export default function IDMLViewer({ idmlJson, uploadId }) {
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadedFonts, setLoadedFonts] = useState([]);

  const {
    parser,
    docInfo,
    pages,
    colors,
    stories,
    characterStyles,
    paragraphStyles,
  } = useMemo(() => {
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

    // Get styles
    const characterStyles = parser.getCharacterStyles();
    console.log(
      "Character styles retrieved:",
      Object.keys(characterStyles).length
    );

    const paragraphStyles = parser.getParagraphStyles();
    console.log(
      "Paragraph styles retrieved:",
      Object.keys(paragraphStyles).length
    );

    const stories = parser.getStories();
    console.log("Stories retrieved:", Object.keys(stories).length);

    return {
      parser,
      docInfo,
      colors,
      stories,
      pages,
      characterStyles,
      paragraphStyles,
    };
  }, [idmlJson]);

  // Load custom fonts when component mounts or uploadId changes
  useEffect(() => {
    async function loadFonts() {
      if (uploadId) {
        console.log("Loading custom fonts for upload:", uploadId);
        try {
          const fonts = await loadCustomFonts(uploadId);
          setLoadedFonts(fonts);
          console.log("Loaded fonts:", fonts);
        } catch (error) {
          console.error("Error loading fonts:", error);
        }
      }
    }

    loadFonts();
  }, [uploadId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    container.style.position = "relative";
    // Use pt to respect original IDML units
    container.style.width = `${docInfo.width}pt`;
    container.style.height = `${docInfo.height}pt`;
    container.style.overflow = "hidden";
    const paper = pickSwatchRGB(colors, "Paper");
    container.style.background = paper || "white";
    // Render only the currently selected page
    const safeIndex = Math.max(0, Math.min(currentPage, pages.length - 1));
    const page = pages[safeIndex];
    if (page) {
      const pageWrap = document.createElement("div");
      pageWrap.style.position = "relative";
      console.log("docInfo width", docInfo.width);
      console.log("docInfo height", docInfo.height);
      // Use pt so page wrapper matches IDML page size
      pageWrap.style.width = `${docInfo.width}pt`;
      pageWrap.style.height = `${docInfo.height}pt`;
      // Add an internal overlay border so it isn't clipped by overflow
      const borderOverlay = document.createElement("div");
      borderOverlay.style.position = "absolute";
      borderOverlay.style.left = "0";
      borderOverlay.style.top = "0";
      borderOverlay.style.right = "0";
      borderOverlay.style.bottom = "0";
      borderOverlay.style.border = "3px dashed #bbb";
      borderOverlay.style.pointerEvents = "none";
      pageWrap.setAttribute(
        "data-page",
        String(page.pageName ?? safeIndex + 1)
      );
      const offsets = computeOffsets(page.elements);
      for (const el of page.elements) {
        const dom = createElement(el, colors, stories, offsets, parser);
        if (dom) pageWrap.appendChild(dom);
      }
      // ensure border overlay sits on top
      pageWrap.appendChild(borderOverlay);
      container.appendChild(pageWrap);
    }
  }, [docInfo, pages, colors, stories, currentPage, parser]);

  return (
    <div>
      {loadedFonts.length > 0 && (
        <div
          style={{
            padding: "8px",
            backgroundColor: "#f0f9ff",
            borderRadius: "4px",
            fontSize: "0.9rem",
            marginBottom: "10px",
          }}
        >
          <strong>Loaded Fonts:</strong> {loadedFonts.join(", ")}
        </div>
      )}
      <div ref={containerRef} />

      {/* Style Information Section */}
      <div style={{ marginTop: "20px" }}>
        <h3>Document Style Information</h3>

        <details>
          <summary>
            Character Styles ({Object.keys(characterStyles || {}).length})
          </summary>
          <ul style={{ maxHeight: "200px", overflow: "auto" }}>
            {Object.keys(characterStyles || {}).map((styleRef) => {
              const style = characterStyles[styleRef];
              if (!style)
                return <li key={styleRef}>Invalid style: {styleRef}</li>;

              return (
                <li key={styleRef}>
                  <strong>
                    {style["@_Name"] ||
                      styleRef.split("/").pop() ||
                      "Unnamed Style"}
                  </strong>
                  {style["@_PointSize"] && (
                    <span> - Size: {style["@_PointSize"]}</span>
                  )}
                  {style["@_FontStyle"] && (
                    <span> - Style: {style["@_FontStyle"]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>

        <details>
          <summary>
            Paragraph Styles ({Object.keys(paragraphStyles || {}).length})
          </summary>
          <ul style={{ maxHeight: "200px", overflow: "auto" }}>
            {Object.keys(paragraphStyles || {}).map((styleRef) => {
              const style = paragraphStyles[styleRef];
              if (!style)
                return <li key={styleRef}>Invalid style: {styleRef}</li>;

              return (
                <li key={styleRef}>
                  <strong>
                    {style["@_Name"] ||
                      styleRef.split("/").pop() ||
                      "Unnamed Style"}
                  </strong>
                  {style["@_Justification"] && (
                    <span> - Alignment: {style["@_Justification"]}</span>
                  )}
                  {style["@_PointSize"] && (
                    <span> - Size: {style["@_PointSize"]}</span>
                  )}
                  {style["@_FontStyle"] && (
                    <span> - Style: {style["@_FontStyle"]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      </div>

      {pages?.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage <= 0}
          >
            Prev
          </button>
          <span style={{ fontSize: 12 }}>
            Page {currentPage + 1} / {pages.length}
          </span>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(pages.length - 1, p + 1))
            }
            disabled={currentPage >= pages.length - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
