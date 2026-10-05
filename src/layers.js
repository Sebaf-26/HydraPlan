import { UTILITY_KINDS } from "./catalog.js";

// Groups the user can show/hide (stored per plan, per device).
export const LAYERS = {
  immagini: "Immagini sovrapposte",
  aree: "Aree",
  percorsi: "Vialetti, siepi, recinzioni",
  impianti: "Impianti interrati (tubi, pozzetti)",
  piastre: "Piastre",
  piante: "Piante",
  note: "Testi e quote",
  foto: "Foto dei lavori"
};

export function layerOf(e) {
  switch (e.type) {
    case "area":
      return "aree";
    case "line":
      return UTILITY_KINDS.has(e.kind) ? "impianti" : "percorsi";
    case "pozzetto":
      return "impianti";
    case "stone":
      return "piastre";
    case "plant":
      return "piante";
    case "photo":
      return "foto";
    default:
      return "note";
  }
}
