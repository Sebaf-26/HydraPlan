import React, { useEffect, useRef, useState } from "react";
import { loadBitmap, rectify, uploadBlob } from "../photos.js";
import { POZZETTO_PRESETS, STONE_PRESETS } from "../catalog.js";

const REFS = [
  ...STONE_PRESETS.filter((p) => p.shape === "rect").map((p) => ({ label: "Piastra " + p.label, w: p.w, h: p.h })),
  ...POZZETTO_PRESETS.map((p) => ({ label: "Chiusino " + p.label, w: p.w, h: p.h })),
  { label: "Foglio A4", w: 0.297, h: 0.21 }
];

/**
 * Turns a photo taken at an angle into a to-scale, top-down image: the user drags 4 points onto
 * the corners of something rectangular of known size (a paving slab, a manhole cover, an A4 sheet…).
 */
export default function PhotoRectify({ source, onClose, onDone, onError }) {
  const [bmp, setBmp] = useState(null);
  const [url, setUrl] = useState(null);
  const [pts, setPts] = useState(null);
  const [w, setW] = useState("0.4");
  const [h, setH] = useState("0.4");
  const [margin, setMargin] = useState("3");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const loupeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    (async () => {
      try {
        const b = await loadBitmap(source);
        if (!alive) return;
        // Work on a ≤3000 px copy: enough detail, bounded memory.
        const k = Math.min(1, 3000 / Math.max(b.width, b.height));
        const c = document.createElement("canvas");
        c.width = Math.round(b.width * k);
        c.height = Math.round(b.height * k);
        c.getContext("2d").drawImage(b, 0, 0, c.width, c.height);
        const small = await createImageBitmap(c);
        objectUrl = c.toDataURL("image/jpeg", 0.85);
        setBmp(small);
        setUrl(objectUrl);
        const W = small.width, H = small.height;
        setPts([[W * 0.35, H * 0.4], [W * 0.65, H * 0.4], [W * 0.7, H * 0.65], [W * 0.3, H * 0.65]]);
      } catch (err) {
        onError(err);
        onClose();
      }
    })();
    return () => {
      alive = false;
    };
  }, [source]);

  const toImg = (ev) => {
    const r = svgRef.current.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * bmp.width, ((ev.clientY - r.top) / r.height) * bmp.height];
  };

  function drawLoupe(p) {
    const c = loupeRef.current;
    if (!c || !bmp) return;
    const ctx = c.getContext("2d");
    const size = 140, zoom = 4, src = size / zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(bmp, p[0] - src / 2, p[1] - src / 2, src, src, 0, 0, size, size);
    ctx.strokeStyle = "#ff1744";
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
  }

  function onMove(ev) {
    if (drag === null) return;
    const p = toImg(ev);
    p[0] = Math.max(0, Math.min(bmp.width, p[0]));
    p[1] = Math.max(0, Math.min(bmp.height, p[1]));
    setPts((old) => old.map((q, i) => (i === drag ? p : q)));
    setResult(null);
    drawLoupe(p);
  }

  const parse = (v) => Number(String(v).replace(",", "."));

  async function preview() {
    const W = parse(w), H = parse(h), M = parse(margin);
    if (!(W > 0 && H > 0 && M >= 0)) return alert("Inserisci le misure in metri");
    setBusy(true);
    try {
      setResult(await rectify(bmp, pts, W, H, M));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const r = result || (await rectify(bmp, pts, parse(w), parse(h), parse(margin)));
      const file = await uploadBlob(r.blob);
      onDone({ file, width: r.width, height: r.height, refX: r.refX, refY: r.refY, refW: parse(w), refH: parse(h) });
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const r = bmp ? Math.max(bmp.width, bmp.height) / 90 : 10;

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal card wide">
        <div className="row">
          <h3 className="grow">Raddrizza foto</h3>
          <button className="ghost" onClick={onClose} disabled={busy}>×</button>
        </div>
        <p className="muted small">
          Trascina i punti <b>1 2 3 4</b> sugli angoli di qualcosa di rettangolare di cui conosci la misura (una piastra, il chiusino di un pozzetto, un foglio A4…),
          in senso orario partendo da in alto a sinistra. Più è grande e vicino al centro della foto, più il risultato è preciso.
        </p>
        {!bmp ? (
          <p className="muted">Caricamento foto…</p>
        ) : result ? (
          <img className="preview checker" src={result.preview} alt="Anteprima raddrizzata" />
        ) : (
          <div className="rectify-stage">
            <img src={url} alt="" draggable="false" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${bmp.width} ${bmp.height}`}
              onPointerMove={onMove}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
            >
              <polygon points={pts.map((p) => p.join(",")).join(" ")} className="rectify-quad" strokeWidth={r / 4} />
              {pts.map((p, i) => (
                <g key={i} onPointerDown={(ev) => {
                  try {
                    ev.currentTarget.ownerSVGElement.setPointerCapture(ev.pointerId);
                  } catch {}
                  setDrag(i);
                  drawLoupe(p);
                }}>
                  <circle cx={p[0]} cy={p[1]} r={r * 1.6} className="rectify-hit" />
                  <circle cx={p[0]} cy={p[1]} r={r / 2.5} className="rectify-dot" />
                  <text x={p[0] + r * 0.9} y={p[1] - r * 0.9} fontSize={r * 1.6} className="rectify-num">{i + 1}</text>
                </g>
              ))}
            </svg>
            <canvas ref={loupeRef} width="140" height="140" className={"loupe" + (drag !== null ? " on" : "")} />
          </div>
        )}

        <div className="chips">
          {REFS.map((ref) => (
            <button key={ref.label} className={"chip" + (parse(w) === ref.w && parse(h) === ref.h ? " active" : "")} onClick={() => { setW(String(ref.w)); setH(String(ref.h)); setResult(null); }}>
              {ref.label}
            </button>
          ))}
        </div>
        <div className="three">
          <label>Lato 1→2 (m)<input type="number" inputMode="decimal" step="0.01" value={w} onChange={(e) => { setW(e.target.value); setResult(null); }} /></label>
          <label>Lato 2→3 (m)<input type="number" inputMode="decimal" step="0.01" value={h} onChange={(e) => { setH(e.target.value); setResult(null); }} /></label>
          <label>Area attorno (m)<input type="number" inputMode="decimal" step="0.5" min="0" value={margin} onChange={(e) => { setMargin(e.target.value); setResult(null); }} /></label>
        </div>
        <div className="row wrap">
          {result ? (
            <button className="ghost" onClick={() => setResult(null)} disabled={busy}>‹ Correggi i punti</button>
          ) : (
            <button className="ghost" onClick={preview} disabled={busy || !bmp}>Anteprima</button>
          )}
          <span className="spacer" />
          <button className="primary" onClick={confirm} disabled={busy || !bmp}>{busy ? "Elaboro…" : "Metti nel progetto"}</button>
        </div>
      </div>
    </div>
  );
}
