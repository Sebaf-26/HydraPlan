import { api } from "./api.js";

const today = () => new Date().toISOString().slice(0, 10);
const isoDay = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export async function loadBitmap(src) {
  if (src instanceof Blob) return createImageBitmap(src, { imageOrientation: "from-image" });
  const res = await fetch(src);
  if (!res.ok) throw new Error("Immagine non disponibile");
  return createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
}

// Re-encode any photo the browser can decode (iPhone HEIC included) as a JPEG of at
// most `maxSide` px: smaller uploads, one format on the server.
export async function prepareImage(file, maxSide = 2400) {
  const bmp = await loadBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  return { blob, width: canvas.width, height: canvas.height, date: file.lastModified ? isoDay(file.lastModified) : today() };
}

export async function uploadBlob(blob) {
  return (await api("uploads", { method: "POST", raw: blob, type: blob.type })).file;
}

// Uploads the chosen files and returns photo records for an element's `photos`.
export async function uploadPhotos(files) {
  const out = [];
  for (const f of files) {
    const img = await prepareImage(f);
    out.push({ file: await uploadBlob(img.blob), date: img.date, caption: "" });
  }
  return out;
}

// ---------- perspective correction ----------

// Solve the 3×3 homography H (h33 = 1) with H·from[i] ≅ to[i] for 4 point pairs.
export function homography(from, to) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination with partial pivoting.
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    if (Math.abs(A[c][c]) < 1e-12) throw new Error("Punti allineati: sposta i 4 punti sugli angoli");
    for (let r = c + 1; r < 8; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = new Array(8);
  for (let r = 7; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < 8; k++) s -= A[r][k] * h[k];
    h[r] = s / A[r][r];
  }
  return [...h, 1];
}

export function applyH(H, [x, y]) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w, w];
}

/**
 * Warps a photo so the quadrilateral `quad` (photo px, clockwise from top-left) becomes a
 * `w`×`h` m rectangle seen from above. Keeps `margin` metres around it (limited to what the
 * photo actually shows). Returns a transparent PNG plus its size and where the reference
 * rectangle sits inside it, in metres.
 */
export async function rectify(bmp, quad, w, h, margin) {
  const rect = [[0, 0], [w, 0], [w, h], [0, h]];
  const toPhoto = homography(rect, quad);
  const toPlan = homography(quad, rect);

  let x0 = -margin, y0 = -margin, x1 = w + margin, y1 = h + margin;
  // Shrink to the part of the plan the photo covers (corners behind the camera are ignored).
  const corners = [[0, 0], [bmp.width, 0], [bmp.width, bmp.height], [0, bmp.height]].map((c) => applyH(toPlan, c));
  if (corners.every((c) => c[2] > 0)) {
    x0 = Math.max(x0, Math.min(...corners.map((c) => c[0])));
    x1 = Math.min(x1, Math.max(...corners.map((c) => c[0])));
    y0 = Math.max(y0, Math.min(...corners.map((c) => c[1])));
    y1 = Math.min(y1, Math.max(...corners.map((c) => c[1])));
  }
  const W = x1 - x0, H = y1 - y0;
  if (!(W > 0 && H > 0)) throw new Error("Area vuota: controlla i punti");

  // Resolution: about the photo's own detail at the reference rectangle, at most 2600 px.
  const edge = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const srcPpm = (edge(quad[0], quad[1]) + edge(quad[3], quad[2])) / 2 / w;
  const ppm = Math.max(20, Math.min(srcPpm, 2600 / Math.max(W, H)));
  const outW = Math.max(1, Math.round(W * ppm)), outH = Math.max(1, Math.round(H * ppm));

  const src = document.createElement("canvas");
  src.width = bmp.width;
  src.height = bmp.height;
  const sctx = src.getContext("2d");
  sctx.drawImage(bmp, 0, 0);
  const sdata = sctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d");
  const img = octx.createImageData(outW, outH);
  const d = img.data;
  const sw = bmp.width, sh = bmp.height;
  const [a, b, c, e, f, g, p, q, r] = toPhoto;

  for (let j = 0; j < outH; j++) {
    const Y = y0 + (j + 0.5) / ppm;
    for (let i = 0; i < outW; i++) {
      const X = x0 + (i + 0.5) / ppm;
      const ww = p * X + q * Y + r;
      if (ww <= 0) continue;
      const sx = (a * X + b * Y + c) / ww - 0.5;
      const sy = (e * X + f * Y + g) / ww - 0.5;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue;
      // bilinear
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy;
      const i00 = (iy * sw + ix) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (j * outW + i) * 4;
      for (let k = 0; k < 3; k++) {
        d[o + k] = (sdata[i00 + k] * (1 - fx) + sdata[i10 + k] * fx) * (1 - fy) + (sdata[i01 + k] * (1 - fx) + sdata[i11 + k] * fx) * fy;
      }
      d[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  const blob = await new Promise((res) => out.toBlob(res, "image/png"));
  // Small PNG preview (keeps transparency, shows on a checkerboard).
  const k = Math.min(1, 900 / Math.max(outW, outH));
  const pv = document.createElement("canvas");
  pv.width = Math.round(outW * k);
  pv.height = Math.round(outH * k);
  pv.getContext("2d").drawImage(out, 0, 0, pv.width, pv.height);
  return { blob, preview: pv.toDataURL("image/png"), width: W, height: H, refX: -x0, refY: -y0 };
}
