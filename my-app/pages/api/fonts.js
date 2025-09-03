// API endpoint to list fonts for a specific upload
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

    // Paths to check for font files
    const fontsDirs = [
      path.join(process.cwd(), "uploads", uploadId, "Fonts"),
      path.join(process.cwd(), "uploads", uploadId, "FontUploads"),
    ];

    console.log(`Checking for fonts in directories:`, fontsDirs);

    // Collect all font files from all directories
    const allFontFiles = [];

    // Check each directory
    for (const dirPath of fontsDirs) {
      // Skip if directory doesn't exist
      if (!fs.existsSync(dirPath)) {
        console.log(`Directory not found: ${dirPath}`);
        continue;
      }

      try {
        // Get list of files in the directory
        const files = await fs.promises.readdir(dirPath);

        // Filter for font files
        const fontFiles = files
          .filter((file) =>
            FONT_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
          )
          .map((file) => ({
            name: file,
            path: `/uploads/${uploadId}/${path.basename(dirPath)}/${file}`,
            directory: path.basename(dirPath),
          }));

        // Add to our collection
        allFontFiles.push(...fontFiles);
        console.log(`Found ${fontFiles.length} fonts in ${dirPath}`);
      } catch (dirError) {
        console.error(`Error reading directory ${dirPath}:`, dirError);
      }
    }

    // Deduplicate by font name (in case the same font appears in multiple directories)
    const uniqueFontFiles = Array.from(
      new Map(allFontFiles.map((font) => [font.name, font])).values()
    );

    res.status(200).json(uniqueFontFiles);
  } catch (error) {
    console.error("Error listing fonts:", error);
    res.status(500).json({ error: "Failed to list fonts" });
  }
}
