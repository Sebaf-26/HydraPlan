import React, { useMemo, useState } from "react";
import {
  AREA_KINDS, LINE_KINDS, PIPE_CONTENTS, PIPE_DIAMETERS, PLANT_CATS, PLAN_KINDS, POZZETTO_COVERS, POZZETTO_PRESETS,
  STONE_MATERIALS, STONE_PRESETS, UTILITY_KINDS
} from "../catalog.js";
import { LAYERS, layerOf } from "../layers.js";
import { uploadPhotos } from "../photos.js";
import { uploadUrl } from "../api.js";
import { dist, fmtM, fmtM2, pathLength, polygonArea } from "../geometry.js";
import { lineColor, plantColor } from "./PlanCanvas.jsx";
import { go } from "../router.js";

const num = (v) => Number(String(v).replace(",", "."));

function NumberField({ label, value, onChange, step = 0.1, min = 0, suffix = "m" }) {
  const [text, setText] = useState(null);
  return (
    <label>
      {label}
      <span className="with-suffix">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={text ?? Math.round(value * 1000) / 1000}
          onChange={(e) => {
            setText(e.target.value);
            const n = num(e.target.value);
            if (Number.isFinite(n) && n >= min) onChange(n);
          }}
          onBlur={() => setText(null)}
        />
        <span>{suffix}</span>
      </span>
    </label>
  );
}

function PlantPicker({ plants, value, onPick }) {
  const [q, setQ] = useState("");
  const list = [...plants.values()].filter((p) => (p.name + " " + p.latin).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="plant-picker">
      <input className="search" placeholder="Cerca pianta…" value={q} onChange={(e) => setQ(e.target.value)} />
      {Object.entries(PLANT_CATS).map(([cat, c]) => {
        const items = list.filter((p) => p.cat === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="cat-title small">{c.label}</div>
            <div className="chips">
              {items.map((p) => (
                <button key={p.id} className={"chip" + (value === p.id ? " active" : "")} onClick={() => onPick(p)} title={`${p.latin} · Ø ${p.d} m`}>
                  <span className="dot" style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <button className="link small" onClick={() => go("libreria")}>Gestisci libreria…</button>
    </div>
  );
}

function KindChips({ kinds, value, onPick }) {
  return (
    <div className="chips">
      {Object.entries(kinds).map(([k, v]) => (
        <button key={k} className={"chip" + (value === k ? " active" : "")} onClick={() => onPick(k)}>
          <span className="dot" style={{ background: v.fill || v.color }} />
          {v.label}
        </button>
      ))}
    </div>
  );
}

function PipeFields({ value, onChange }) {
  return (
    <>
      <div className="cat-title small">Contenuto</div>
      <KindChips kinds={Object.fromEntries(Object.entries(PIPE_CONTENTS).map(([k, v]) => [k, { label: v.label, color: v.color }]))} value={value.content} onPick={(content) => onChange({ content })} />
      <div className="two">
        <label>
          Diametro
          <select value={value.diameter} onChange={(ev) => onChange({ diameter: Number(ev.target.value) })}>
            <option value={0}>non indicato</option>
            {PIPE_DIAMETERS.map((d) => <option key={d} value={d}>Ø {d} mm</option>)}
          </select>
        </label>
        <NumberField label="Profondità" value={value.depth || 0} onChange={(depth) => onChange({ depth })} step={5} suffix="cm" />
      </div>
    </>
  );
}

function RotationField({ value, onChange }) {
  return (
    <label>
      Rotazione · {Math.round(value || 0)}°
      <input type="range" min="-180" max="180" step="1" value={value || 0} onChange={(ev) => onChange(Number(ev.target.value))} />
    </label>
  );
}

// Photos of works attached to an element (or a photo pin): thumbnails, add, full view.
function PhotosSection({ e, updateElement, onRectify, onError }) {
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = e.photos || [];
  const setPhotos = (photos) => updateElement(e.id, { photos });

  async function add(ev) {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      setPhotos([...list, ...(await uploadPhotos(files))]);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const ph = open !== null ? list[open] : null;
  return (
    <div className="photos">
      <div className="cat-title small">Foto {list.length ? `(${list.length})` : ""}</div>
      <div className="thumbs">
        {list.map((p, i) => (
          <button key={p.file} className="thumb-btn" onClick={() => setOpen(i)} title={p.caption || p.date}>
            <img src={uploadUrl(p.file)} alt="" loading="lazy" />
          </button>
        ))}
        <label className="thumb-btn add">
          <input type="file" accept="image/*" multiple hidden onChange={add} />
          {busy ? "…" : "+"}
        </label>
      </div>
      {ph && (
        <div className="modal-backdrop" onPointerDown={(ev) => ev.target === ev.currentTarget && setOpen(null)}>
          <div className="modal card wide lightbox">
            <div className="row">
              <button className="ghost" disabled={open === 0} onClick={() => setOpen(open - 1)}>‹</button>
              <span className="grow muted small center">{open + 1} / {list.length}</span>
              <button className="ghost" disabled={open === list.length - 1} onClick={() => setOpen(open + 1)}>›</button>
              <button className="ghost" onClick={() => setOpen(null)}>×</button>
            </div>
            <img src={uploadUrl(ph.file)} alt={ph.caption} />
            <div className="two">
              <label>Didascalia<input value={ph.caption} placeholder="es. scavo prima del rinterro" onChange={(ev) => setPhotos(list.map((q, i) => (i === open ? { ...q, caption: ev.target.value } : q)))} /></label>
              <label>Data<input type="date" value={ph.date} onChange={(ev) => setPhotos(list.map((q, i) => (i === open ? { ...q, date: ev.target.value } : q)))} /></label>
            </div>
            <div className="row wrap">
              <button className="ghost small" onClick={() => { setOpen(null); onRectify(uploadUrl(ph.file)); }}>Raddrizza e sovrapponi al disegno</button>
              <a className="ghost small btn-link" href={uploadUrl(ph.file)} target="_blank" rel="noreferrer">Apri originale</a>
              <span className="spacer" />
              <button className="ghost small danger" onClick={() => { if (confirm("Togliere questa foto?")) { setPhotos(list.filter((_, i) => i !== open)); setOpen(null); } }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverlayPanel({ o, updateElement, removeElement, reorder, startCalibrate }) {
  const set = (patch) => updateElement(o.id, patch);
  return (
    <div className="panel-section">
      <h3>Immagine sovrapposta</h3>
      <label>Nome<input value={o.name} onChange={(ev) => set({ name: ev.target.value })} /></label>
      <p className="muted small">{fmtM(o.width)} × {fmtM(o.height)}{o.source ? " · " + o.source : ""}</p>
      <label>
        Opacità
        <input type="range" min="0.05" max="1" step="0.05" value={o.opacity} onChange={(ev) => set({ opacity: Number(ev.target.value) })} />
      </label>
      <RotationField value={o.rotation} onChange={(rotation) => set({ rotation })} />
      <NumberField label="Larghezza reale" value={o.width} onChange={(w) => w > 0 && set({ x: o.x + (o.width - w) / 2, y: o.y + (o.height - (o.height * w) / o.width) / 2, width: w, height: (o.height * w) / o.width })} step={0.5} />
      <label className="check"><input type="checkbox" checked={!o.locked} onChange={(ev) => set({ locked: !ev.target.checked })} /> Spostabile (trascina, ruota col pallino, scala dall'angolo)</label>
      <label className="check"><input type="checkbox" checked={o.hidden} onChange={(ev) => set({ hidden: ev.target.checked })} /> Nascosta</label>
      <label>Data<input type="date" value={o.date || ""} onChange={(ev) => set({ date: ev.target.value })} /></label>
      <div className="row wrap">
        <button className="ghost small" onClick={startCalibrate}>Calibra con una misura</button>
        <button className="ghost small" onClick={() => reorder(o.id, true)}>Porta sopra</button>
        <button className="ghost small" onClick={() => reorder(o.id, false)}>Porta sotto</button>
        <button className="ghost small danger" onClick={() => confirm("Togliere questa immagine?") && removeElement(o.id)}>Elimina</button>
      </div>
    </div>
  );
}

function ElementPanel({ e, plants, updateElement, removeElement, duplicate, reorder, onRectify, onError }) {
  const set = (patch) => updateElement(e.id, patch);
  const species = e.type === "plant" ? plants.get(e.plantId) : null;
  const title = {
    area: "Area", line: LINE_KINDS[e.kind]?.pipe ? "Tubo / corrugato" : "Linea", plant: "Pianta", label: "Testo", dim: "Quota",
    stone: "Piastra", pozzetto: "Pozzetto", photo: "Foto sul posto"
  }[e.type];
  const defaultColor =
    e.type === "area" ? (AREA_KINDS[e.kind] || AREA_KINDS.altro).fill :
    e.type === "line" ? lineColor({ ...e, color: "" }) :
    e.type === "plant" ? plantColor({}, species) :
    e.type === "stone" ? STONE_MATERIALS[e.material]?.color || "#b9b3a6" :
    e.type === "pozzetto" ? "#8d8d8d" : "#333333";

  return (
    <div className="panel-section">
      <h3>{title}</h3>

      {e.type === "area" && (
        <>
          <div className="measures">
            <div><span className="muted small">Superficie</span><strong>{fmtM2(polygonArea(e.points))}</strong></div>
            <div><span className="muted small">Perimetro</span><strong>{fmtM(pathLength(e.points, true))}</strong></div>
          </div>
          <KindChips kinds={AREA_KINDS} value={e.kind} onPick={(kind) => set({ kind })} />
        </>
      )}

      {e.type === "line" && (
        <>
          <div className="measures">
            <div><span className="muted small">Lunghezza</span><strong>{fmtM(pathLength(e.points))}</strong></div>
            {e.width > 0 && !UTILITY_KINDS.has(e.kind) && <div><span className="muted small">Superficie</span><strong>{fmtM2(pathLength(e.points) * e.width)}</strong></div>}
          </div>
          <KindChips kinds={LINE_KINDS} value={e.kind} onPick={(kind) => set({ kind, width: LINE_KINDS[kind].width || 0, ...(kind === "corrugato" && !e.content ? { content: "elettrico" } : {}) })} />
          {LINE_KINDS[e.kind]?.pipe ? (
            <PipeFields value={e} onChange={set} />
          ) : UTILITY_KINDS.has(e.kind) ? (
            <NumberField label="Profondità" value={e.depth || 0} onChange={(depth) => set({ depth })} step={5} suffix="cm" />
          ) : (
            <NumberField label="Larghezza (0 = linea sottile)" value={e.width} onChange={(width) => set({ width })} step={0.05} />
          )}
        </>
      )}

      {e.type === "stone" && (
        <>
          <div className="chips">
            {STONE_PRESETS.map((p) => (
              <button key={p.label} className={"chip" + (p.w === e.w && p.h === e.h && p.shape === e.shape ? " active" : "")} onClick={() => set({ w: p.w, h: p.h, shape: p.shape })}>{p.label}</button>
            ))}
          </div>
          <div className="two">
            <NumberField label="Larghezza" value={e.w} onChange={(w) => w > 0.04 && set({ w })} step={0.05} />
            <NumberField label="Lunghezza" value={e.h} onChange={(h) => h > 0.04 && set({ h })} step={0.05} />
          </div>
          <RotationField value={e.rotation} onChange={(rotation) => set({ rotation })} />
          <KindChips kinds={STONE_MATERIALS} value={e.material} onPick={(material) => set({ material })} />
        </>
      )}

      {e.type === "pozzetto" && (
        <>
          <div className="chips">
            {POZZETTO_PRESETS.map((p) => (
              <button key={p.label} className={"chip" + (p.w === e.w && p.h === e.h ? " active" : "")} onClick={() => set({ w: p.w, h: p.h })}>{p.label}</button>
            ))}
          </div>
          <div className="two">
            <NumberField label="Larghezza" value={e.w} onChange={(w) => w > 0.04 && set({ w })} step={0.05} />
            <NumberField label="Lunghezza" value={e.h} onChange={(h) => h > 0.04 && set({ h })} step={0.05} />
          </div>
          <div className="two">
            <NumberField label="Profondità" value={e.depth || 0} onChange={(depth) => set({ depth })} step={5} suffix="cm" />
            <label>
              Chiusino
              <select value={e.cover} onChange={(ev) => set({ cover: ev.target.value })}>
                <option value="">—</option>
                {POZZETTO_COVERS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <RotationField value={e.rotation} onChange={(rotation) => set({ rotation })} />
        </>
      )}

      {e.type === "plant" && (
        <>
          <label>
            Specie
            <select value={e.plantId} onChange={(ev) => set({ plantId: ev.target.value, d: plants.get(ev.target.value)?.d || e.d })}>
              {!species && <option value={e.plantId}>(non in libreria)</option>}
              {Object.entries(PLANT_CATS).map(([cat, c]) => (
                <optgroup key={cat} label={c.label}>
                  {[...plants.values()].filter((p) => p.cat === cat).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {species && <p className="muted small"><i>{species.latin}</i> · da adulta Ø {String(species.d).replace(".", ",")} m, h {String(species.h).replace(".", ",")} m</p>}
          <div className="two">
            <NumberField label="Diametro chioma" value={e.d} onChange={(d) => set({ d: Math.max(0.05, d) })} />
            <label>
              Messa a dimora
              <input type="date" value={e.planted} onChange={(ev) => set({ planted: ev.target.value })} />
            </label>
          </div>
        </>
      )}

      {e.type === "label" && (
        <>
          <label>Testo<input value={e.text} onChange={(ev) => ev.target.value && set({ text: ev.target.value })} /></label>
          <NumberField label="Altezza testo" value={e.size} onChange={(size) => set({ size: Math.max(0.1, size) })} />
        </>
      )}

      {e.type === "dim" && (
        <div className="measures"><div><span className="muted small">Distanza</span><strong>{fmtM(dist(e.points[0], e.points[1]))}</strong></div></div>
      )}

      {e.type !== "dim" && e.type !== "label" && (
        <label>Nome<input value={e.name} placeholder={e.type === "plant" ? species?.name : "es. Aiuola nord"} onChange={(ev) => set({ name: ev.target.value })} /></label>
      )}
      {e.type !== "dim" && e.type !== "photo" && (
        <label className="color-row">
          Colore
          <input type="color" value={e.color || defaultColor} onChange={(ev) => set({ color: ev.target.value })} />
          {e.color && <button className="link small" onClick={() => set({ color: "" })}>predefinito</button>}
        </label>
      )}
      <label>Note<textarea rows="3" value={e.note} onChange={(ev) => set({ note: ev.target.value })} placeholder={e.type === "pozzetto" ? "Cosa c'è dentro, da dove arrivano i tubi…" : "Annotazioni, lavori da fare…"} /></label>
      {e.type !== "dim" && e.type !== "label" && <PhotosSection e={e} updateElement={updateElement} onRectify={onRectify} onError={onError} />}
      <label className="check"><input type="checkbox" checked={e.locked} onChange={(ev) => set({ locked: ev.target.checked })} /> Bloccato (non si sposta per sbaglio)</label>

      <div className="row wrap">
        <button className="ghost small" onClick={() => duplicate(e.id)}>Duplica</button>
        <button className="ghost small" onClick={() => reorder(e.id, true)}>Porta sopra</button>
        <button className="ghost small" onClick={() => reorder(e.id, false)}>Porta sotto</button>
        <button className="ghost small danger" onClick={() => removeElement(e.id)}>Elimina</button>
      </div>
    </div>
  );
}

function PlanPanel({ plan, plants, change, openBackground, onSelect, hidden, setHidden }) {
  const set = (patch) => change((p) => ({ ...p, ...patch }));
  const setOv = (id, patch) => change((p) => ({ ...p, overlays: p.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  const stats = useMemo(() => {
    const areas = {};
    const species = {};
    const pipes = {};
    let pozzetti = 0, stones = 0, stonesM2 = 0, photos = 0;
    for (const e of plan.elements) {
      photos += e.photos?.length || 0;
      if (e.type === "area") areas[e.kind] = (areas[e.kind] || 0) + polygonArea(e.points);
      if (e.type === "plant") {
        const s = (species[e.plantId] ||= { count: 0, ids: [] });
        s.count++;
        s.ids.push(e.id);
      }
      if (e.type === "line" && UTILITY_KINDS.has(e.kind)) {
        const key = LINE_KINDS[e.kind].pipe ? e.content || "vuoto" : e.kind;
        pipes[key] = (pipes[key] || 0) + pathLength(e.points);
      }
      if (e.type === "pozzetto") pozzetti++;
      if (e.type === "stone") {
        stones++;
        stonesM2 += e.shape === "round" ? (Math.PI * e.w * e.h) / 4 : e.w * e.h;
      }
    }
    return { areas, species, pipes, pozzetti, stones, stonesM2, photos };
  }, [plan.elements]);

  const toggle = (k) => {
    const next = new Set(hidden);
    next.has(k) ? next.delete(k) : next.add(k);
    setHidden(next);
  };
  const counts = useMemo(() => {
    const c = { immagini: plan.overlays.length };
    for (const e of plan.elements) c[layerOf(e)] = (c[layerOf(e)] || 0) + 1;
    return c;
  }, [plan.elements, plan.overlays]);

  return (
    <>
      <div className="panel-section">
        <h3>Progetto</h3>
        <label>Nome<input value={plan.name} onChange={(e) => e.target.value && set({ name: e.target.value })} /></label>
        <label>
          Tipo
          <select value={plan.kind} onChange={(e) => set({ kind: e.target.value })}>
            {Object.entries(PLAN_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <div className="two">
          <label>
            Griglia
            <select value={plan.grid} onChange={(e) => set({ grid: Number(e.target.value) })}>
              {[0.1, 0.25, 0.5, 1, 2, 5].map((g) => <option key={g} value={g}>{String(g).replace(".", ",")} m</option>)}
            </select>
          </label>
          <label>
            Aggancio
            <select value={plan.snap ? plan.snapStep : 0} onChange={(e) => (Number(e.target.value) ? set({ snap: true, snapStep: Number(e.target.value) }) : set({ snap: false }))}>
              <option value={0}>disattivato</option>
              {[0.05, 0.1, 0.25, 0.5, 1].map((g) => <option key={g} value={g}>ogni {String(g).replace(".", ",")} m</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="panel-section">
        <h3>Immagini sovrapposte</h3>
        {plan.overlays.length === 0 && <p className="muted small">Satellite, planimetrie, foto dall'alto o foto raddrizzate da mettere sotto il disegno per ricalcare.</p>}
        {[...plan.overlays].reverse().map((o) => (
          <div key={o.id} className="ov-row">
            <button className={"eye" + (o.hidden ? " off" : "")} onClick={() => setOv(o.id, { hidden: !o.hidden })} title={o.hidden ? "Mostra" : "Nascondi"}>{o.hidden ? "◌" : "●"}</button>
            <img src={uploadUrl(o.file)} alt="" />
            <button className="grow ov-name" onClick={() => onSelect(o.id)}>{o.name}<span className="muted small">{o.locked ? " · bloccata" : ""}</span></button>
          </div>
        ))}
        <button className="ghost" onClick={openBackground}>+ Aggiungi immagine o foto</button>
      </div>

      <div className="panel-section">
        <h3>Mostra</h3>
        {Object.entries(LAYERS).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={!hidden.has(k)} onChange={() => toggle(k)} /> {label}
            <span className="spacer" /><span className="muted small">{counts[k] || 0}</span>
          </label>
        ))}
      </div>

      <div className="panel-section">
        <h3>Riepilogo</h3>
        {plan.elements.length === 0 && <p className="muted small">Ancora vuoto: scegli uno strumento a sinistra e inizia a disegnare.</p>}
        {Object.entries(stats.areas).map(([k, m2]) => (
          <div key={k} className="stat-row"><span className="dot" style={{ background: AREA_KINDS[k]?.fill }} />{AREA_KINDS[k]?.label || k}<span className="spacer" /><strong>{fmtM2(m2)}</strong></div>
        ))}
        {(Object.keys(stats.pipes).length > 0 || stats.pozzetti > 0) && <div className="cat-title small">Impianti</div>}
        {Object.entries(stats.pipes).map(([k, m]) => (
          <div key={k} className="stat-row">
            <span className="dot" style={{ background: PIPE_CONTENTS[k]?.color || LINE_KINDS[k]?.color }} />
            {PIPE_CONTENTS[k]?.label || LINE_KINDS[k]?.label}<span className="spacer" /><strong>{fmtM(m)}</strong>
          </div>
        ))}
        {stats.pozzetti > 0 && <div className="stat-row"><span className="dot" style={{ background: "#bbb" }} />Pozzetti<span className="spacer" /><strong>× {stats.pozzetti}</strong></div>}
        {stats.stones > 0 && <div className="stat-row"><span className="dot" style={{ background: "#b9b3a6" }} />Piastre<span className="spacer" /><strong>× {stats.stones} · {fmtM2(stats.stonesM2)}</strong></div>}
        {Object.keys(stats.species).length > 0 && <div className="cat-title small">Piante</div>}
        {Object.entries(stats.species)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([pid, s]) => (
            <button key={pid} className="stat-row as-btn" onClick={() => onSelect(s.ids[0])}>
              <span className="dot" style={{ background: plants.get(pid)?.color }} />
              {plants.get(pid)?.name || "Pianta"}
              <span className="spacer" />
              <strong>× {s.count}</strong>
            </button>
          ))}
        {stats.photos > 0 && <div className="stat-row muted small">Foto dei lavori allegate: {stats.photos}</div>}
      </div>

      <div className="panel-section">
        <h3>Note</h3>
        <textarea rows="4" value={plan.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Idee, lavori, fornitori…" />
      </div>
    </>
  );
}

export default function Inspector(props) {
  const { selected, tool, plants, plantId, setPlantId, areaKind, setAreaKind, lineKind, setLineKind, onClose,
    stoneOpts, setStoneOpts, pozzOpts, setPozzOpts, pipeOpts, setPipeOpts } = props;
  let body;
  if (selected?.file) body = <OverlayPanel o={selected} {...props} />;
  else if (selected) body = <ElementPanel e={selected} {...props} />;
  else if (tool === "plant")
    body = (
      <div className="panel-section">
        <h3>Scegli la pianta</h3>
        <PlantPicker plants={plants} value={plantId} onPick={(p) => setPlantId(p.id)} />
      </div>
    );
  else if (tool === "rect" || tool === "poly")
    body = (
      <div className="panel-section">
        <h3>Tipo di area</h3>
        <KindChips kinds={AREA_KINDS} value={areaKind} onPick={setAreaKind} />
        <p className="muted small">{tool === "rect" ? "Trascina per disegnare un rettangolo." : "Clicca i vertici uno alla volta."} Le misure si vedono mentre disegni.</p>
      </div>
    );
  else if (tool === "line")
    body = (
      <div className="panel-section">
        <h3>Tipo di linea</h3>
        <KindChips kinds={LINE_KINDS} value={lineKind} onPick={setLineKind} />
        {lineKind === "corrugato" && <PipeFields value={pipeOpts} onChange={(patch) => setPipeOpts({ ...pipeOpts, ...patch })} />}
        {(lineKind === "irrigazione" || lineKind === "elettrico") && (
          <NumberField label="Profondità" value={pipeOpts.depth} onChange={(depth) => setPipeOpts({ ...pipeOpts, depth })} step={5} suffix="cm" />
        )}
        {UTILITY_KINDS.has(lineKind) && <p className="muted small">Segui il percorso dello scavo clic dopo clic; doppio clic per finire. Puoi allegare le foto dello scavo aperto.</p>}
      </div>
    );
  else if (tool === "stone")
    body = (
      <div className="panel-section">
        <h3>Piastre</h3>
        <div className="chips">
          {STONE_PRESETS.map((p) => (
            <button key={p.label} className={"chip" + (p.w === stoneOpts.w && p.h === stoneOpts.h && p.shape === stoneOpts.shape ? " active" : "")} onClick={() => setStoneOpts({ ...stoneOpts, w: p.w, h: p.h, shape: p.shape })}>{p.label}</button>
          ))}
        </div>
        <div className="two">
          <NumberField label="Larghezza" value={stoneOpts.w} onChange={(w) => w > 0.04 && setStoneOpts({ ...stoneOpts, w })} step={0.05} />
          <NumberField label="Lunghezza" value={stoneOpts.h} onChange={(h) => h > 0.04 && setStoneOpts({ ...stoneOpts, h })} step={0.05} />
        </div>
        <RotationField value={stoneOpts.rotation} onChange={(rotation) => setStoneOpts({ ...stoneOpts, rotation })} />
        <KindChips kinds={STONE_MATERIALS} value={stoneOpts.material} onPick={(material) => setStoneOpts({ ...stoneOpts, material })} />
        <p className="muted small">Clicca per posarle una alla volta. Con una foto raddrizzata sotto puoi ricalcarle esattamente dove sono.</p>
      </div>
    );
  else if (tool === "pozzetto")
    body = (
      <div className="panel-section">
        <h3>Pozzetto</h3>
        <div className="chips">
          {POZZETTO_PRESETS.map((p) => (
            <button key={p.label} className={"chip" + (p.w === pozzOpts.w && p.h === pozzOpts.h ? " active" : "")} onClick={() => setPozzOpts({ ...pozzOpts, w: p.w, h: p.h })}>{p.label}</button>
          ))}
        </div>
        <label>
          Chiusino
          <select value={pozzOpts.cover} onChange={(ev) => setPozzOpts({ ...pozzOpts, cover: ev.target.value })}>
            {POZZETTO_COVERS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <p className="muted small">Dopo averlo messo puoi scrivere profondità, cosa contiene e allegare le foto.</p>
      </div>
    );
  else if (tool === "photo")
    body = (
      <div className="panel-section">
        <h3>Foto sul posto</h3>
        <p className="muted small">Clicca un punto del disegno e scegli una o più foto (anche dalla fotocamera): restano attaccate a quel punto, con data e didascalia. Utile per gli scavi prima del rinterro.</p>
      </div>
    );
  else body = <PlanPanel {...props} />;

  return (
    <aside className="inspector">
      <button className="sheet-close" onClick={onClose} aria-label="Chiudi pannello">×</button>
      {body}
    </aside>
  );
}
