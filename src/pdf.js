// pdf.js is loaded only when a PDF is actually picked (keeps the main bundle small).
let lib = null;
async function pdfjs() {
  if (!lib) {
    const [mod, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    lib = mod;
  }
  return lib;
}

export async function openPdf(file) {
  const { getDocument } = await pdfjs();
  return getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

// Renders a page so its longer side is `maxSide` px. Returns the canvas and the page size in points.
export async function renderPage(doc, n, maxSide) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(maxSide / Math.max(base.width, base.height), 8);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, widthPt: base.width, heightPt: base.height };
}
