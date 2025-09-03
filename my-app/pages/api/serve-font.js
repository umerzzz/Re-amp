// API endpoint to serve font files directly
import fs from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";

// Font file extensions
const FONT_EXTENSIONS = [".otf", ".ttf", ".woff", ".woff2", ".eot", ".tiff"];

export default async function handler(req, res) {
  try {
    const { uploadId, fontName } = req.query;

    // Validate inputs to prevent directory traversal
    if (!uploadId || typeof uploadId !== "string" || uploadId.includes("..")) {
      return res.status(400).json({ error: "Invalid upload ID" });
    }

    if (!fontName || typeof fontName !== "string" || fontName.includes("..")) {
      return res.status(400).json({ error: "Invalid font name" });
    }

    // Check if font extension is allowed
    if (!FONT_EXTENSIONS.some((ext) => fontName.toLowerCase().endsWith(ext))) {
      return res.status(400).json({ error: "Invalid font file type" });
    }

    // Sanitize requested font name (must match the rename logic: remove spaces/apostrophes)
    const ext = path.extname(fontName);
    const base = path.basename(fontName, ext).replace(/[ '\u00B4`]/g, "");
    const sanitizedFontName = `${base}${ext}`;

    // Path to font file
    let fontPath = path.join(
      process.cwd(),
      "uploads",
      uploadId,
      "Fonts",
      sanitizedFontName
    );

    // Check if file exists
    if (!fs.existsSync(fontPath)) {
      // If not found in /Fonts directory, try /FontUploads
      const altFontPath = path.join(
        process.cwd(),
        "uploads",
        uploadId,
        "FontUploads",
        sanitizedFontName
      );

      if (!fs.existsSync(altFontPath)) {
        console.log(`Font file not found: ${fontPath} or ${altFontPath}`);
        return res.status(404).json({ error: "Font file not found" });
      }

      // Use alternative path if found
      fontPath = altFontPath;
    }

    // Determine MIME type based on extension
    let contentType = "application/octet-stream"; // Default
    if (fontName.endsWith(".otf")) contentType = "font/otf";
    else if (fontName.endsWith(".ttf")) contentType = "font/ttf";
    else if (fontName.endsWith(".woff")) contentType = "font/woff";
    else if (fontName.endsWith(".woff2")) contentType = "font/woff2";
    else if (fontName.endsWith(".eot"))
      contentType = "application/vnd.ms-fontobject";

    // Set appropriate headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year

    // Stream the file to the response
    const fontStream = fs.createReadStream(fontPath);
    fontStream.pipe(res);
  } catch (error) {
    console.error("Error serving font file:", error);
    res.status(500).json({ error: "Failed to serve font file" });
  }
}
