import React, { useMemo, useState } from "react";
import { AREA_KINDS, LINE_KINDS, PLANT_CATS, PLAN_KINDS } from "../catalog.js";
import { dist, fmtM, fmtM2, pathLength, polygonArea } from "../geometry.js";
import { plantColor } from "./PlanCanvas.jsx";
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

function ElementPanel({ e, plants, updateElement, removeElement, duplicate, reorder }) {
  const set = (patch) => updateElement(e.id, patch);
  const species = e.type === "plant" ? plants.get(e.plantId) : null;
  const title = { area: "Area", line: "Linea", plant: "Pianta", label: "Testo", dim: "Quota" }[e.type];
  const defaultColor =
    e.type === "area" ? (AREA_KINDS[e.kind] || AREA_KINDS.altro).fill :
    e.type === "line" ? (LINE_KINDS[e.kind] || LINE_KINDS.vialetto).color :
    e.type === "plant" ? plantColor({}, species) : "#333333";

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
            {e.width > 0 && <div><span className="muted small">Superficie</span><strong>{fmtM2(pathLength(e.points) * e.width)}</strong></div>}
          </div>
          <KindChips kinds={LINE_KINDS} value={e.kind} onPick={(kind) => set({ kind, width: LINE_KINDS[kind].width || 0 })} />
          <NumberField label="Larghezza (0 = linea sottile)" value={e.width} onChange={(width) => set({ width })} step={0.05} />
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
      {e.type !== "dim" && (
        <label className="color-row">
          Colore
          <input type="color" value={e.color || defaultColor} onChange={(ev) => set({ color: ev.target.value })} />
          {e.color && <button className="link small" onClick={() => set({ color: "" })}>predefinito</button>}
        </label>
      )}
      <label>Note<textarea rows="3" value={e.note} onChange={(ev) => set({ note: ev.target.value })} placeholder="Annotazioni, lavori da fare…" /></label>
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

function PlanPanel({ plan, plants, change, openBackground, startCalibrate, onSelect }) {
  const set = (patch) => change((p) => ({ ...p, ...patch }));
  const bg = plan.background;
  const setBg = (patch) => change((p) => ({ ...p, background: { ...p.background, ...patch } }));

  const stats = useMemo(() => {
    const areas = {};
    const species = {};
    for (const e of plan.elements) {
      if (e.type === "area") areas[e.kind] = (areas[e.kind] || 0) + polygonArea(e.points);
      if (e.type === "plant") {
        const s = (species[e.plantId] ||= { count: 0, ids: [] });
        s.count++;
        s.ids.push(e.id);
      }
    }
    return { areas, species };
  }, [plan.elements]);

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
        <h3>Sfondo</h3>
        {bg ? (
          <>
            <p className="muted small">{fmtM(bg.width)} × {fmtM(bg.height)}{bg.source ? " · " + bg.source : ""}</p>
            <label>
              Opacità
              <input type="range" min="0.05" max="1" step="0.05" value={bg.opacity} onChange={(e) => setBg({ opacity: Number(e.target.value) })} />
            </label>
            <label className="check"><input type="checkbox" checked={!bg.locked} onChange={(e) => setBg({ locked: !e.target.checked })} /> Sposta lo sfondo trascinandolo</label>
            <NumberField label="Larghezza reale dello sfondo" value={bg.width} onChange={(w) => w > 0 && setBg({ width: w, height: (bg.height * w) / bg.width })} step={0.5} />
            <div className="row wrap">
              <button className="ghost small" onClick={startCalibrate}>Calibra con una misura</button>
              <button className="ghost small" onClick={openBackground}>Sostituisci</button>
              <button className="ghost small danger" onClick={() => confirm("Togliere lo sfondo?") && set({ background: null })}>Rimuovi</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">Metti sotto il disegno una foto, una planimetria o la vista satellitare, poi ricalca.</p>
            <button className="ghost" onClick={openBackground}>+ Aggiungi sfondo</button>
          </>
        )}
      </div>

      <div className="panel-section">
        <h3>Riepilogo</h3>
        {Object.keys(stats.areas).length === 0 && Object.keys(stats.species).length === 0 && <p className="muted small">Ancora vuoto: scegli uno strumento a sinistra e inizia a disegnare.</p>}
        {Object.entries(stats.areas).map(([k, m2]) => (
          <div key={k} className="stat-row"><span className="dot" style={{ background: AREA_KINDS[k]?.fill }} />{AREA_KINDS[k]?.label || k}<span className="spacer" /><strong>{fmtM2(m2)}</strong></div>
        ))}
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
      </div>

      <div className="panel-section">
        <h3>Note</h3>
        <textarea rows="4" value={plan.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Idee, lavori, fornitori…" />
      </div>
    </>
  );
}

export default function Inspector(props) {
  const { selected, tool, plants, plantId, setPlantId, areaKind, setAreaKind, lineKind, setLineKind, onClose } = props;
  let body;
  if (selected) body = <ElementPanel e={selected} {...props} />;
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
