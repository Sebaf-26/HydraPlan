import React, { useEffect, useRef, useState } from "react";
import { openPdf, renderPage } from "../pdf.js";

/**
 * Pick a page of a PDF and (optionally) crop the part to use, e.g. only the ground-floor plan
 * of a sheet with several drawings. Calls onDone({ blob, widthPt, heightPt, name }) where the
 * size is the crop's size on paper (to apply a 1:N scale).
 */
export default function PdfPagePicker({ file, onDone, onCancel, onError }) {
  const [doc, setDoc] = useState(null);
  const [thumbs, setThumbs] = useState([]);
  const [page, setPage] = useState(null); // { n, url, w, h, widthPt, heightPt }
  const [crop, setCrop] = useState(null); // fractions { x0, y0, x1, y1 }
  const [busy, setBusy] = useState(true);
  const dragRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await openPdf(file);
        if (!alive) return;
        setDoc(d);
        const list = [];
        for (let n = 1; n <= Math.min(d.numPages, 40); n++) {
          const { canvas } = await renderPage(d, n, 260);
          list.push({ n, url: canvas.toDataURL("image/jpeg", 0.7) });
          if (!alive) return;
          setThumbs([...list]);
        }
        if (d.numPages === 1) await choose(d, 1);
      } catch (err) {
        onError(new Error("PDF non leggibile: " + err.message));
        onCancel();
      } finally {
        alive && setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  async function choose(d, n) {
    setBusy(true);
    try {
      const r = await renderPage(d, n, 1400);
      setPage({ n, url: r.canvas.toDataURL("image/jpeg", 0.85), widthPt: r.widthPt, heightPt: r.heightPt });
      setCrop(null);
    } finally {
      setBusy(false);
    }
  }

  const frac = (ev) => {
    const r = imgRef.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))];
  };

  function down(ev) {
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    const p = frac(ev);
    dragRef.current = p;
    setCrop({ x0: p[0], y0: p[1], x1: p[0], y1: p[1] });
  }
  function move(ev) {
    if (!dragRef.current) return;
    const [a, b] = dragRef.current;
    const [x, y] = frac(ev);
    setCrop({ x0: Math.min(a, x), y0: Math.min(b, y), x1: Math.max(a, x), y1: Math.max(b, y) });
  }
  function up() {
    dragRef.current = null;
    setCrop((c) => (c && (c.x1 - c.x0 < 0.02 || c.y1 - c.y0 < 0.02) ? null : c));
  }

  async function confirm() {
    setBusy(true);
    try {
      const c = crop || { x0: 0, y0: 0, x1: 1, y1: 1 };
      // Full-resolution render of the page, then cut the crop out of it (≤ 5000 px on the long side).
      const side = Math.min(5000, 5000 / Math.max(c.x1 - c.x0, c.y1 - c.y0));
      const { canvas } = await renderPage(doc, page.n, Math.min(side, 9000));
      const sx = Math.round(c.x0 * canvas.width), sy = Math.round(c.y0 * canvas.height);
      const sw = Math.round((c.x1 - c.x0) * canvas.width), sh = Math.round((c.y1 - c.y0) * canvas.height);
      const out = document.createElement("canvas");
      out.width = sw;
      out.height = sh;
      out.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      let blob = await new Promise((r) => out.toBlob(r, "image/png"));
      if (blob.size > 15e6) blob = await new Promise((r) => out.toBlob(r, "image/jpeg", 0.9));
      onDone({
        blob,
        widthPt: page.widthPt * (c.x1 - c.x0),
        heightPt: page.heightPt * (c.y1 - c.y0),
        name: file.name.replace(/\.pdf$/i, "") + (doc.numPages > 1 ? ` · pag. ${page.n}` : "")
      });
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!page)
    return (
      <>
        <p className="muted small">{busy && !thumbs.length ? "Apro il PDF…" : "Scegli la pagina con la planimetria:"}</p>
        <div className="pdf-pages">
          {thumbs.map((t) => (
            <button key={t.n} className="pdf-page" onClick={() => choose(doc, t.n)} disabled={busy}>
              <img src={t.url} alt="" />
              <span>Pagina {t.n}</span>
            </button>
          ))}
        </div>
        <button className="ghost" onClick={onCancel}>Annulla</button>
      </>
    );

  return (
    <>
      <p className="muted small">Trascina un riquadro per usare solo una parte della pagina (es. solo la pianta del piano terra), oppure usa la pagina intera.</p>
      <div className="pdf-crop" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img ref={imgRef} src={page.url} alt="" draggable="false" />
        {crop && (
          <div
            className="pdf-crop-box"
            style={{ left: crop.x0 * 100 + "%", top: crop.y0 * 100 + "%", width: (crop.x1 - crop.x0) * 100 + "%", height: (crop.y1 - crop.y0) * 100 + "%" }}
          />
        )}
      </div>
      <div className="row wrap">
        {doc?.numPages > 1 && <button className="ghost" onClick={() => setPage(null)} disabled={busy}>‹ Altra pagina</button>}
        {crop && <button className="ghost" onClick={() => setCrop(null)}>Pagina intera</button>}
        <span className="spacer" />
        <button className="primary" onClick={confirm} disabled={busy}>{busy ? "Preparo…" : crop ? "Usa il riquadro" : "Usa la pagina intera"}</button>
      </div>
    </>
  );
}
