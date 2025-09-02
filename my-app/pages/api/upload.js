import formidable from "formidable";
import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { XMLParser } from "fast-xml-parser";
import { sendRunScriptWithFile } from "../../app/lib/indesignSoap";

async function walkDir(root, dir, out) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkDir(root, full, out);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".xml")) {
      const rel = path.relative(root, full);
      const xml = await fs.promises.readFile(full, "utf8");
      out.push({ relPath: rel, xml });
    }
  }
}

function parseAllXml(xmlFiles) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
  });
  const json = {};
  for (const f of xmlFiles) {
    try {
      json[f.relPath] = parser.parse(f.xml);
    } catch (e) {
      json[f.relPath] = { error: "parse_error" };
    }
  }
  return json;
}

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "100mb",
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Create a timestamped folder for this upload batch
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uploadRoot = path.join(process.cwd(), "uploads", timestamp);
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }

  const form = formidable({
    multiples: true,
    keepExtensions: true,
    allowEmptyFiles: true,
    minFileSize: 0,
  });

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const entries = [];
    const candidates = files.file || files.files || files.upload || [];
    const fileList = Array.isArray(candidates) ? candidates : [candidates];

    // Create a metadata object to store information about this upload batch
    const uploadMetadata = {
      timestamp: new Date().toISOString(),
      totalFiles: fileList.length,
      files: [],
    };

    for (const file of fileList) {
      if (!file || !file.originalFilename) continue;
      const originalName = file.originalFilename;
      const tmpPath = file.filepath || file.path;
      // Skip empty placeholder entries (e.g., directories in folder uploads)
      if (!tmpPath || file.size === 0) {
        continue;
      }

      // Normalize potential nested paths from folder uploads
      const normalized = originalName.replace(/\\\\/g, "/");
      const safeRelative = normalized
        .split("/")
        .filter((seg) => seg && seg !== "." && seg !== "..")
        .join("/");

      // Create a folder for this file within the timestamp folder
      const fileFolderName = safeRelative
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .substring(0, 50);
      const fileDir = path.join(uploadRoot, fileFolderName);
      await fs.promises.mkdir(fileDir, { recursive: true });

      const destPath = path.resolve(fileDir, path.basename(safeRelative));
      const uploadsRootAbs = path.resolve(uploadRoot);
      if (!destPath.startsWith(uploadsRootAbs)) {
        // Prevent path traversal outside uploads
        continue;
      }

      // Ensure parent directory exists for nested paths
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

      // Move/copy file to uploads
      await fs.promises.copyFile(tmpPath, destPath);

      if (originalName.toLowerCase().endsWith(".idml")) {
        // Create a directory for the extracted contents with the same name but without .idml extension
        const baseName = path.basename(destPath, ".idml");
        const extractDir = path.join(path.dirname(destPath), baseName);
        await fs.promises.mkdir(extractDir, { recursive: true });

        // Extract the IDML file (which is a zip) to the extractDir
        await unzipper.Open.file(destPath).then((d) =>
          d.extract({ path: extractDir, concurrency: 5 })
        );

        // Process all XML files in the extracted directory
        const xmlFiles = [];
        await walkDir(extractDir, extractDir, xmlFiles);
        const xmlJson = parseAllXml(xmlFiles);

        // Persist parsed JSON to a single file in the extracted directory
        const rawDataFile = path.join(extractDir, "raw_data.json");
        await fs.promises.writeFile(
          rawDataFile,
          JSON.stringify(xmlJson, null, 2),
          "utf8"
        );

        const fileInfo = {
          name: originalName,
          extractedTo: path.relative(path.dirname(uploadRoot), extractDir),
          xmlJson,
          rawDataPath: path.relative(path.dirname(uploadRoot), rawDataFile),
          timestamp: new Date().toISOString(),
        };

        entries.push(fileInfo);
        uploadMetadata.files.push({
          name: originalName,
          type: "idml",
          extractedTo: path.relative(path.dirname(uploadRoot), extractDir),
        });
      } else if (
        originalName.toLowerCase().endsWith(".indd") ||
        originalName.toLowerCase().endsWith(".indt")
      ) {
        // Send to InDesign Server for packaging/export
        const idsResponse = await sendRunScriptWithFile({
          serverHost: "127.0.0.1",
          serverPort: 1235,
          filePath: destPath,
          exportFolderPath: path.dirname(destPath),
          packageFolderPath: path.join(path.dirname(destPath), "packaged"),
        });
        // Try to locate the generated IDML and process it like native IDML uploads
        const pkgDir = path.join(path.dirname(destPath), "packaged");
        let generatedIdml = null;
        if (fs.existsSync(pkgDir)) {
          const stack = [pkgDir];
          while (stack.length && !generatedIdml) {
            const cur = stack.pop();
            const items = await fs.promises.readdir(cur, {
              withFileTypes: true,
            });
            for (const it of items) {
              const full = path.join(cur, it.name);
              if (it.isDirectory()) stack.push(full);
              else if (it.isFile() && it.name.toLowerCase().endsWith(".idml")) {
                generatedIdml = full;
                break;
              }
            }
          }
        }

        let idmlExtractedTo = null;
        let idmlRawDataPath = null;
        let xmlJson = null;
        if (generatedIdml) {
          const baseName = path.basename(generatedIdml, ".idml");
          const extractBase = path.join(
            path.dirname(generatedIdml),
            `${baseName}-idml`
          );
          let extractDir = extractBase;
          let suffix = 1;
          while (
            fs.existsSync(extractDir) &&
            !fs.lstatSync(extractDir).isDirectory()
          ) {
            extractDir = `${extractBase}-${suffix++}`;
          }
          if (!fs.existsSync(extractDir)) {
            await fs.promises.mkdir(extractDir, { recursive: true });
          }
          await unzipper.Open.file(generatedIdml).then((d) =>
            d.extract({ path: extractDir, concurrency: 5 })
          );
          const xmlFiles = [];
          await walkDir(extractDir, extractDir, xmlFiles);
          xmlJson = parseAllXml(xmlFiles);
          const rawDataFile = path.join(extractDir, "raw_data.json");
          await fs.promises.writeFile(
            rawDataFile,
            JSON.stringify(xmlJson, null, 2),
            "utf8"
          );
          idmlExtractedTo = path.relative(path.dirname(uploadRoot), extractDir);
          idmlRawDataPath = path.relative(
            path.dirname(uploadRoot),
            rawDataFile
          );
        }

        const fileInfo = {
          name: originalName,
          savedAs: path.relative(path.dirname(uploadRoot), destPath),
          ids: { status: idsResponse.status, ok: idsResponse.ok },
          idsRaw: idsResponse.body,
          idmlExtractedTo,
          idmlRawDataPath,
          xmlJson,
          timestamp: new Date().toISOString(),
        };

        entries.push(fileInfo);
        uploadMetadata.files.push({
          name: originalName,
          type: path.extname(originalName).substring(1) || "unknown",
          savedAs: path.relative(path.dirname(uploadRoot), destPath),
          ids: { status: idsResponse.status, ok: idsResponse.ok },
          idmlExtractedTo,
        });
      } else {
        const fileInfo = {
          name: originalName,
          savedAs: path.relative(path.dirname(uploadRoot), destPath),
          timestamp: new Date().toISOString(),
        };

        entries.push(fileInfo);
        uploadMetadata.files.push({
          name: originalName,
          type: path.extname(originalName).substring(1) || "unknown",
          savedAs: path.relative(path.dirname(uploadRoot), destPath),
        });
      }
    }

    // Save metadata file
    const metadataPath = path.join(uploadRoot, "upload-metadata.json");
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(uploadMetadata, null, 2),
      "utf8"
    );

    return res.status(200).json({
      ok: true,
      files: entries,
      uploadId: path.basename(uploadRoot),
      timestamp: uploadMetadata.timestamp,
    });
  } catch (error) {
    console.error("Upload failed:", error);

    // Log error to a file in the upload directory if it was created
    try {
      if (fs.existsSync(uploadRoot)) {
        const errorLogPath = path.join(uploadRoot, "error.log");
        await fs.promises.writeFile(
          errorLogPath,
          `Error occurred at ${new Date().toISOString()}\n${
            error.stack || error.toString()
          }`,
          "utf8"
        );
      }
    } catch (logError) {
      console.error("Failed to write error log:", logError);
    }

    return res.status(500).json({
      error: "Upload failed",
      message: error.message || "Unknown error occurred during upload",
    });
  }
}
