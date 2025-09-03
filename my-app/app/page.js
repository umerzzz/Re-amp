"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
const IDMLViewer = dynamic(() => import("./components/IDMLViewer"), {
  ssr: false,
});
import styles from "./page.module.css";

export default function Home() {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const router = useRouter();

  const onDrop = useCallback((event) => {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer?.files;
    if (!dropped || dropped.length === 0) return;
    setFiles(Array.from(dropped));
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((event) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  const chooseFolder = () => {
    inputRef.current?.click();
  };

  const onFilesSelected = (event) => {
    const selected = event.target.files;
    if (!selected || selected.length === 0) return;
    setFiles(Array.from(selected));
  };

  const upload = async () => {
    if (files.length === 0) return;
    const form = new FormData();
    for (const file of files) {
      form.append("file", file);
    }
    setUploading(true);
    setResult(null);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      setResult(json);
      if (json?.uploadId) {
        router.push(`/view/${encodeURIComponent(json.uploadId)}`);
      }
    } catch (e) {
      setResult({ error: "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const idmlCount = useMemo(
    () => files.filter((f) => f.name.toLowerCase().endsWith(".idml")).length,
    [files]
  );

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Upload .idml files or a folder</h1>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          style={{
            border: "2px dashed",
            padding: 24,
            borderColor: dragActive ? "#09f" : "#999",
            borderRadius: 12,
            width: 480,
            maxWidth: "100%",
            textAlign: "center",
          }}
        >
          <p>Drag and drop files or a folder here</p>
          <button
            className={styles.secondary}
            onClick={chooseFolder}
            disabled={uploading}
          >
            Choose folder/files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            webkitdirectory="true"
            directory="true"
            style={{ display: "none" }}
            onChange={onFilesSelected}
          />
        </div>

        {files.length > 0 && (
          <div>
            <p>
              Selected: {files.length} files
              {idmlCount ? `, ${idmlCount} .idml` : ""}
            </p>
            <ul>
              {files.slice(0, 10).map((f, i) => (
                <li key={i}>{f.webkitRelativePath || f.name}</li>
              ))}
              {files.length > 10 && <li>…and {files.length - 10} more</li>}
            </ul>
            <button
              className={styles.primary}
              onClick={upload}
              disabled={uploading}
            >
              {" "}
              {uploading ? "Uploading…" : "Upload"}{" "}
            </button>
          </div>
        )}

        {result?.files?.length > 0 && result.files.find((f) => f.xmlJson) && (
          <div style={{ marginTop: 24 }}>
            <h2>Rendered preview</h2>
            <IDMLViewer
              idmlJson={result.files.find((f) => f.xmlJson).xmlJson}
            />
          </div>
        )}

        {result && (
          <details>
            <summary>Raw response</summary>
            <pre style={{ maxWidth: 640, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        )}
        {uploading && (
          <div className="uploadOverlay" aria-live="polite" aria-busy="true">
            <div className="spinner" />
            <div className="message">Uploading and processing…</div>
            <style jsx>{`
              .uploadOverlay {
                position: fixed;
                inset: 0;
                background: rgba(255, 255, 255, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                backdrop-filter: blur(1px);
              }
              .spinner {
                width: 28px;
                height: 28px;
                border: 3px solid #cfd8dc;
                border-top-color: #0070f3;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-right: 10px;
              }
              .message {
                font-size: 14px;
                color: #333;
              }
              @keyframes spin {
                0% {
                  transform: rotate(0deg);
                }
                100% {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </div>
        )}
      </main>
    </div>
  );
}
