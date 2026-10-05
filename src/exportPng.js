import { bounds } from "./geometry.js";

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

// Renders the whole plan (not just the visible part) to an image and downloads it.
export async function exportPng(svg, plan) {
  const b = bounds(plan.elements, plan.background);
  if (!b) throw new Error("il progetto è vuoto");
  const margin = Math.max(1, (b.maxX - b.minX) * 0.04);
  const x = b.minX - margin, y = b.minY - margin;
  const w = b.maxX - b.minX + 2 * margin, h = b.maxY - b.minY + 2 * margin;
  // ~50 px per metre, capped so the canvas stays within browser limits.
  const ppm = Math.min(50, 4000 / Math.max(w, h));
  const W = Math.round(w * ppm), H = Math.round(h * ppm);

  const clone = svg.cloneNode(true);
  clone.querySelectorAll(".no-export, .grid").forEach((n) => n.remove());
  clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  clone.setAttribute("width", W);
  clone.setAttribute("height", H);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");
  // Text sizes on screen depend on the zoom; rescale them to the export resolution.
  const zoom = Number(svg.getAttribute("width")) / Number(svg.getAttribute("viewBox").split(" ")[2]);
  clone.querySelectorAll("text:not(.free-label)").forEach((t) => {
    const fs = Number(t.getAttribute("font-size"));
    if (fs) t.setAttribute("font-size", (fs * zoom) / ppm);
  });
  const css = getComputedStyle(document.documentElement);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `text{font-family:-apple-system,Helvetica,Arial,sans-serif}
.area-label{fill:#1f2a1f;font-weight:600}.area-label .sub{font-weight:400;fill:#3b4a3b}
.plant-label{fill:#142014;font-weight:600}.dim-label{fill:${css.getPropertyValue("--dim")};font-weight:600}
.free-label{font-weight:600}`;
  clone.prepend(style);

  const image = clone.querySelector("image");
  if (image) {
    const res = await fetch(image.getAttribute("href"));
    image.setAttribute("href", await blobToDataUrl(await res.blob()));
  }

  const data = new XMLSerializer().serializeToString(clone).replaceAll("var(--dim)", css.getPropertyValue("--dim").trim() || "#c0392b").replaceAll("var(--label)", "#1f2328");
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data);
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  // Scale bar: 1/5 of the width, rounded to a nice number of metres.
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  const meters = nice.reduce((best, n) => (n * ppm <= W / 5 ? n : best), 1);
  const px = meters * ppm;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(12, H - 46, px + 24, 34);
  ctx.fillStyle = "#1f2328";
  ctx.fillRect(24, H - 22, px, 4);
  ctx.font = "600 13px -apple-system, Helvetica, Arial, sans-serif";
  ctx.fillText(`${meters} m`, 24, H - 28);

  // With a photo underneath PNG gets huge for no gain: use JPEG then.
  const type = plan.background ? "image/jpeg" : "image/png";
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.9));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${plan.name.replace(/[^\w\- àèéìòù]+/gi, "").trim() || "progetto"}.${type === "image/png" ? "png" : "jpg"}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
