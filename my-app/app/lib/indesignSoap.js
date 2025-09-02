import fs from "fs";
import path from "path";

function buildRunScriptEnvelope({
  scriptSource,
  scriptLanguage = "javascript",
  scriptArgs = "",
}) {
  const scriptLangCode =
    scriptLanguage.toLowerCase() === "applescript"
      ? "applescript"
      : "javascript";
  const xmlEsc = (s) =>
    (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ins="http://ns.adobe.com/InDesign/soap/">
  <soapenv:Body>
    <ins:RunScript>
      <ins:runScriptParameters>
        <ins:scriptText>${xmlEsc(scriptSource)}</ins:scriptText>
        <ins:scriptLanguage>${xmlEsc(scriptLangCode)}</ins:scriptLanguage>
        <ins:scriptArgs>${xmlEsc(scriptArgs)}</ins:scriptArgs>
      </ins:runScriptParameters>
    </ins:RunScript>
  </soapenv:Body>
</soapenv:Envelope>`;

  return envelope;
}

async function readFileBuffer(filePath) {
  return fs.promises.readFile(filePath);
}

export async function sendRunScriptWithFile({
  serverHost = "127.0.0.1",
  serverPort = 1235,
  filePath,
  exportFolderPath,
  packageFolderPath,
}) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".indd" && ext !== ".indt") {
    throw new Error("Unsupported extension; expected .indd or .indt");
  }

  const safeExport = exportFolderPath || path.dirname(filePath);
  const safePackage = packageFolderPath || path.dirname(filePath);

  const jsx = `
  (function(){
    function ensureFolder(p){
      var f = new Folder(p); if(!f.exists){ f.create(); }
      return f;
    }
    function tryPackage(doc, packageFolder){
      // Try modern signature
      try{
        doc.packageForPrint(packageFolder, true, true, true, true, true, true, true, true, false, "", false, "", false);
        return "signature_modern";
      }catch(e1){}
      // Try variant with reportFile after versionComments
      try{
        var reportFile = File(packageFolder.fsName + "/PackageReport.txt");
        doc.packageForPrint(packageFolder, true, true, true, true, true, true, true, "", reportFile, true, false, "", false, false);
        return "signature_with_report";
      }catch(e2){}
      // Try legacy signature (no extras)
      try{
        doc.packageForPrint(packageFolder, true, true, true, true, true, true, true);
        return "signature_legacy";
      }catch(e3){
        return "failed:" + e3;
      }
    }
    var exportFolder = ensureFolder(${JSON.stringify(safeExport)});
    var packageFolder = ensureFolder(${JSON.stringify(safePackage)});
    // Open the uploaded document directly from disk
    var inputFile = File(${JSON.stringify(filePath)});
    if(!inputFile.exists){
      return JSON.stringify({ ok:false, error:"input_file_not_found", path: inputFile.fsName });
    }
    var doc = app.open(inputFile);
    // Export PDF
    var pdfFile = File(exportFolder.fsName + "/" + (doc.name.replace(/\\.ind[dt]$/i,'') + ".pdf"));
    doc.exportFile(ExportFormat.PDF_TYPE, pdfFile);
    var pkgVariant = tryPackage(doc, packageFolder);
    var result = "ok=true|pdf=" + pdfFile.fsName + "|packagedTo=" + packageFolder.fsName + "|name=" + doc.name + "|pkgVariant=" + pkgVariant;
    doc.close(SaveOptions.NO);
    return result;
  })();
  `;

  const soapXml = buildRunScriptEnvelope({
    scriptSource: jsx,
    scriptLanguage: "javascript",
    scriptArgs: "",
  });

  const url = `http://${serverHost}:${serverPort}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPAction: "http://ns.adobe.com/InDesign/soap/RunScript",
    },
    body: soapXml,
  });

  const text = await res.text();
  return { status: res.status, ok: res.ok, body: text };
}

export default { sendRunScriptWithFile };
