import React, { useState } from "react";
import { api } from "../api.js";

export default function Login({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev) {
    ev.preventDefault();
    if (!username || !password) return setError("Inserisci nome utente e password.");
    setBusy(true);
    setError("");
    try {
      await api("login", { method: "POST", body: { username: username.trim(), password } });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <img src="icon.svg" alt="" width="64" height="64" />
      <h1>HydraPlan</h1>
      <form className="card" onSubmit={submit}>
        <label>
          Nome utente
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>Accedi</button>
      </form>
    </main>
  );
}
