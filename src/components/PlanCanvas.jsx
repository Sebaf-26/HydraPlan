import React, { memo } from "react";
import { AREA_KINDS, LINE_KINDS, PLANT_CATS } from "../catalog.js";
import { centroid, dist, fmtM, fmtM2, polygonArea } from "../geometry.js";
import { uploadUrl } from "../api.js";

const NS = { vectorEffect: "non-scaling-stroke" };

// Mix a #rrggbb colour towards black (amount < 0) or white (amount > 0).
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const a = Math.abs(amount);
  const ch = (v) => Math.round(v + (target - v) * a).toString(16).padStart(2, "0");
  return "#" + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
}

export const plantColor = (e, species) => e.color || species?.color || PLANT_CATS[species?.cat]?.color || "#5b8c3a";

function Grid({ view, size, grid }) {
  // Coarsen the grid when zoomed out so lines never get closer than ~10px.
  let step = grid;
  while (step * view.scale < 10) step *= step * 5 * view.scale < 10 ? 10 : 5;
  const x1 = view.x + size.w / view.scale;
  const y1 = view.y + size.h / view.scale;
  const minor = [], majors = [];
  // Integer indices avoid float drift; every 5th line is a major one.
  for (let i = Math.floor(view.x / step); i * step <= x1; i++) (i % 5 ? minor : majors).push(`M${i * step} ${view.y}V${y1}`);
  for (let i = Math.floor(view.y / step); i * step <= y1; i++) (i % 5 ? minor : majors).push(`M${view.x} ${i * step}H${x1}`);
  return (
    <g className="grid" pointerEvents="none">
      <path d={minor.join("")} stroke="var(--grid)" strokeWidth="1" {...NS} />
      <path d={majors.join("")} stroke="var(--grid-major)" strokeWidth="1" {...NS} />
      <path d={`M0 ${view.y}V${y1}M${view.x} 0H${x1}`} stroke="var(--grid-axis)" strokeWidth="1.5" {...NS} />
    </g>
  );
}

const Area = memo(function Area({ e, faded }) {
  const k = AREA_KINDS[e.kind] || AREA_KINDS.altro;
  const d = "M" + e.points.map((p) => p.join(" ")).join("L") + "Z";
  return (
    <g data-id={e.id} className="el">
      <path d={d} fill={e.color || k.fill} fillOpacity={faded ? 0.6 : 0.92} stroke={e.color ? shade(e.color, -0.35) : k.stroke} strokeWidth="1.5" strokeLinejoin="round" {...NS} />
    </g>
  );
});

// Drawn above lines and plants so a path crossing a lawn does not hide its name.
function AreaLabel({ e, scale }) {
  const m2 = polygonArea(e.points);
  if (Math.sqrt(m2) * scale <= 70) return null;
  const [cx, cy] = centroid(e.points);
  return (
    <text x={cx} y={cy} fontSize={12 / scale} textAnchor="middle" className="area-label" pointerEvents="none">
      <tspan x={cx}>{e.name || (AREA_KINDS[e.kind] || AREA_KINDS.altro).label}</tspan>
      <tspan x={cx} dy="1.25em" className="sub">{fmtM2(m2)}</tspan>
    </text>
  );
}

const Line = memo(function Line({ e }) {
  const k = LINE_KINDS[e.kind] || LINE_KINDS.vialetto;
  const color = e.color || k.color;
  const d = "M" + e.points.map((p) => p.join(" ")).join("L");
  const hair = !(e.width > 0);
  return (
    <g data-id={e.id} className="el">
      <path d={d} fill="none" stroke="transparent" strokeWidth="14" {...NS} strokeLinecap="round" />
      {hair ? (
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={k.dash} strokeLinejoin="round" {...NS} />
      ) : (
        <>
          <path d={d} fill="none" stroke={shade(color, -0.3)} strokeWidth={e.width} strokeLinejoin="round" strokeLinecap="round" />
          <path d={d} fill="none" stroke={color} strokeWidth={Math.max(e.width - 0.06, e.width * 0.85)} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </g>
  );
});

const Plant = memo(function Plant({ e, species, scale }) {
  const color = plantColor(e, species);
  const r = e.d / 2;
  const tree = species && (species.cat === "albero" || species.cat === "frutto");
  const name = e.name || species?.name || "Pianta";
  return (
    <g data-id={e.id} className="el">
      <circle cx={e.x} cy={e.y} r={r} fill={color} fillOpacity="0.6" stroke={shade(color, -0.35)} strokeWidth="1.5" {...NS} />
      {tree && <circle cx={e.x} cy={e.y} r={r * 0.62} fill="none" stroke={shade(color, -0.2)} strokeWidth="1" strokeDasharray="3 3" {...NS} />}
      <circle cx={e.x} cy={e.y} r={Math.min(r * 0.12, 3 / scale)} fill={shade(color, -0.5)} />
      {e.d * scale > 44 && (
        <text x={e.x} y={e.y + r * 0.35 + 6 / scale} fontSize={11 / scale} textAnchor="middle" className="plant-label" pointerEvents="none">
          {name.length > 18 ? name.slice(0, 17) + "…" : name}
        </text>
      )}
    </g>
  );
});

function Dim({ e, scale, draft }) {
  const [a, b] = e.points;
  const len = dist(a, b);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const t = 6 / scale;
  const nx = -Math.sin(ang) * t, ny = Math.cos(ang) * t;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  let deg = (ang * 180) / Math.PI;
  if (deg > 90 || deg < -90) deg += 180;
  return (
    <g data-id={draft ? undefined : e.id} className={draft ? "draft" : "el"}>
      <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} stroke="transparent" strokeWidth="14" {...NS} />
      <path
        d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${a[0] - nx} ${a[1] - ny}L${a[0] + nx} ${a[1] + ny}M${b[0] - nx} ${b[1] - ny}L${b[0] + nx} ${b[1] + ny}`}
        stroke="var(--dim)" strokeWidth="1.5" {...NS}
      />
      <text x={mx} y={my} dy={-5 / scale} fontSize={12 / scale} textAnchor="middle" className="dim-label" transform={`rotate(${deg} ${mx} ${my})`} pointerEvents="none">
        {fmtM(len)}
      </text>
    </g>
  );
}

function Label({ e }) {
  return (
    <g data-id={e.id} className="el">
      <text x={e.x} y={e.y} fontSize={e.size} textAnchor="middle" dominantBaseline="middle" fill={e.color || "var(--label)"} className="free-label">
        {e.text}
      </text>
    </g>
  );
}

function Handle({ x, y, scale, owner, handle, kind = "vertex" }) {
  const s = (kind === "mid" ? 8 : 11) / scale;
  return kind === "vertex" || kind === "mid" ? (
    <rect
      x={x - s / 2} y={y - s / 2} width={s} height={s}
      data-handle={handle} data-owner={owner}
      className={"handle " + kind}
      strokeWidth="1.5" {...NS}
    />
  ) : (
    <circle cx={x} cy={y} r={s / 1.6} data-handle={handle} data-owner={owner} className={"handle " + kind} strokeWidth="1.5" {...NS} />
  );
}

function Selection({ e, scale }) {
  if (!e) return null;
  const out = [];
  if (e.points) {
    const closed = e.type === "area";
    const d = "M" + e.points.map((p) => p.join(" ")).join("L") + (closed ? "Z" : "");
    out.push(<path key="o" d={d} className="sel-outline" fill="none" strokeWidth="1.5" {...NS} pointerEvents="none" />);
    if (!e.locked) {
      e.points.forEach(([x, y], i) => {
        const j = (i + 1) % e.points.length;
        if ((closed || j > i) && e.type !== "dim") {
          const [x2, y2] = e.points[j];
          if (Math.hypot(x2 - x, y2 - y) * scale > 30)
            out.push(<Handle key={"m" + i} x={(x + x2) / 2} y={(y + y2) / 2} scale={scale} owner={e.id} handle={"m:" + i} kind="mid" />);
        }
      });
      e.points.forEach(([x, y], i) => out.push(<Handle key={"v" + i} x={x} y={y} scale={scale} owner={e.id} handle={"v:" + i} />));
    }
  } else if (e.type === "plant") {
    out.push(<circle key="o" cx={e.x} cy={e.y} r={e.d / 2} className="sel-outline" fill="none" strokeWidth="1.5" {...NS} pointerEvents="none" />);
    if (!e.locked) out.push(<Handle key="r" x={e.x + e.d / 2} y={e.y} scale={scale} owner={e.id} handle="r" kind="radius" />);
  } else if (e.type === "label") {
    const w = e.text.length * e.size * 0.3 + 4 / scale;
    out.push(<rect key="o" x={e.x - w} y={e.y - e.size * 0.7} width={w * 2} height={e.size * 1.4} className="sel-outline" fill="none" strokeWidth="1.5" {...NS} pointerEvents="none" />);
  }
  return <g className="no-export">{out}</g>;
}

function Draft({ draft, scale }) {
  if (!draft) return null;
  const pts = draft.hover ? [...draft.points, draft.hover] : draft.points;
  if (draft.type === "rect") {
    const [[x1, y1], [x2, y2]] = draft.points;
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    return (
      <g className="draft no-export" pointerEvents="none">
        <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={w} height={h} strokeWidth="1.5" {...NS} />
        <text x={Math.max(x1, x2)} y={Math.max(y1, y2)} dx={6 / scale} dy={14 / scale} fontSize={12 / scale} className="draft-label">
          {fmtM(w)} × {fmtM(h)} · {fmtM2(w * h)}
        </text>
      </g>
    );
  }
  if (draft.type === "dim" || draft.type === "calibrate") {
    return <g className="no-export" pointerEvents="none"><Dim e={{ points: draft.points }} scale={scale} draft /></g>;
  }
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return (
    <g className="draft no-export" pointerEvents="none">
      <path d={"M" + pts.map((p) => p.join(" ")).join("L") + (draft.type === "poly" && pts.length > 2 ? "Z" : "")} strokeWidth="1.5" {...NS} />
      {draft.points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={(i === 0 ? 6 : 4) / scale} className={i === 0 ? "first" : ""} />)}
      {prev && (
        <text x={last[0]} y={last[1]} dx={8 / scale} dy={-8 / scale} fontSize={12 / scale} className="draft-label">
          {fmtM(dist(prev, last))}
        </text>
      )}
    </g>
  );
}

export default function PlanCanvas({ plan, view, size, plants, selectedId, draft, svgRef, handlers, cursor }) {
  const { scale } = view;
  const bg = plan.background;
  const selected = plan.elements.find((e) => e.id === selectedId);
  const byType = (t) => plan.elements.filter((e) => e.type === t);
  // Big canopies first so small plants stay clickable on top.
  const plantsSorted = byType("plant").sort((a, b) => b.d - a.d);

  return (
    <svg
      ref={svgRef}
      className="canvas"
      style={{ cursor }}
      width={size.w}
      height={size.h}
      viewBox={`${view.x} ${view.y} ${size.w / scale} ${size.h / scale}`}
      {...handlers}
    >
      <rect className="no-export paper" x={view.x} y={view.y} width={size.w / scale} height={size.h / scale} />
      {bg && (
        <image
          href={uploadUrl(bg.file)}
          x={bg.x} y={bg.y} width={bg.width} height={bg.height}
          opacity={bg.opacity}
          preserveAspectRatio="none"
          data-bg=""
          pointerEvents={bg.locked ? "none" : "auto"}
          className={bg.locked ? "" : "bg-movable"}
        />
      )}
      <Grid view={view} size={size} grid={plan.grid} />
      {byType("area").map((e) => <Area key={e.id} e={e} faded={!!bg} />)}
      {byType("line").map((e) => <Line key={e.id} e={e} />)}
      {plantsSorted.map((e) => <Plant key={e.id} e={e} species={plants.get(e.plantId)} scale={scale} />)}
      {byType("area").map((e) => <AreaLabel key={e.id} e={e} scale={scale} />)}
      {byType("dim").map((e) => <Dim key={e.id} e={e} scale={scale} />)}
      {byType("label").map((e) => <Label key={e.id} e={e} />)}
      <Selection e={selected} scale={scale} />
      <Draft draft={draft} scale={scale} />
    </svg>
  );
}
