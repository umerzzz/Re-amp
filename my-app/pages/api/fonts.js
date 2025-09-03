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

    // Helper to sanitize font filenames (remove spaces and apostrophes only)
    const sanitizeFontFileName = (name) => {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      const cleanedBase = base.replace(/[ '\u00B4`]/g, "");
      return `${cleanedBase}${ext}`;
    };

    // Ensure a unique filename within a directory
    const ensureUniqueName = async (dir, desired) => {
      let candidate = desired;
      let counter = 1;
      while (fs.existsSync(path.join(dir, candidate))) {
        const ext = path.extname(desired);
        const base = path.basename(desired, ext);
        candidate = `${base}-${counter++}${ext}`;
      }
      return candidate;
    };

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

        const fontFiles = [];
        for (const file of files) {
          // Only consider supported font extensions
          if (
            !FONT_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
          ) {
            continue;
          }

          // Sanitize filenames by removing spaces and apostrophes
          const sanitized = sanitizeFontFileName(file);
          let finalName = file;

          if (sanitized !== file) {
            try {
              const fromPath = path.join(dirPath, file);
              let toName = await ensureUniqueName(dirPath, sanitized);
              const toPath = path.join(dirPath, toName);
              await fs.promises.rename(fromPath, toPath);
              finalName = toName;
              console.log(
                `Renamed font '${file}' -> '${toName}' in ${dirPath}`
              );
            } catch (renameErr) {
              console.warn(
                `Failed to rename font '${file}' in ${dirPath}:`,
                renameErr
              );
              finalName = file; // fall back to original
            }
          }

          fontFiles.push({
            name: finalName,
            path: `/uploads/${uploadId}/${path.basename(dirPath)}/${finalName}`,
            directory: path.basename(dirPath),
          });
        }

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
