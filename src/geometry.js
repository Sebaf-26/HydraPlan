export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Shoelace formula, m².
export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function pathLength(pts, closed = false) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0]);
  return s;
}

export function centroid(pts) {
  const n = pts.length;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

export function pointInPolygon([x, y], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}

export function bounds(elements, background) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  for (const e of elements) {
    if (e.points) e.points.forEach(([x, y]) => add(x, y));
    else if (e.type === "plant") { add(e.x - e.d / 2, e.y - e.d / 2); add(e.x + e.d / 2, e.y + e.d / 2); }
    else add(e.x, e.y);
  }
  if (background) { add(background.x, background.y); add(background.x + background.width, background.y + background.height); }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

export const fmtM = (m) => (m < 10 ? m.toFixed(2) : m.toFixed(1)).replace(".", ",") + " m";
export const fmtM2 = (m2) => (m2 < 100 ? m2.toFixed(1) : Math.round(m2).toString()).replace(".", ",") + " m²";

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
