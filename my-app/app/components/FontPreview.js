"use client";

import { useEffect, useState } from "react";
import { loadCustomFonts } from "../lib/idmlRenderUtils";

export default function FontPreview({ uploadId }) {
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadFonts() {
      if (!uploadId) {
        setError("No upload ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const loadedFonts = await loadCustomFonts(uploadId);
        setFonts(loadedFonts);
        setLoading(false);
      } catch (err) {
        console.error("Error loading fonts:", err);
        setError(`Error loading fonts: ${err.message}`);
        setLoading(false);
      }
    }

    loadFonts();
  }, [uploadId]);

  return (
    <div className="font-preview">
      <h2>Fonts Preview</h2>

      {loading && <p>Loading fonts...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && fonts.length === 0 && (
        <p>No fonts found for this upload.</p>
      )}

      {fonts.length > 0 && (
        <div>
          <p>Loaded {fonts.length} fonts:</p>
          <ul className="font-list">
            {fonts.map((fontName, index) => (
              <li key={index} style={{ fontFamily: fontName }}>
                <span className="font-name">{fontName}:</span>
                <span className="font-sample">
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz
                  0123456789
                </span>
              </li>
            ))}
          </ul>

          <style jsx>{`
            .font-list {
              list-style-type: none;
              padding: 0;
            }

            .font-list li {
              margin-bottom: 20px;
              padding: 10px;
              border: 1px solid #eee;
              border-radius: 4px;
            }

            .font-name {
              display: block;
              font-family: system-ui, sans-serif;
              font-weight: bold;
              margin-bottom: 8px;
            }

            .font-sample {
              font-size: 18px;
              display: block;
              overflow-x: auto;
              white-space: nowrap;
              padding: 8px 0;
            }

            .error {
              color: red;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
