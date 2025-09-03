// Utility functions for rendering IDML elements in React

export function createElement(element, colors, stories, offsets, parser) {
  switch (element.type) {
    case "rectangle":
      return renderBox(element, colors, offsets);
    case "textframe":
      return renderTextFrame(element, colors, stories, offsets, parser);
    case "polygon":
      return renderPolygon(element, colors, stories, offsets);
    case "oval":
      return renderOval(element, colors, stories, offsets, parser); // Use specialized renderer for ovals
    default:
      return null;
  }
}

// Specialized renderer for oval shapes
export function renderOval(element, colors, stories, offsets) {
  // Create a container div to hold the SVG
  const containerDiv = document.createElement("div");
  containerDiv.style.position = "absolute";
  containerDiv.style.zIndex = "2";
  containerDiv.setAttribute("data-shape-type", "oval");

  // Get dimensions from the element
  let width = Math.max(element.bounds?.width || 0, 1);
  let height = Math.max(element.bounds?.height || 0, 1);

  // If bounds are very small or zero, try to get dimensions from transform
  if (width <= 1 || height <= 1) {
    if (element.transform) {
      const transformWidth = Math.abs(element.transform.a) || 0;
      const transformHeight = Math.abs(element.transform.d) || 0;
      if (transformWidth > 1) width = transformWidth;
      if (transformHeight > 1) height = transformHeight;
    }
  }

  // shape debug log removed

  // Create SVG element
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", `${width}pt`);
  svg.setAttribute("height", `${height}pt`);
  svg.style.position = "absolute";
  svg.style.overflow = "visible";

  // Define a viewBox
  const padding = 10;
  svg.setAttribute(
    "viewBox",
    `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`
  );

  // For ovals, use path data to create accurate shape based on Bézier curves
  const shapeElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );

  // Generate path data from points
  const points = element.bounds.points;
  let pathData = "";

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const anchor = point.anchor;
    const leftControl = point.leftDirection;
    const rightControl = point.rightDirection;

    // Adjust coordinates relative to the bounds origin
    const x = anchor[0] - element.bounds.x;
    const y = anchor[1] - element.bounds.y;

    if (i === 0) {
      // Move to first point
      pathData += `M ${x} ${y} `;
    } else {
      const prevPoint = points[i - 1];
      const prevRightControl = prevPoint.rightDirection;
      const prevRightX = prevRightControl[0] - element.bounds.x;
      const prevRightY = prevRightControl[1] - element.bounds.y;

      const leftControlX = leftControl[0] - element.bounds.x;
      const leftControlY = leftControl[1] - element.bounds.y;

      // Always use bezier curves for ovals to get smooth curves
      pathData += `C ${prevRightX} ${prevRightY}, ${leftControlX} ${leftControlY}, ${x} ${y} `;
    }
  }

  // Close the path for ovals
  if (points.length > 2) {
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const firstAnchorX = firstPoint.anchor[0] - element.bounds.x;
    const firstAnchorY = firstPoint.anchor[1] - element.bounds.y;
    const lastRightControlX = lastPoint.rightDirection[0] - element.bounds.x;
    const lastRightControlY = lastPoint.rightDirection[1] - element.bounds.y;
    const firstLeftControlX = firstPoint.leftDirection[0] - element.bounds.x;
    const firstLeftControlY = firstPoint.leftDirection[1] - element.bounds.y;

    pathData += `C ${lastRightControlX} ${lastRightControlY}, ${firstLeftControlX} ${firstLeftControlY}, ${firstAnchorX} ${firstAnchorY} Z`;
  }

  shapeElement.setAttribute("d", pathData);

  // Apply styling to the shape element
  if (element.fillColor) {
    let fillColor = resolveSwatchRGB(colors, element.fillColor);
    if (
      fillColor &&
      element.fillTint !== undefined &&
      element.fillTint !== null
    ) {
      fillColor = applyTint(fillColor, element.fillTint);
    }
    shapeElement.setAttribute("fill", fillColor || "none");
  } else {
    shapeElement.setAttribute("fill", "none");
  }

  if (element.strokeWeight > 0 && element.strokeColor) {
    let strokeColor = resolveSwatchRGB(colors, element.strokeColor);
    if (
      strokeColor &&
      element.strokeTint !== undefined &&
      element.strokeTint !== null
    ) {
      strokeColor = applyTint(strokeColor, element.strokeTint);
    }
    shapeElement.setAttribute("stroke", strokeColor || "black");
    shapeElement.setAttribute("stroke-width", element.strokeWeight);
  } else {
    shapeElement.setAttribute("stroke", "none");
  }

  svg.appendChild(shapeElement);
  containerDiv.appendChild(svg);

  // Add debug info
  if (typeof window !== "undefined" && window.DEBUG_IDML_SHAPES) {
    const debugInfo = document.createElement("div");
    debugInfo.style.position = "absolute";
    debugInfo.style.top = "0";
    debugInfo.style.left = "0";
    debugInfo.style.background = "rgba(255,255,255,0.8)";
    debugInfo.style.fontSize = "10px";
    debugInfo.style.padding = "2px";
    debugInfo.style.pointerEvents = "none";
    debugInfo.textContent = `Oval: ${width}×${height} (${
      element.bounds?.points?.length || 0
    } pts)`;
    containerDiv.appendChild(debugInfo);
  }

  // Apply element styles to position the container
  applyElementStyles(containerDiv, element, colors, offsets);

  // For ovals, override the width/height constraints to allow natural ellipse shape
  containerDiv.style.width = "auto";
  containerDiv.style.height = "auto";
  containerDiv.style.minWidth = `${width}pt`;
  containerDiv.style.minHeight = `${height}pt`;

  return containerDiv;
}

export function renderBox(element, colors, offsets) {
  const div = document.createElement("div");
  div.style.zIndex = "1";
  applyElementStyles(div, element, colors, offsets);
  return div;
}

export function renderPolygon(element, colors, stories, offsets) {
  // Create a container div to hold the SVG
  const containerDiv = document.createElement("div");
  containerDiv.style.position = "absolute";
  containerDiv.style.zIndex = "2";

  // Add shape type attribute
  containerDiv.setAttribute("data-shape-type", element.type || "unknown");

  // shape debug log removed

  // Extract points data from the polygon
  if (
    !element.bounds ||
    !element.bounds.points ||
    element.bounds.points.length === 0
  ) {
    // If this is an oval type, render as ellipse instead of rectangle
    if (element.type === "oval") {
      return renderOval(element, colors, stories, offsets);
    }

    // For other Bézier-like shapes, try to create a basic shape if we have bounds
    if (
      element.bounds &&
      (element.bounds.width > 0 || element.bounds.height > 0)
    ) {
      const basicDiv = renderBox(element, colors, offsets);
      basicDiv.setAttribute("data-fallback", "bounds-only");
      basicDiv.setAttribute("data-original-type", element.type || "unknown");
      return basicDiv;
    }

    // For other shapes, fallback to rectangle
    const fallbackBox = renderBox(element, colors, offsets);
    fallbackBox.setAttribute("data-fallback", "true");
    fallbackBox.setAttribute("data-original-type", element.type || "unknown");
    return fallbackBox;
  }

  const points = element.bounds.points;

  // Compute point-space bounding box relative to element bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const pt of points) {
    const px = pt.anchor[0] - element.bounds.x;
    const py = pt.anchor[1] - element.bounds.y;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxX)) maxX = element.bounds.width || 0;
  if (!Number.isFinite(maxY)) maxY = element.bounds.height || 0;

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  // Add a debug class to help identify the shape type
  containerDiv.className = `idml-polygon shape-${points.length}-points`;

  // Create SVG element sized to the polygon point bounding box
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", `${width}pt`);
  svg.setAttribute("height", `${height}pt`);
  svg.style.position = "absolute";
  svg.style.overflow = "visible"; // Allow paths to extend beyond SVG bounds if needed

  // Define a tight viewBox around the normalized shape (no padding)
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // Create the path element
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  // Generate the SVG path data from the polygon points
  let pathData = "";

  // Check if path is open or closed
  const isPathOpen = element.isPathOpen === true;

  // Special case for triangles and other simple polygons with straight lines only
  const isSimplePolygon = points.every((point) => {
    // Check if all control points are the same as anchor points (straight lines)
    const anchor = point.anchor;
    const leftDirection = point.leftDirection;
    const rightDirection = point.rightDirection;

    return (
      anchor[0] === leftDirection[0] &&
      anchor[1] === leftDirection[1] &&
      anchor[0] === rightDirection[0] &&
      anchor[1] === rightDirection[1]
    );
  });

  if (isSimplePolygon) {
    // For simple polygons, use the simpler polygon notation
    const polygonPoints = points
      .map((point) => {
        const x = point.anchor[0] - element.bounds.x - minX;
        const y = point.anchor[1] - element.bounds.y - minY;
        return `${x},${y}`;
      })
      .join(" ");

    const polygon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    polygon.setAttribute("points", polygonPoints);

    // Apply styling to the polygon
    if (element.fillColor) {
      let fillColor = resolveSwatchRGB(colors, element.fillColor);
      if (
        fillColor &&
        element.fillTint !== undefined &&
        element.fillTint !== null
      ) {
        fillColor = applyTint(fillColor, element.fillTint);
      }
      polygon.setAttribute("fill", fillColor || "none");
    } else {
      polygon.setAttribute("fill", "none");
    }

    if (element.strokeWeight > 0 && element.strokeColor) {
      let strokeColor = resolveSwatchRGB(colors, element.strokeColor);
      if (
        strokeColor &&
        element.strokeTint !== undefined &&
        element.strokeTint !== null
      ) {
        strokeColor = applyTint(strokeColor, element.strokeTint);
      }
      polygon.setAttribute("stroke", strokeColor || "black");
      polygon.setAttribute("stroke-width", element.strokeWeight);
    } else {
      polygon.setAttribute("stroke", "none");
    }

    svg.appendChild(polygon);
  } else {
    // For complex shapes with curves, use the path element
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const anchor = point.anchor;
      const leftControl = point.leftDirection;
      const rightControl = point.rightDirection;

      // Adjust coordinates relative to the bounds origin
      const x = anchor[0] - element.bounds.x - minX;
      const y = anchor[1] - element.bounds.y - minY;

      if (i === 0) {
        // Move to first point
        pathData += `M ${x} ${y} `;
      } else {
        const prevPoint = points[i - 1];
        const prevRightControl = prevPoint.rightDirection;
        const prevRightX = prevRightControl[0] - element.bounds.x - minX;
        const prevRightY = prevRightControl[1] - element.bounds.y - minY;

        const leftControlX = leftControl[0] - element.bounds.x - minX;
        const leftControlY = leftControl[1] - element.bounds.y - minY;

        // Detect if control points are different from anchor points
        const isPrevControlDifferent =
          Math.abs(prevRightX - (prevPoint.anchor[0] - element.bounds.x)) >
            0.01 ||
          Math.abs(prevRightY - (prevPoint.anchor[1] - element.bounds.y)) >
            0.01;
        const isCurrentControlDifferent =
          Math.abs(leftControlX - x) > 0.01 ||
          Math.abs(leftControlY - y) > 0.01;

        if (isPrevControlDifferent || isCurrentControlDifferent) {
          // Bezier curve if control points are different from anchor points
          pathData += `C ${prevRightX} ${prevRightY}, ${leftControlX} ${leftControlY}, ${x} ${y} `;
        } else {
          // Line if control points match anchor points (straight line)
          pathData += `L ${x} ${y} `;
        }
      }
    }

    // Close path if it has more than 2 points and isn't explicitly marked as open
    if (points.length > 2 && !isPathOpen) {
      // Check if we need to add a bezier curve back to the first point
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];

      const firstAnchorX = firstPoint.anchor[0] - element.bounds.x - minX;
      const firstAnchorY = firstPoint.anchor[1] - element.bounds.y - minY;

      const lastRightControlX =
        lastPoint.rightDirection[0] - element.bounds.x - minX;
      const lastRightControlY =
        lastPoint.rightDirection[1] - element.bounds.y - minY;

      const firstLeftControlX =
        firstPoint.leftDirection[0] - element.bounds.x - minX;
      const firstLeftControlY =
        firstPoint.leftDirection[1] - element.bounds.y - minY;

      const isLastControlDifferent =
        Math.abs(lastRightControlX - (lastPoint.anchor[0] - element.bounds.x)) >
          0.01 ||
        Math.abs(lastRightControlY - (lastPoint.anchor[1] - element.bounds.y)) >
          0.01;

      const isFirstLeftControlDifferent =
        Math.abs(firstLeftControlX - firstAnchorX) > 0.01 ||
        Math.abs(firstLeftControlY - firstAnchorY) > 0.01;

      if (isLastControlDifferent || isFirstLeftControlDifferent) {
        // Use bezier curve to close the path
        pathData += `C ${lastRightControlX} ${lastRightControlY}, ${firstLeftControlX} ${firstLeftControlY}, ${firstAnchorX} ${firstAnchorY} Z`;
      } else {
        // Simple line to close the path
        pathData += "Z";
      }
    }

    // Set path attributes
    path.setAttribute("d", pathData);

    // Apply styling
    if (element.fillColor) {
      let fillColor = resolveSwatchRGB(colors, element.fillColor);
      if (
        fillColor &&
        element.fillTint !== undefined &&
        element.fillTint !== null
      ) {
        fillColor = applyTint(fillColor, element.fillTint);
      }
      path.setAttribute("fill", fillColor || "none");
    } else {
      path.setAttribute("fill", "none");
    }

    if (element.strokeWeight > 0 && element.strokeColor) {
      let strokeColor = resolveSwatchRGB(colors, element.strokeColor);
      if (
        strokeColor &&
        element.strokeTint !== undefined &&
        element.strokeTint !== null
      ) {
        strokeColor = applyTint(strokeColor, element.strokeTint);
      }
      path.setAttribute("stroke", strokeColor || "black");
      path.setAttribute("stroke-width", element.strokeWeight);
    } else {
      path.setAttribute("stroke", "none");
    }

    svg.appendChild(path);
  }

  // Add the SVG to the container
  containerDiv.appendChild(svg);

  // Add debug info if needed
  if (typeof window !== "undefined" && window.DEBUG_IDML_SHAPES) {
    const debugInfo = document.createElement("div");
    debugInfo.style.position = "absolute";
    debugInfo.style.top = "0";
    debugInfo.style.left = "0";
    debugInfo.style.background = "rgba(255,255,255,0.8)";
    debugInfo.style.fontSize = "10px";
    debugInfo.style.padding = "2px";
    debugInfo.style.pointerEvents = "none";
    debugInfo.textContent = `Points: ${points.length}, ${
      isSimplePolygon ? "Simple" : "Complex"
    }`;
    containerDiv.appendChild(debugInfo);
  }

  // Apply element styles to position the container
  // Shift container by minX/minY so normalized path stays visually aligned
  const normalizedOffsets = {
    ox: (offsets?.ox || 0) + minX,
    oy: (offsets?.oy || 0) + minY,
  };
  applyElementStyles(containerDiv, element, colors, normalizedOffsets);

  // Ensure container sizing matches the polygon content, not original bounds
  containerDiv.style.width = "auto";
  containerDiv.style.height = "auto";
  containerDiv.style.minWidth = `${width}pt`;
  containerDiv.style.minHeight = `${height}pt`;

  // Handle text on path if present
  if (
    element.textPath &&
    element.textPath.storyId &&
    stories &&
    stories[element.textPath.storyId]
  ) {
    appendTextOnPath(
      svg,
      path || svg.querySelector("polygon"), // Use either path or polygon
      element.textPath,
      stories[element.textPath.storyId],
      colors
    );
  }

  return containerDiv;
}

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

          // GENERIC STYLE PROCESSING:

          // Process all Properties
          if (paraStyle.Properties) {
            Object.entries(paraStyle.Properties).forEach(([key, value]) => {
              if (value && value["#text"] !== undefined) {
                const propValue = value["#text"];

                // Font family
                if (key === "AppliedFont") {
                  pEl.style.fontFamily = propValue;
                }

                // Leading (line height)
                else if (key === "Leading" && propValue !== "Auto") {
                  pEl.style.lineHeight = `${propValue}pt`;
                }

                // Store all properties as data attributes for debugging and custom processing
                pEl.dataset[`idmlProp${key}`] = propValue;
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
                pEl.style.fontSize = `${value}pt`;
              }

              // Font style (bold/italic)
              else if (cssKey === "FontStyle") {
                const fontStyle = String(value).toLowerCase();
                if (fontStyle.includes("bold")) {
                  pEl.style.fontWeight = "bold";
                }
                if (fontStyle.includes("italic")) {
                  pEl.style.fontStyle = "italic";
                }
              }

              // Text color
              else if (cssKey === "FillColor" && colors) {
                const fillColor = resolveSwatchRGB(colors, value);
                if (fillColor) {
                  pEl.style.color = fillColor;
                }
              }

              // Fill opacity/tint
              else if (cssKey === "FillTint" && value !== -1) {
                // Store for later use with fillColor
                pEl.dataset.fillTint = value;
              }

              // Text alignment
              else if (cssKey === "Justification") {
                const styleJust = String(value);
                if (styleJust.includes("Center")) {
                  pEl.style.textAlign = "center";
                } else if (styleJust.includes("Right")) {
                  pEl.style.textAlign = "right";
                } else if (styleJust.includes("Left")) {
                  pEl.style.textAlign = "left";
                } else if (styleJust.includes("Justify")) {
                  pEl.style.textAlign = "justify";
                }
              }

              // Margins
              else if (cssKey === "SpaceBefore") {
                pEl.style.marginTop = `${value}pt`;
              } else if (cssKey === "SpaceAfter") {
                pEl.style.marginBottom = `${value}pt`;
              } else if (cssKey === "LeftIndent") {
                pEl.style.paddingLeft = `${value}pt`;
              } else if (cssKey === "RightIndent") {
                pEl.style.paddingRight = `${value}pt`;
              } else if (cssKey === "FirstLineIndent") {
                pEl.style.textIndent = `${value}pt`;
              }

              // Leading (line height) - use if not already set from Properties
              else if (cssKey === "Leading" && !pEl.style.lineHeight) {
                pEl.style.lineHeight = `${value}pt`;
              }

              // Store all style attributes as data attributes
              pEl.dataset[`idml${cssKey}`] = value;
            }
          });

          // Apply fill color with tint if both are present
          if (
            pEl.style.color &&
            pEl.dataset.fillTint &&
            pEl.dataset.fillTint !== "-1"
          ) {
            const tint = parseFloat(pEl.dataset.fillTint);
            if (!isNaN(tint)) {
              // Parse current color
              let color = pEl.style.color;
              // Apply tint/opacity to the color
              if (color.startsWith("rgb")) {
                // Convert tint to opacity (0-100 to 0-1)
                const opacity = tint / 100;
                // Apply as opacity in rgba
                const rgbValues = color.match(/\d+/g);
                if (rgbValues && rgbValues.length >= 3) {
                  pEl.style.color = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${opacity})`;
                }
              }
            }
          }
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

            // Process all Properties from character style
            if (charStyle.Properties) {
              Object.entries(charStyle.Properties).forEach(([key, value]) => {
                if (value && value["#text"] !== undefined) {
                  const propValue = value["#text"];

                  // Font family
                  if (key === "AppliedFont") {
                    span.style.fontFamily = propValue;
                  }

                  // Store all properties as data attributes
                  span.dataset[`idmlProp${key}`] = propValue;
                }
              });
            }

            // Process all direct attributes from character style
            Object.entries(charStyle).forEach(([key, value]) => {
              if (
                key.startsWith("@_") &&
                value !== undefined &&
                value !== null
              ) {
                const cssKey = key.substring(2); // Remove the @_ prefix

                // Font size
                if (cssKey === "PointSize") {
                  span.style.fontSize = `${value}pt`;
                }

                // Font style
                else if (cssKey === "FontStyle") {
                  const fontStyle = String(value).toLowerCase();
                  if (fontStyle.includes("bold")) {
                    span.style.fontWeight = "bold";
                  }
                  if (fontStyle.includes("italic")) {
                    span.style.fontStyle = "italic";
                  }
                }

                // Text color
                else if (cssKey === "FillColor" && colors) {
                  const fillColor = resolveSwatchRGB(colors, value);
                  if (fillColor) {
                    span.style.color = fillColor;
                  }
                }

                // Fill opacity/tint
                else if (cssKey === "FillTint" && value !== -1) {
                  span.dataset.fillTint = value;
                }

                // Other properties
                else if (cssKey === "Tracking") {
                  span.style.letterSpacing = `${value / 1000}em`;
                }

                // Store all style attributes as data attributes
                span.dataset[`idml${cssKey}`] = value;
              }
            });

            // Apply fill color with tint if both are present
            if (
              span.style.color &&
              span.dataset.fillTint &&
              span.dataset.fillTint !== "-1"
            ) {
              const tint = parseFloat(span.dataset.fillTint);
              if (!isNaN(tint)) {
                // Parse current color
                let color = span.style.color;
                // Apply tint/opacity to the color
                if (color.startsWith("rgb")) {
                  // Convert tint to opacity (0-100 to 0-1)
                  const opacity = tint / 100;
                  // Apply as opacity in rgba
                  const rgbValues = color.match(/\d+/g);
                  if (rgbValues && rgbValues.length >= 3) {
                    span.style.color = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${opacity})`;
                  }
                }
              }
            }
          }
        }

        // Apply inline span properties (these override the style properties)
        if (s.font) span.style.fontFamily = s.font;
        // Prefer explicit point size; default to treating fontSize as points
        const pointSize =
          typeof s.pointSize === "number" ? s.pointSize : s.fontSize;
        if (pointSize) span.style.fontSize = `${pointSize}pt`;
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
        const transforms = [];
        if (isFinite(s.horizontalScale) && Number(s.horizontalScale) !== 100) {
          const sx = Number(s.horizontalScale) / 100;
          transforms.push(`scaleX(${sx})`);
        }
        if (isFinite(s.verticalScale) && Number(s.verticalScale) !== 100) {
          const sy = Number(s.verticalScale) / 100;
          transforms.push(`scaleY(${sy})`);
        }
        if (isFinite(s.skew) && Number(s.skew) !== 0) {
          const sk = Number(s.skew);
          transforms.push(`skewX(${sk}deg)`);
        }
        if (transforms.length) {
          span.style.display = "inline-block";
          span.style.transformOrigin = "left bottom";
          span.style.transform = transforms.join(" ");
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
          span.style.top = `${-s.baselineShift}pt`;
        }
        if (
          s.kerningMethod === "Manual" &&
          typeof s.kerningValue === "number"
        ) {
          // Use em so it scales naturally with font size
          const em = s.kerningValue / 1000;
          span.style.letterSpacing = `${em}em`;
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

export function applyElementStyles(
  domElement,
  element,
  colors,
  offsets = { ox: 0, oy: 0 }
) {
  domElement.style.position = "absolute";
  domElement.style.boxSizing = "border-box";

  // Calculate the total transform by combining element transform with parent transform
  let totalTransform = element.transform || {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: 0,
    ty: 0,
  };

  if (element.parentTransform) {
    // Combine parent transform with element transform
    const parent = element.parentTransform;
    const child = totalTransform;

    totalTransform = {
      a: parent.a * child.a + parent.c * child.b,
      b: parent.b * child.a + parent.d * child.b,
      c: parent.a * child.c + parent.c * child.d,
      d: parent.b * child.c + parent.d * child.d,
      tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
      ty: parent.b * child.tx + parent.d * child.ty + parent.ty,
    };

    // shape debug log removed
  }

  const x = (element.bounds?.x || 0) + totalTransform.tx + (offsets.ox || 0);
  const y = (element.bounds?.y || 0) + totalTransform.ty + (offsets.oy || 0);

  domElement.style.left = `${x}pt`;
  domElement.style.top = `${y}pt`;
  domElement.style.width = `${element.bounds?.width || 0}pt`;
  domElement.style.height = `${element.bounds?.height || 0}pt`;

  // Positioning debug log
  try {
    console.debug("[IDML:position]", {
      type: element.type,
      name: element.name,
      left: x,
      top: y,
      width: element.bounds?.width || 0,
      height: element.bounds?.height || 0,
      offsets,
      bounds: element.bounds,
      transform: element.transform || null,
      parentTransform: element.parentTransform || null,
      totalTransform,
    });
  } catch (_) {}

  // Apply background color only for non-SVG elements
  if (
    element.type !== "polygon" &&
    element.type !== "oval" &&
    element.fillColor
  ) {
    let base = resolveSwatchRGB(colors, element.fillColor);
    if (element.fillTint !== undefined && element.fillTint !== null) {
      base = applyTint(base, element.fillTint);
    }
    if (base) domElement.style.backgroundColor = base;
  }

  // Apply border only for non-SVG elements
  if (element.type !== "polygon" && element.type !== "oval") {
    if (element.strokeWeight > 0 && element.strokeColor) {
      let base = resolveSwatchRGB(colors, element.strokeColor);
      if (
        base &&
        element.strokeTint !== undefined &&
        element.strokeTint !== null
      ) {
        base = applyTint(base, element.strokeTint);
      }
      if (base)
        domElement.style.border = `${element.strokeWeight}pt solid ${base}`;
    } else if (element.type === "rectangle") {
      domElement.style.border = "1px dashed red";
    }
  }

  if (element.dropShadow) {
    const ds = element.dropShadow;
    domElement.style.filter = `drop-shadow(${ds.offsetX}pt ${ds.offsetY}pt ${ds.blurRadius}pt ${ds.color})`;
  }

  // Apply the total transform matrix (excluding translation which we handle via left/top)
  if (
    totalTransform.a !== 1 ||
    totalTransform.b !== 0 ||
    totalTransform.c !== 0 ||
    totalTransform.d !== 1
  ) {
    domElement.style.transform = `matrix(${totalTransform.a}, ${totalTransform.b}, ${totalTransform.c}, ${totalTransform.d}, 0, 0)`;
  }

  if (element.visible === false) domElement.style.display = "none";
}

export function appendTextOnPath(
  svg,
  pathElement,
  textPathInfo,
  story,
  colors
) {
  if (
    !story ||
    !story.paragraphs ||
    story.paragraphs.length === 0 ||
    !pathElement
  ) {
    return;
  }

  // Create a unique ID for the path
  const pathId = `text-path-${Math.random().toString(36).substr(2, 9)}`;
  pathElement.setAttribute("id", pathId);

  // If we're dealing with a polygon, we need to convert it to a path for text to follow
  if (pathElement.tagName.toLowerCase() === "polygon") {
    // Get polygon points
    const points = pathElement
      .getAttribute("points")
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y };
      });

    if (points.length > 0) {
      // Create a path element that follows the polygon outline
      const pathForText = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );

      // Generate path data from polygon points
      let pathData = `M ${points[0].x} ${points[0].y} `;
      for (let i = 1; i < points.length; i++) {
        pathData += `L ${points[i].x} ${points[i].y} `;
      }
      pathData += "Z";

      pathForText.setAttribute("d", pathData);
      pathForText.setAttribute("id", pathId);
      pathForText.style.fill = "none"; // Make the path invisible
      pathForText.style.stroke = "none";

      // Replace the original reference with the new path
      svg.appendChild(pathForText);
      pathElement = pathForText;
    }
  }

  // Create text element
  const textElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );

  // Create textPath element
  const textPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "textPath"
  );
  textPath.setAttribute("href", `#${pathId}`);

  // Handle alignment
  if (textPathInfo.alignment === "CenterAlign") {
    textPath.setAttribute("text-anchor", "middle");
    textPath.setAttribute("startOffset", "50%");
  } else if (textPathInfo.alignment === "RightAlign") {
    textPath.setAttribute("text-anchor", "end");
    textPath.setAttribute("startOffset", "100%");
  } else {
    // Default to left alignment
    textPath.setAttribute("startOffset", "0%");
  }

  // Handle text effect
  if (textPathInfo.effect === "RainbowPath") {
    // Rainbow effect could be simulated with gradients
    const gradient = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "linearGradient"
    );
    const gradientId = `rainbow-${Math.random().toString(36).substr(2, 9)}`;
    gradient.setAttribute("id", gradientId);

    // Add rainbow stops
    const rainbowColors = [
      "#ff0000",
      "#ff7f00",
      "#ffff00",
      "#00ff00",
      "#0000ff",
      "#4b0082",
      "#8b00ff",
    ];
    rainbowColors.forEach((color, i) => {
      const stop = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "stop"
      );
      stop.setAttribute("offset", `${i * (100 / (rainbowColors.length - 1))}%`);
      stop.setAttribute("stop-color", color);
      gradient.appendChild(stop);
    });

    svg.appendChild(gradient);
    textPath.setAttribute("fill", `url(#${gradientId})`);
  }

  // Add text content from story
  let combinedText = "";
  for (const para of story.paragraphs) {
    for (const span of para.spans) {
      combinedText += span.text || "";
    }
  }

  textPath.textContent = combinedText;

  // Apply font properties from the first span (simplification)
  if (
    story.paragraphs[0] &&
    story.paragraphs[0].spans &&
    story.paragraphs[0].spans[0]
  ) {
    const span = story.paragraphs[0].spans[0];
    if (span.font) textPath.setAttribute("font-family", span.font);
    const pointSize =
      typeof span.pointSize === "number" ? span.pointSize : span.fontSize;
    if (pointSize) textPath.setAttribute("font-size", `${pointSize}pt`);
    if (span.fillColor) {
      const color = resolveSwatchRGB(colors, span.fillColor);
      if (color) textPath.setAttribute("fill", color);
    }
  }

  textElement.appendChild(textPath);
  svg.appendChild(textElement);
}

export function computeOffsets(elements) {
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

export function pickSwatchRGB(colors, name) {
  if (!colors) return null;
  if (colors[name]?.rgb) return colors[name].rgb;
  const alt = colors[name.replace(/^Color\//, "")]?.rgb;
  if (alt) return alt;
  return null;
}

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

// Apply an InDesign-style tint percentage (0-100) to an RGB color string
function applyTint(rgbString, tintPercent) {
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
