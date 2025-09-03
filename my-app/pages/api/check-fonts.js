// API route to check font directory status
import path from "path";
import fs from "fs";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req, res) {
  const { uploadId } = req.query;

  if (!uploadId) {
    return res.status(400).json({ error: "Upload ID is required" });
  }

  try {
    // Check if the upload directory exists
    const uploadDir = path.join(process.cwd(), "uploads", uploadId);
    const fontsDir = path.join(uploadDir, "Fonts");

    const result = {
      uploadExists: fs.existsSync(uploadDir),
      fontsExists: fs.existsSync(fontsDir),
      fonts: [],
    };

    if (result.fontsExists) {
      try {
        const fontFiles = await fs.promises.readdir(fontsDir);
        result.fonts = fontFiles.filter((file) =>
          [".otf", ".ttf", ".woff", ".woff2", ".eot"].some((ext) =>
            file.toLowerCase().endsWith(ext)
          )
        );
      } catch (err) {
        result.error = `Error reading fonts directory: ${err.message}`;
      }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error checking font directory:", error);
    res.status(500).json({ error: "Failed to check font directory" });
  }
}
