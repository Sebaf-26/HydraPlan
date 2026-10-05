export class AuthError extends Error {}

// Session cookie travels automatically (same origin). 401 means "show the login".
export async function api(path, { method = "GET", body, raw, type } = {}) {
  const res = await fetch("api/" + path, {
    method,
    cache: "no-store",
    headers: raw ? { "Content-Type": type } : body === undefined ? {} : { "Content-Type": "application/json" },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "login") throw new AuthError(data.error || "Accesso richiesto");
  if (!res.ok) throw new Error(data.error || "Errore " + res.status);
  return data;
}

export const uploadUrl = (file) => "api/uploads/" + file;
