import React, { useState } from "react";
import { PLANT_CATS } from "../catalog.js";
import { go } from "../router.js";
import { uid } from "../geometry.js";

const EMPTY = { name: "", latin: "", cat: "perenne", d: 1, h: 1, color: "#5b8c3a", note: "" };

export default function Library({ plants, customPlants, onSave }) {
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");

  const all = [...plants.values()].filter((p) => (p.name + " " + p.latin).toLowerCase().includes(filter.toLowerCase()));

  function save(ev) {
    ev.preventDefault();
    if (!editing.name.trim()) return;
    const item = { ...editing, d: Number(editing.d) || 1, h: Number(editing.h) || 0, id: editing.id || "c-" + uid() };
    const exists = customPlants.some((p) => p.id === item.id);
    onSave(exists ? customPlants.map((p) => (p.id === item.id ? item : p)) : [...customPlants, item]);
    setEditing(null);
  }

  function remove(p) {
    if (!confirm(`Togliere "${p.name}" dalla libreria? Le piante già messe nei progetti restano.`)) return;
    onSave(customPlants.filter((c) => c.id !== p.id));
  }

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <div className="page">
      <header className="topbar">
        <button className="ghost" onClick={() => go("")}>‹ Progetti</button>
        <h1>Libreria piante</h1>
        <span className="spacer" />
        <button className="primary" onClick={() => setEditing({ ...EMPTY })}>+ Nuova pianta</button>
      </header>
      <main className="content">
        {editing && (
          <form className="card plant-form" onSubmit={save}>
            <h3>{editing.id ? "Modifica pianta" : "Nuova pianta"}</h3>
            <div className="form-grid">
              <label>Nome<input value={editing.name} onChange={set("name")} autoFocus /></label>
              <label>Nome latino<input value={editing.latin} onChange={set("latin")} /></label>
              <label>Categoria
                <select value={editing.cat} onChange={set("cat")}>
                  {Object.entries(PLANT_CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                </select>
              </label>
              <label>Colore<input type="color" value={editing.color} onChange={set("color")} /></label>
              <label>Diametro chioma (m)<input type="number" step="0.1" min="0.05" value={editing.d} onChange={set("d")} /></label>
              <label>Altezza (m)<input type="number" step="0.1" min="0" value={editing.h} onChange={set("h")} /></label>
            </div>
            <label>Note<textarea rows="2" value={editing.note} onChange={set("note")} placeholder="Esposizione, acqua, potatura…" /></label>
            <div className="row">
              <button className="primary">Salva</button>
              <button type="button" className="ghost" onClick={() => setEditing(null)}>Annulla</button>
            </div>
          </form>
        )}

        <input className="search" placeholder="Cerca pianta…" value={filter} onChange={(e) => setFilter(e.target.value)} />

        {Object.entries(PLANT_CATS).map(([cat, c]) => {
          const list = all.filter((p) => p.cat === cat);
          if (!list.length) return null;
          return (
            <section key={cat}>
              <h3 className="cat-title">{c.label}</h3>
              <ul className="plant-list">
                {list.map((p) => (
                  <li key={p.id} className="card plant-row">
                    <span className="swatch" style={{ background: p.color }} />
                    <div className="grow">
                      <strong>{p.name}</strong> {p.custom && <span className="badge">mia</span>}
                      <div className="muted small"><i>{p.latin}</i> · Ø {String(p.d).replace(".", ",")} m · h {String(p.h).replace(".", ",")} m</div>
                      {p.note && <div className="small">{p.note}</div>}
                    </div>
                    {p.custom ? (
                      <>
                        <button className="ghost small" onClick={() => setEditing({ ...EMPTY, ...p })}>Modifica</button>
                        <button className="ghost small danger" onClick={() => remove(p)}>Elimina</button>
                      </>
                    ) : (
                      <button className="ghost small" onClick={() => setEditing({ ...EMPTY, ...p, id: "", name: p.name + " (varietà)" })} title="Crea una tua variante con misure diverse">Personalizza</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
