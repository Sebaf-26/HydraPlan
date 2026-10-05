import React from "react";

// 24×24 stroke icons.
const PATHS = {
  select: "M5 3l14 8-6 1.5L10 19z",
  pan: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
  rect: "M4 6h16v12H4z",
  poly: "M5 18L3 8l8-5 9 6-3 10z",
  line: "M4 18c4-8 8 0 16-12",
  plant: "M12 21v-7M12 14c-4 0-7-3-7-7 4 0 7 3 7 7zM12 12c0-4 3-7 7-7 0 4-3 7-7 7z",
  label: "M5 6V4h14v2M12 4v16M9 20h6",
  dim: "M3 12h18M3 8v8M21 8v8M7 10l-4 2 4 2M17 10l4 2-4 2",
  stone: "M4 7h7v6H4zM13 11h7v6h-7zM6 16h5v4H6z",
  pozzetto: "M4 4h16v16H4zM4 4l16 16M20 4L4 20",
  photo: "M4 8h3l2-2h6l2 2h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  calibrate: "M4 20L20 4M7 17l2 2M10 14l2 2M13 11l2 2M16 8l2 2",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  panel: "M3 4h18v16H3zM15 4v16"
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
