// API endpoint to debug font discovery
import fs from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";

// Font file extensions
const FONT_EXTENSIONS = [".otf", ".ttf", ".woff", ".woff2", ".eot", ".tiff"];

export default async function handler(req, res) {
  try {
    const { uploadId } = req.query;

    // Validate uploadId to prevent directory traversal
    if (!uploadId || typeof uploadId !== "string" || uploadId.includes("..")) {
      return res.status(400).json({ error: "Invalid upload ID" });
    }

    // Root path for this upload
    const uploadRoot = path.join(process.cwd(), "uploads", uploadId);
    if (!fs.existsSync(uploadRoot)) {
      return res.status(404).json({ error: "Upload directory not found" });
    }

    // Scan for all font files in the upload directory
    const fontLocations = [];

    // Recursively scan the directory for fonts
    async function scanDirectory(dir, depth = 0) {
      if (depth > 3) return; // Limit recursion depth

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (
            entry.isFile() &&
            FONT_EXTENSIONS.some((ext) =>
              entry.name.toLowerCase().endsWith(ext)
            )
          ) {
            // Found a font file
            fontLocations.push({
              path: path.relative(uploadRoot, fullPath),
              name: entry.name,
              fullPath: fullPath,
            });
          } else if (entry.isDirectory()) {
            // Recurse into subdirectories
            await scanDirectory(fullPath, depth + 1);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    }

    // Start the scan
    await scanDirectory(uploadRoot);

    // Write findings to a debug file in the upload directory
    const debugFilePath = path.join(uploadRoot, "font-debug.json");

    const debugData = {
      uploadId: uploadId,
      timestamp: new Date().toISOString(),
      fontLocations: fontLocations,
      fontCount: fontLocations.length,
    };

    await fs.promises.writeFile(
      debugFilePath,
      JSON.stringify(debugData, null, 2),
      "utf8"
    );

    res.status(200).json({
      message: "Font debug data written",
      location: `/uploads/${uploadId}/font-debug.json`,
      fontCount: fontLocations.length,
      fontLocations: fontLocations,
    });
  } catch (error) {
    console.error("Error in font debug endpoint:", error);
    res.status(500).json({ error: "Failed to analyze fonts" });
  }
}
