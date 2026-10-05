// Built-in reference data. Plants: d = canopy diameter at maturity (m), h = height (m).
// Custom plants added from the Libreria page are stored on the server and merged in.

export const PLANT_CATS = {
  albero: { label: "Alberi", color: "#3f7d3a" },
  frutto: { label: "Alberi da frutto", color: "#6a9a2f" },
  arbusto: { label: "Arbusti", color: "#5f8f55" },
  siepe: { label: "Siepi", color: "#2f6b4a" },
  perenne: { label: "Fiori e perenni", color: "#c76d9b" },
  aromatica: { label: "Aromatiche", color: "#7d9c6b" },
  ortaggio: { label: "Ortaggi", color: "#9bb33b" },
  rampicante: { label: "Rampicanti", color: "#4d8a6e" },
  graminacea: { label: "Graminacee", color: "#b5a65a" }
};

export const BUILTIN_PLANTS = [
  { id: "acero-campestre", name: "Acero campestre", latin: "Acer campestre", cat: "albero", d: 6, h: 10, color: "#4a7d3a" },
  { id: "acero-giapponese", name: "Acero giapponese", latin: "Acer palmatum", cat: "albero", d: 3, h: 4, color: "#b5462f" },
  { id: "betulla", name: "Betulla", latin: "Betula pendula", cat: "albero", d: 5, h: 15, color: "#8fae5a" },
  { id: "carpino", name: "Carpino bianco", latin: "Carpinus betulus", cat: "albero", d: 7, h: 15, color: "#477a3c" },
  { id: "tiglio", name: "Tiglio", latin: "Tilia cordata", cat: "albero", d: 9, h: 20, color: "#3e7337" },
  { id: "magnolia", name: "Magnolia", latin: "Magnolia grandiflora", cat: "albero", d: 6, h: 10, color: "#3b6d3f" },
  { id: "olivo", name: "Olivo", latin: "Olea europaea", cat: "albero", d: 5, h: 6, color: "#8a9a6b" },
  { id: "lagerstroemia", name: "Lagerstroemia", latin: "Lagerstroemia indica", cat: "albero", d: 3, h: 5, color: "#c55a8a" },
  { id: "melo", name: "Melo", latin: "Malus domestica", cat: "frutto", d: 4, h: 4, color: "#6c9b34" },
  { id: "pero", name: "Pero", latin: "Pyrus communis", cat: "frutto", d: 3.5, h: 5, color: "#749a3a" },
  { id: "ciliegio", name: "Ciliegio", latin: "Prunus avium", cat: "frutto", d: 5, h: 6, color: "#9a3b48" },
  { id: "albicocco", name: "Albicocco", latin: "Prunus armeniaca", cat: "frutto", d: 4, h: 5, color: "#d18a3a" },
  { id: "pesco", name: "Pesco", latin: "Prunus persica", cat: "frutto", d: 3.5, h: 4, color: "#d97a6a" },
  { id: "fico", name: "Fico", latin: "Ficus carica", cat: "frutto", d: 5, h: 5, color: "#5d7f3c" },
  { id: "limone", name: "Limone (vaso)", latin: "Citrus limon", cat: "frutto", d: 1.5, h: 2, color: "#d8c43a" },
  { id: "nocciolo", name: "Nocciolo", latin: "Corylus avellana", cat: "frutto", d: 4, h: 5, color: "#7c8a3f" },
  { id: "ortensia", name: "Ortensia", latin: "Hydrangea macrophylla", cat: "arbusto", d: 1.5, h: 1.5, color: "#6f86c9" },
  { id: "rosa", name: "Rosa", latin: "Rosa", cat: "arbusto", d: 1, h: 1.2, color: "#d4486a" },
  { id: "pittosporo", name: "Pittosporo", latin: "Pittosporum tobira", cat: "arbusto", d: 2, h: 2.5, color: "#4f7c4a" },
  { id: "bosso", name: "Bosso", latin: "Buxus sempervirens", cat: "arbusto", d: 0.6, h: 0.6, color: "#3f6b3a" },
  { id: "oleandro", name: "Oleandro", latin: "Nerium oleander", cat: "arbusto", d: 2.5, h: 3, color: "#e07a9a" },
  { id: "viburno", name: "Viburno", latin: "Viburnum tinus", cat: "arbusto", d: 2, h: 2.5, color: "#5b8550" },
  { id: "photinia", name: "Photinia", latin: "Photinia × fraseri", cat: "siepe", d: 1.2, h: 3, color: "#a8483a" },
  { id: "lauro", name: "Lauroceraso", latin: "Prunus laurocerasus", cat: "siepe", d: 1.5, h: 3, color: "#2f5f37" },
  { id: "ligustro", name: "Ligustro", latin: "Ligustrum japonicum", cat: "siepe", d: 1, h: 2.5, color: "#46754a" },
  { id: "eleagno", name: "Eleagno", latin: "Elaeagnus × ebbingei", cat: "siepe", d: 1.5, h: 2.5, color: "#8a9a7a" },
  { id: "lavanda", name: "Lavanda", latin: "Lavandula angustifolia", cat: "perenne", d: 0.6, h: 0.6, color: "#8a72c9" },
  { id: "salvia-orn", name: "Salvia ornamentale", latin: "Salvia nemorosa", cat: "perenne", d: 0.5, h: 0.5, color: "#6a5ac0" },
  { id: "echinacea", name: "Echinacea", latin: "Echinacea purpurea", cat: "perenne", d: 0.5, h: 0.8, color: "#c75a9a" },
  { id: "gaura", name: "Gaura", latin: "Gaura lindheimeri", cat: "perenne", d: 0.6, h: 0.8, color: "#e8b3c8" },
  { id: "geranio", name: "Geranio", latin: "Pelargonium", cat: "perenne", d: 0.4, h: 0.4, color: "#d8403a" },
  { id: "tulipani", name: "Tulipani (gruppo)", latin: "Tulipa", cat: "perenne", d: 0.5, h: 0.4, color: "#e8574a" },
  { id: "rosmarino", name: "Rosmarino", latin: "Salvia rosmarinus", cat: "aromatica", d: 0.8, h: 1, color: "#5e7d6a" },
  { id: "salvia", name: "Salvia", latin: "Salvia officinalis", cat: "aromatica", d: 0.5, h: 0.5, color: "#8ea38a" },
  { id: "timo", name: "Timo", latin: "Thymus vulgaris", cat: "aromatica", d: 0.3, h: 0.3, color: "#7a8f6a" },
  { id: "basilico", name: "Basilico", latin: "Ocimum basilicum", cat: "aromatica", d: 0.3, h: 0.4, color: "#4fa04a" },
  { id: "menta", name: "Menta", latin: "Mentha", cat: "aromatica", d: 0.5, h: 0.4, color: "#5fb06a" },
  { id: "pomodoro", name: "Pomodoro", latin: "Solanum lycopersicum", cat: "ortaggio", d: 0.5, h: 1.6, color: "#d8473a" },
  { id: "zucchina", name: "Zucchina", latin: "Cucurbita pepo", cat: "ortaggio", d: 1, h: 0.6, color: "#5b9a3a" },
  { id: "melanzana", name: "Melanzana", latin: "Solanum melongena", cat: "ortaggio", d: 0.6, h: 0.8, color: "#6a3f7a" },
  { id: "peperone", name: "Peperone", latin: "Capsicum annuum", cat: "ortaggio", d: 0.5, h: 0.7, color: "#e0a03a" },
  { id: "insalata", name: "Insalata", latin: "Lactuca sativa", cat: "ortaggio", d: 0.3, h: 0.3, color: "#9cc85a" },
  { id: "fragola", name: "Fragola", latin: "Fragaria × ananassa", cat: "ortaggio", d: 0.3, h: 0.2, color: "#d84a5a" },
  { id: "fagiolino", name: "Fagiolino", latin: "Phaseolus vulgaris", cat: "ortaggio", d: 0.3, h: 1.8, color: "#6fa04a" },
  { id: "glicine", name: "Glicine", latin: "Wisteria sinensis", cat: "rampicante", d: 3, h: 8, color: "#9a86d0" },
  { id: "gelsomino", name: "Falso gelsomino", latin: "Trachelospermum jasminoides", cat: "rampicante", d: 1.5, h: 5, color: "#4a7a55" },
  { id: "vite", name: "Vite", latin: "Vitis vinifera", cat: "rampicante", d: 2, h: 3, color: "#6a7a3a" },
  { id: "bouganville", name: "Bouganville", latin: "Bougainvillea", cat: "rampicante", d: 2, h: 4, color: "#c03a8a" },
  { id: "miscanthus", name: "Miscanthus", latin: "Miscanthus sinensis", cat: "graminacea", d: 1, h: 1.5, color: "#c2b26a" },
  { id: "pennisetum", name: "Pennisetum", latin: "Pennisetum alopecuroides", cat: "graminacea", d: 0.8, h: 0.8, color: "#c8a87a" }
];

// Surfaces drawn with the rectangle/polygon tools.
export const AREA_KINDS = {
  prato: { label: "Prato", fill: "#9fcf7a", stroke: "#5f9a3f" },
  aiuola: { label: "Aiuola", fill: "#a9785a", stroke: "#6e4a33" },
  orto: { label: "Orto", fill: "#8a6a4a", stroke: "#5a4330" },
  ghiaia: { label: "Ghiaia", fill: "#d6d0c2", stroke: "#a39c8c" },
  pavimento: { label: "Pavimentazione", fill: "#c9b9a0", stroke: "#8f7d63" },
  legno: { label: "Deck in legno", fill: "#b98b5a", stroke: "#7d5a35" },
  acqua: { label: "Acqua / piscina", fill: "#7ec4e0", stroke: "#3d8fb0" },
  edificio: { label: "Edificio", fill: "#d9d6d0", stroke: "#6b6760" },
  stanza: { label: "Stanza", fill: "#f1ece2", stroke: "#8a8273" },
  altro: { label: "Altro", fill: "#cfd8dc", stroke: "#78909c" }
};

// Lines drawn with the line tool; width is in metres (0 = hairline).
export const LINE_KINDS = {
  vialetto: { label: "Vialetto", color: "#c9b48f", width: 1 },
  recinzione: { label: "Recinzione", color: "#5d4a3a", width: 0, dash: "6 4" },
  muro: { label: "Muro", color: "#6b6760", width: 0.3 },
  siepe: { label: "Siepe", color: "#2f6b4a", width: 0.8 },
  bordura: { label: "Bordura", color: "#7a6a5a", width: 0.1 },
  irrigazione: { label: "Irrigazione", color: "#2b7fc0", width: 0, dash: "2 3" },
  elettrico: { label: "Cavo elettrico", color: "#e0a020", width: 0, dash: "8 3 2 3" }
};

export const PLAN_KINDS = {
  giardino: "Giardino",
  orto: "Orto",
  terrazzo: "Terrazzo",
  casa: "Casa",
  altro: "Altro"
};
