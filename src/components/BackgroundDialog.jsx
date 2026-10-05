import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api.js";

const TILE = 256;
const MAX_TILES = 144;

// Web-Mercator helpers (pixel coordinates at zoom z).
const lngToPx = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
const latToPx = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z;
};
const metersPerPx = (lat, z) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

async function loadTile(z, x, y) {
  const res = await fetch(`api/tiles/${z}/${x}/${y}`);
  if (!res.ok) throw new Error("tile " + res.status);
  return createImageBitmap(await res.blob());
}

// Stitches the satellite tiles covering the visible map into one image with a known scale.
async function captureArea(map, onProgress) {
  const b = map.getBounds();
  const lat = map.getCenter().lat;
  let z = 19;
  let x0, x1, y0, y1;
  for (; z > 12; z--) {
    x0 = lngToPx(b.getWest(), z); x1 = lngToPx(b.getEast(), z);
    y0 = latToPx(b.getNorth(), z); y1 = latToPx(b.getSouth(), z);
    const tiles = (Math.floor(x1 / TILE) - Math.floor(x0 / TILE) + 1) * (Math.floor(y1 / TILE) - Math.floor(y0 / TILE) + 1);
    if (tiles <= MAX_TILES) break;
  }
  const W = Math.round(x1 - x0), H = Math.round(y1 - y0);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const jobs = [];
  for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++)
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++) jobs.push([tx, ty]);
  let done = 0;
  // A few at a time: the server proxies each one to Esri.
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(
      jobs.slice(i, i + 8).map(async ([tx, ty]) => {
        const bmp = await loadTile(z, tx, ty);
        ctx.drawImage(bmp, Math.round(tx * TILE - x0), Math.round(ty * TILE - y0));
        onProgress(++done / jobs.length);
      })
    );
  }
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  const mpp = metersPerPx(lat, z);
  return { blob, width: W * mpp, height: H * mpp, source: `Satellite Esri · ${lat.toFixed(5)}, ${map.getCenter().lng.toFixed(5)}` };
}

function SatellitePicker({ onCapture, busy }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);

  useEffect(() => {
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([45.07, 7.68], 16);
    L.tileLayer("api/tiles/{z}/{x}/{y}", { maxZoom: 21, maxNativeZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" }).addTo(map);
    mapRef.current = map;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 19), () => {}, { timeout: 5000 });
    }
    return () => map.remove();
  }, []);

  async function search(ev) {
    ev.preventDefault();
    if (q.trim().length < 2) return;
    try {
      const r = await api("geocode?q=" + encodeURIComponent(q.trim()));
      setHits(r);
      if (r[0]) mapRef.current.setView([r[0].lat, r[0].lng], 19);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <form className="row" onSubmit={search}>
        <input className="grow" placeholder="Indirizzo, es. Via Roma 1, Torino" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="ghost">Cerca</button>
      </form>
      {hits.length > 1 && (
        <select onChange={(e) => { const h = hits[e.target.value]; mapRef.current.setView([h.lat, h.lng], 19); }}>
          {hits.map((h, i) => <option key={i} value={i}>{h.label}</option>)}
        </select>
      )}
      <div className="sat-map" ref={ref} />
      <p className="muted small">Inquadra il giardino (zoomma il più possibile): verrà salvato esattamente ciò che vedi nel riquadro, già in scala.</p>
      <button className="primary" disabled={busy} onClick={() => onCapture(mapRef.current)}>
        {busy ? "Scarico le immagini…" : "Usa quest'area come sfondo"}
      </button>
    </>
  );
}

export default function BackgroundDialog({ plan, view, size, onClose, onSet, onError }) {
  const [mode, setMode] = useState("photo");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [photo, setPhoto] = useState(null); // { file, ratio, url }
  const [width, setWidth] = useState("20");

  // New backgrounds go where the user is looking.
  const origin = () => (view ? [view.x + size.w / view.scale / 2, view.y + size.h / view.scale / 2] : [0, 0]);

  async function upload(blob) {
    return (await api("uploads", { method: "POST", raw: blob, type: blob.type })).file;
  }

  async function pickPhoto(ev) {
    const f = ev.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return alert("Usa un'immagine PNG, JPEG o WebP (le foto HEIC dell'iPhone vanno prima esportate in JPEG).");
    setBusy(true);
    try {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.src = url;
      await img.decode();
      const file = await upload(f);
      setPhoto({ file, ratio: img.naturalHeight / img.naturalWidth, url, name: f.name });
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  function confirmPhoto() {
    const w = Number(String(width).replace(",", "."));
    if (!(w > 0)) return alert("Inserisci la larghezza in metri");
    const h = w * photo.ratio;
    const [cx, cy] = origin();
    onSet({ file: photo.file, x: cx - w / 2, y: cy - h / 2, width: w, height: h, opacity: 0.8, locked: false, source: photo.name });
  }

  async function capture(map) {
    setBusy(true);
    setProgress(0);
    try {
      const shot = await captureArea(map, setProgress);
      const file = await upload(shot.blob);
      const [cx, cy] = origin();
      onSet({ file, x: cx - shot.width / 2, y: cy - shot.height / 2, width: shot.width, height: shot.height, opacity: 0.85, locked: true, source: shot.source });
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal card">
        <div className="row">
          <h3 className="grow">Sfondo di “{plan.name}”</h3>
          <button className="ghost" onClick={onClose} disabled={busy}>×</button>
        </div>
        <div className="segmented">
          <button className={mode === "photo" ? "active" : ""} onClick={() => setMode("photo")}>Foto / planimetria</button>
          <button className={mode === "sat" ? "active" : ""} onClick={() => setMode("sat")}>Vista satellitare</button>
        </div>

        {mode === "photo" ? (
          photo ? (
            <>
              <img className="preview" src={photo.url} alt="" />
              <label>
                Quanto è larga in realtà l'area dell'immagine? (metri)
                <input type="number" inputMode="decimal" step="0.5" value={width} onChange={(e) => setWidth(e.target.value)} autoFocus />
              </label>
              <p className="muted small">Va bene anche a occhio: dopo puoi usare <b>Calibra con una misura</b> tracciando una distanza che conosci.</p>
              <button className="primary" onClick={confirmPhoto}>Usa come sfondo</button>
            </>
          ) : (
            <label className="dropzone">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} hidden />
              {busy ? "Caricamento…" : "Scegli una foto dall'alto, uno screenshot o una planimetria"}
            </label>
          )
        ) : (
          <>
            <SatellitePicker onCapture={capture} busy={busy} />
            {busy && <progress value={progress} max="1" />}
          </>
        )}
      </div>
    </div>
  );
}
