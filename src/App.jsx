import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "./router.js";
import { api, AuthError } from "./api.js";
import { BUILTIN_PLANTS } from "./catalog.js";
import Login from "./components/Login.jsx";
import PlanList from "./components/PlanList.jsx";
import Library from "./components/Library.jsx";
import Editor from "./components/Editor.jsx";

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [customPlants, setCustomPlants] = useState([]);
  const route = useRoute();

  const onError = useCallback((err) => {
    if (err instanceof AuthError) setAuthed(false);
    else alert(err.message);
  }, []);

  useEffect(() => {
    if (authed === false) return;
    api("me")
      .then(() => api("plants"))
      .then((p) => {
        setCustomPlants(p);
        setAuthed(true);
      })
      .catch((err) => (err instanceof AuthError ? setAuthed(false) : setAuthed(true)));
  }, [authed]);

  const plants = useMemo(() => {
    const map = new Map();
    for (const p of [...BUILTIN_PLANTS, ...customPlants]) map.set(p.id, { ...p, custom: p.id.startsWith("c-") });
    return map;
  }, [customPlants]);

  const saveCustomPlants = useCallback(
    (list) => api("plants", { method: "PUT", body: list }).then(setCustomPlants).catch(onError),
    [onError]
  );

  if (authed === null) return <div className="splash">HydraPlan…</div>;
  if (!authed) return <Login onDone={() => setAuthed(null)} />;

  const logout = () => api("logout", { method: "POST" }).finally(() => setAuthed(false));

  if (route[0] === "plan" && route[1]) {
    return <Editor key={route[1]} id={route[1]} plants={plants} onError={onError} />;
  }
  if (route[0] === "libreria") {
    return <Library plants={plants} customPlants={customPlants} onSave={saveCustomPlants} />;
  }
  return <PlanList onError={onError} onLogout={logout} />;
}
