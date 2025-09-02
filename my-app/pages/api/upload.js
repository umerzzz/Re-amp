import formidable from "formidable";
import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { XMLParser } from "fast-xml-parser";

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

  const uploadRoot = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }

  const form = formidable({
    multiples: true,
    keepExtensions: true,
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

    for (const file of fileList) {
      if (!file || !file.originalFilename) continue;
      const originalName = file.originalFilename;
      const tmpPath = file.filepath || file.path;

      // Normalize potential nested paths from folder uploads
      const normalized = originalName.replace(/\\\\/g, "/");
      const safeRelative = normalized
        .split("/")
        .filter((seg) => seg && seg !== "." && seg !== "..")
        .join("/");

      const destPath = path.resolve(uploadRoot, safeRelative);
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
        const extractDir = destPath.replace(/\.idml$/i, "");
        await fs.promises.mkdir(extractDir, { recursive: true });
        await unzipper.Open.file(destPath).then((d) =>
          d.extract({ path: extractDir, concurrency: 5 })
        );

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

        entries.push({
          name: originalName,
          extractedTo: path.relative(uploadRoot, extractDir),
          xmlJson,
          rawDataPath: path.relative(uploadRoot, rawDataFile),
        });
      } else {
        entries.push({
          name: originalName,
          savedAs: path.relative(uploadRoot, destPath),
        });
      }
    }

    return res.status(200).json({ ok: true, files: entries });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Upload failed" });
  }
}
