import fs from "fs";
import path from "path";
import IDMLViewer from "../../components/IDMLViewer";

async function readFirstIdmlJson(uploadId) {
  const uploadDir = path.join(process.cwd(), "uploads", uploadId);
  if (!fs.existsSync(uploadDir)) return null;

  // Prefer any raw_data.json produced from extracted IDML
  const stack = [uploadDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && e.name === "raw_data.json") {
        try {
          const raw = await fs.promises.readFile(full, "utf8");
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
    }
  }
  // Fallback: try to read upload-metadata.json and follow first file path
  try {
    const metaPath = path.join(uploadDir, "upload-metadata.json");
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(await fs.promises.readFile(metaPath, "utf8"));
      // Try to derive a likely raw_data.json location from extractedTo
      const first = meta?.files?.find((f) => f.extractedTo);
      if (first?.extractedTo) {
        const candidate = path.join(
          path.dirname(uploadDir),
          first.extractedTo,
          "raw_data.json"
        );
        if (fs.existsSync(candidate)) {
          const raw = await fs.promises.readFile(candidate, "utf8");
          return JSON.parse(raw);
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export default async function ViewPage({ params }) {
  const { uploadId } = await params;
  const idmlJson = await readFirstIdmlJson(uploadId);

  return (
    <div style={{ padding: 24 }}>
      <h1>Upload: {uploadId}</h1>
      {idmlJson ? (
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <IDMLViewer idmlJson={idmlJson} />
        </div>
      ) : (
        <p>No IDML data found for this upload.</p>
      )}
    </div>
  );
}
