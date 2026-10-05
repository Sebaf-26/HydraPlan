import React, { useEffect, useState } from "react";
import { api, uploadUrl } from "../api.js";
import { PLAN_KINDS } from "../catalog.js";
import { go } from "../router.js";

const fmtDate = (iso) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

export default function PlanList({ onError, onLogout }) {
  const [plans, setPlans] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("giardino");

  const load = () => api("plans").then(setPlans).catch(onError);
  useEffect(() => { load(); }, []);

  async function create(ev) {
    ev.preventDefault();
    if (!name.trim()) return;
    try {
      const plan = await api("plans", { method: "POST", body: { name: name.trim(), kind, grid: kind === "casa" ? 0.5 : 1 } });
      go("plan/" + plan.id);
    } catch (err) {
      onError(err);
    }
  }

  async function duplicate(p) {
    const n = prompt("Nome della copia", p.name + " (copia)");
    if (!n) return;
    await api("plans", { method: "POST", body: { fromId: p.id, name: n } }).catch(onError);
    load();
  }

  async function remove(p) {
    if (!confirm(`Eliminare "${p.name}"? Non si può annullare.`)) return;
    await api("plans/" + p.id, { method: "DELETE" }).catch(onError);
    load();
  }

  return (
    <div className="page">
      <header className="topbar">
        <img src="icon.svg" alt="" width="30" height="30" />
        <h1>HydraPlan</h1>
        <span className="spacer" />
        <button className="ghost" onClick={() => go("libreria")}>Libreria piante</button>
        <button className="ghost" onClick={onLogout}>Esci</button>
      </header>

      <main className="content">
        <div className="section-head">
          <h2>I miei progetti</h2>
          <button className="primary" onClick={() => setCreating((v) => !v)}>+ Nuovo progetto</button>
        </div>

        {creating && (
          <form className="card new-plan" onSubmit={create}>
            <input placeholder="Nome, es. Giardino di casa" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(PLAN_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="primary">Crea</button>
          </form>
        )}

        {plans === null ? (
          <p className="muted">Caricamento…</p>
        ) : plans.length === 0 ? (
          <div className="empty card">
            <p><strong>Nessun progetto ancora.</strong></p>
            <p className="muted">Crea il primo schema del giardino: puoi disegnarlo in scala da zero, oppure partire da una foto o dalla vista satellitare.</p>
          </div>
        ) : (
          <ul className="plan-grid">
            {[...plans].sort((a, b) => b.updated.localeCompare(a.updated)).map((p) => (
              <li key={p.id} className="plan-card card">
                <button className="plan-open" onClick={() => go("plan/" + p.id)}>
                  <div className="thumb" style={p.background ? { backgroundImage: `url(${uploadUrl(p.background.file)})` } : undefined}>
                    {!p.background && <span>{PLAN_KINDS[p.kind]?.[0]}</span>}
                  </div>
                  <div className="plan-meta">
                    <strong>{p.name}</strong>
                    <span className="muted small">
                      {PLAN_KINDS[p.kind]} · {p.counts.plants} piante · {p.counts.areas} aree
                    </span>
                    <span className="muted small">Modificato {fmtDate(p.updated)}</span>
                  </div>
                </button>
                <div className="plan-actions">
                  <button className="ghost small" onClick={() => duplicate(p)} title="Salva una copia, utile come versione">Duplica</button>
                  <button className="ghost small danger" onClick={() => remove(p)}>Elimina</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
