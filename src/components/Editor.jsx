import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, AuthError } from "../api.js";
import { go } from "../router.js";
import { bounds, dist, uid } from "../geometry.js";
import PlanCanvas from "./PlanCanvas.jsx";
import Inspector from "./Inspector.jsx";
import BackgroundDialog from "./BackgroundDialog.jsx";
import PhotoRectify from "./PhotoRectify.jsx";
import { uploadPhotos } from "../photos.js";
import Icon from "./Icon.jsx";
import { exportPng } from "../exportPng.js";

const TOOLS = [
  { id: "select", label: "Seleziona", key: "v" },
  { id: "pan", label: "Sposta vista", key: "h" },
  { id: "rect", label: "Rettangolo", key: "r" },
  { id: "poly", label: "Forma libera", key: "p" },
  { id: "line", label: "Linea / vialetto", key: "l" },
  { id: "plant", label: "Pianta", key: "a" },
  { id: "stone", label: "Piastra", key: "s" },
  { id: "pozzetto", label: "Pozzetto", key: "o" },
  { id: "photo", label: "Foto sul posto", key: "f" },
  { id: "label", label: "Testo", key: "t" },
  { id: "dim", label: "Quota", key: "m" }
];
const CURSORS = { select: "default", pan: "grab", plant: "copy", stone: "copy", pozzetto: "copy", label: "text" };
const hiddenKey = (id) => "hydraplan_hidden_" + id;
const MIN_SCALE = 0.3, MAX_SCALE = 3000;

const viewKey = (id) => "hydraplan_view_" + id;
function storedView(id) {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey(id)));
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) && v.scale > 0 ? v : null;
  } catch {
    return null;
  }
}

export default function Editor({ id, plants, onError }) {
  const [plan, setPlan] = useState(null);
  const selectedIdRef = useRef(null);
  const [view, setView] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setToolState] = useState("select");
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraftState] = useState(null);
  const [plantId, setPlantId] = useState("lavanda");
  const [areaKind, setAreaKind] = useState("aiuola");
  const [lineKind, setLineKind] = useState("vialetto");
  const [saveState, setSaveState] = useState("saved");
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 800);
  const [bgDialog, setBgDialog] = useState(false);
  const [rectifySource, setRectifySource] = useState(null);
  const [stoneOpts, setStoneOpts] = useState({ w: 0.4, h: 0.4, shape: "rect", material: "pietra", rotation: 0 });
  const [pozzOpts, setPozzOpts] = useState({ w: 0.4, h: 0.4, cover: "Cemento" });
  const [pipeOpts, setPipeOpts] = useState({ content: "elettrico", diameter: 63, depth: 40 });
  const [hidden, setHiddenState] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(hiddenKey(id))) || []);
    } catch {
      return new Set();
    }
  });
  const photoInput = useRef(null);
  const photoPoint = useRef(null);

  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const planRef = useRef(null);
  const viewRef = useRef(null);
  const draftRef = useRef(null);
  const undo = useRef([]);
  const redo = useRef([]);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const dirty = useRef(false);
  const spaceDown = useRef(false);

  const setDraft = (d) => {
    draftRef.current = d;
    setDraftState(d);
  };
  selectedIdRef.current = selectedId;
  const applyView = useCallback((v) => {
    viewRef.current = v;
    setView(v);
  }, []);
  const setTool = (t) => {
    setDraft(null);
    setToolState(t);
    if (t !== "select") setSelectedId(null);
  };

  // ---------- plan state + history ----------

  const change = useCallback((next, record = true) => {
    const prev = planRef.current;
    const value = typeof next === "function" ? next(prev) : next;
    if (value === prev) return;
    if (record) {
      undo.current.push(prev);
      if (undo.current.length > 150) undo.current.shift();
      redo.current = [];
    }
    planRef.current = value;
    dirty.current = true;
    setPlan(value);
  }, []);

  // Called at the start of a drag: one undo step for the whole gesture.
  const snapshot = () => {
    undo.current.push(planRef.current);
    redo.current = [];
  };

  // Works for drawing elements and for overlay images alike (ids are unique across both).
  const updateElement = useCallback(
    (eid, patch, record = true) =>
      change((p) => {
        const apply = (e) => (e.id === eid ? { ...e, ...(typeof patch === "function" ? patch(e) : patch) } : e);
        return p.overlays.some((o) => o.id === eid) ? { ...p, overlays: p.overlays.map(apply) } : { ...p, elements: p.elements.map(apply) };
      }, record),
    [change]
  );

  const addOverlay = (o) => {
    const ov = { id: uid(), rotation: 0, hidden: false, ...o };
    change((p) => ({ ...p, overlays: [...p.overlays, ov] }));
    setSelectedId(ov.id);
    setToolState("select");
  };

  const setHidden = (next) => {
    setHiddenState(next);
    try {
      localStorage.setItem(hiddenKey(id), JSON.stringify([...next]));
    } catch {}
  };

  const addElement = (el, select = true) => {
    const e = { id: uid(), name: "", note: "", ...el };
    change((p) => ({ ...p, elements: [...p.elements, e] }));
    if (select) {
      setSelectedId(e.id);
      setToolState("select");
    }
    return e;
  };

  const removeElement = useCallback(
    (eid) => {
      change((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== eid), overlays: p.overlays.filter((o) => o.id !== eid) }));
      setSelectedId(null);
    },
    [change]
  );

  function undoRedo(from, to) {
    if (!from.current.length) return;
    to.current.push(planRef.current);
    const value = from.current.pop();
    planRef.current = value;
    dirty.current = true;
    setPlan(value);
    if (selectedId && !value.elements.some((e) => e.id === selectedId) && !value.overlays.some((o) => o.id === selectedId)) setSelectedId(null);
  }

  // ---------- load / save ----------

  useEffect(() => {
    api("plans/" + id)
      .then((p) => {
        planRef.current = p;
        setPlan(p);
      })
      .catch((err) => {
        onError(err);
        if (!(err instanceof AuthError)) go("");
      });
  }, [id, onError]);

  const save = useCallback(async () => {
    if (!dirty.current || !planRef.current) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      await api("plans/" + id, { method: "PUT", body: planRef.current });
      setSaveState(dirty.current ? "dirty" : "saved");
    } catch (err) {
      dirty.current = true;
      setSaveState("error");
      if (err instanceof AuthError) onError(err);
    }
  }, [id, onError]);

  useEffect(() => {
    if (!plan || !dirty.current) return;
    setSaveState("dirty");
    const t = setTimeout(save, 700);
    return () => clearTimeout(t);
  }, [plan, save]);

  // Flush on leave (back button, tab hidden).
  useEffect(() => {
    const flush = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      save();
    };
  }, [save]);

  useEffect(() => {
    if (!view) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(viewKey(id), JSON.stringify(view));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [view, id]);

  // ---------- viewport ----------

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [plan === null]);

  const fit = useCallback(() => {
    const p = planRef.current;
    if (!p || !size.w) return;
    const b = bounds(p.elements, p.overlays) || { minX: 0, minY: 0, maxX: 20, maxY: 15 };
    const w = Math.max(b.maxX - b.minX, 2), h = Math.max(b.maxY - b.minY, 2);
    const scale = Math.min(MAX_SCALE, Math.min(size.w / w, size.h / h) * 0.88);
    applyView({ scale, x: b.minX - (size.w / scale - w) / 2, y: b.minY - (size.h / scale - h) / 2 });
  }, [size, applyView]);

  useEffect(() => {
    if (plan && size.w && !viewRef.current) {
      const v = storedView(id);
      if (v) applyView(v);
      else fit();
    }
  }, [plan, size, id, fit, applyView]);

  const toWorld = (cx, cy) => {
    const r = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return [v.x + (cx - r.left) / v.scale, v.y + (cy - r.top) / v.scale];
  };

  const zoomAt = useCallback(
    (cx, cy, factor) => {
      const v = viewRef.current;
      const r = svgRef.current.getBoundingClientRect();
      const wx = v.x + (cx - r.left) / v.scale, wy = v.y + (cy - r.top) / v.scale;
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      applyView({ scale: s, x: wx - (cx - r.left) / s, y: wy - (cy - r.top) / s });
    },
    [applyView]
  );

  const zoomCenter = (factor) => {
    const r = svgRef.current.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  };

  // Wheel: pinch / ctrl+wheel and plain mouse wheels zoom, two-finger trackpad scroll pans.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (ev) => {
      ev.preventDefault();
      const mouseWheel = ev.deltaX === 0 && Math.abs(ev.deltaY) >= 40 && Number.isInteger(ev.deltaY);
      if (ev.ctrlKey || ev.metaKey || mouseWheel) {
        zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)));
      } else {
        const v = viewRef.current;
        applyView({ ...v, x: v.x + ev.deltaX / v.scale, y: v.y + ev.deltaY / v.scale });
      }
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [plan === null, view === null, size.w > 0, zoomAt, applyView]);

  // ---------- drawing helpers ----------

  const snapPt = (p, ev) => {
    const pl = planRef.current;
    if (!pl.snap || ev?.shiftKey) return p;
    const s = pl.snapStep;
    return p.map((c) => Math.round(c / s) * s);
  };
  const snapLen = (v, ev) => {
    const pl = planRef.current;
    return !pl.snap || ev?.shiftKey ? v : Math.max(pl.snapStep, Math.round(v / pl.snapStep) * pl.snapStep);
  };
  const find = (eid) => planRef.current.elements.find((e) => e.id === eid) || planRef.current.overlays.find((o) => o.id === eid);

  function finishPath() {
    const d = draftRef.current;
    if (!d || (d.type !== "poly" && d.type !== "line")) return;
    // Drop points that landed on top of the previous one (double-click to finish adds two).
    const minGap = 4 / viewRef.current.scale;
    const pts = d.points.filter((p, i) => i === 0 || dist(p, d.points[i - 1]) > minGap);
    setDraft(null);
    if (d.type === "poly" && pts.length >= 3) addElement({ type: "area", kind: areaKind, color: "", points: pts });
    else if (d.type === "line" && pts.length >= 2) {
      const width = { vialetto: 1, muro: 0.3, siepe: 0.8, bordura: 0.1 }[lineKind] ?? 0;
      const pipe = lineKind === "corrugato" ? pipeOpts : lineKind === "irrigazione" || lineKind === "elettrico" ? { depth: pipeOpts.depth } : {};
      addElement({ type: "line", kind: lineKind, color: "", width, points: pts, ...pipe });
    }
  }

  // The overlay being calibrated: the selected one, otherwise the top visible one.
  const calibrationTarget = () => {
    const ovs = planRef.current.overlays.filter((o) => !o.hidden);
    return ovs.find((o) => o.id === selectedIdRef.current) || ovs[ovs.length - 1];
  };

  function calibrate(points) {
    const bg = calibrationTarget();
    const measured = dist(points[0], points[1]);
    if (!bg || measured <= 0) return;
    const answer = prompt(`Hai tracciato ${measured.toFixed(2).replace(".", ",")} m su “${bg.name}”.\nQuanto è lungo davvero, in metri?`);
    const real = Number(String(answer || "").replace(",", "."));
    if (!(real > 0)) return;
    const f = real / measured;
    const [ox, oy] = points[0];
    // Scale about the first point: the centre moves, the rotation stays.
    const cx = ox + (bg.x + bg.width / 2 - ox) * f, cy = oy + (bg.y + bg.height / 2 - oy) * f;
    const w = bg.width * f, h = bg.height * f;
    updateElement(bg.id, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
    setSelectedId(bg.id);
    setToolState("select");
  }

  // ---------- pointer handling ----------

  function startPan(ev) {
    drag.current = { mode: "pan", start: [ev.clientX, ev.clientY], view: viewRef.current };
  }

  function onPointerDown(ev) {
    if (!svgRef.current) return;
    try {
      svgRef.current.setPointerCapture(ev.pointerId);
    } catch {}
    pointers.current.set(ev.pointerId, [ev.clientX, ev.clientY]);

    if (pointers.current.size === 2) {
      // Second finger: switch to pinch, undoing nothing already committed.
      const [a, b] = [...pointers.current.values()];
      drag.current = { mode: "pinch", d: dist(a, b), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      if (draftRef.current && (draftRef.current.type === "rect" || draftRef.current.type === "dim" || draftRef.current.type === "calibrate")) setDraft(null);
      return;
    }
    if (pointers.current.size > 2) return;

    if (ev.button === 1 || tool === "pan" || spaceDown.current) return startPan(ev);
    if (ev.button !== 0) return;

    const p = toWorld(ev.clientX, ev.clientY);
    const target = ev.target.closest?.("[data-handle],[data-id],[data-ov]");

    if (tool === "select") {
      if (target?.dataset.handle) {
        drag.current = { mode: "handle", id: target.dataset.owner, handle: target.dataset.handle, started: false };
        return;
      }
      const eid = target?.dataset.id;
      if (eid) {
        setSelectedId(eid);
        const el = find(eid);
        if (el.locked) return startPan(ev);
        drag.current = { mode: "move", id: eid, start: p, orig: el, started: false };
        return;
      }
      if (target?.dataset.ov) {
        // unlocked overlay image: select it and drag it around
        setSelectedId(target.dataset.ov);
        drag.current = { mode: "move", id: target.dataset.ov, start: p, orig: find(target.dataset.ov), started: false };
        return;
      }
      setSelectedId(null);
      return startPan(ev);
    }

    const s = snapPt(p, ev);
    if (tool === "rect" || tool === "dim" || tool === "calibrate") {
      setDraft({ type: tool, points: [s, s] });
      drag.current = { mode: "draw" };
      return;
    }
    if (tool === "poly" || tool === "line") {
      const d = draftRef.current;
      if (d && d.type === tool) {
        const first = d.points[0];
        if (tool === "poly" && d.points.length >= 3 && dist(first, p) * viewRef.current.scale < 12) return finishPath();
        setDraft({ ...d, points: [...d.points, s], hover: s });
      } else setDraft({ type: tool, points: [s], hover: s });
      return;
    }
    if (tool === "plant") {
      const species = plants.get(plantId);
      addElement({ type: "plant", plantId, x: s[0], y: s[1], d: species?.d || 1, color: "", planted: "" }, false);
      return;
    }
    if (tool === "stone") {
      addElement({ type: "stone", x: s[0], y: s[1], w: stoneOpts.w, h: stoneOpts.h, shape: stoneOpts.shape, material: stoneOpts.material, rotation: stoneOpts.rotation, color: "" }, false);
      return;
    }
    if (tool === "pozzetto") {
      const n = planRef.current.elements.filter((e) => e.type === "pozzetto").length + 1;
      addElement({ type: "pozzetto", name: "P" + n, x: s[0], y: s[1], w: pozzOpts.w, h: pozzOpts.h, cover: pozzOpts.cover, depth: 0, rotation: 0, color: "" });
      return;
    }
    if (tool === "photo") {
      photoPoint.current = s;
      photoInput.current?.click();
      return;
    }
    if (tool === "label") {
      const text = prompt("Testo dell'etichetta");
      if (text?.trim()) addElement({ type: "label", x: s[0], y: s[1], text: text.trim(), size: Math.max(0.2, Math.round((16 / viewRef.current.scale) * 10) / 10), color: "" });
    }
  }

  function onPointerMove(ev) {
    if (pointers.current.has(ev.pointerId)) pointers.current.set(ev.pointerId, [ev.clientX, ev.clientY]);
    const g = drag.current;

    if (g?.mode === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const v = viewRef.current;
      const panned = { ...v, x: v.x - (mid[0] - g.mid[0]) / v.scale, y: v.y - (mid[1] - g.mid[1]) / v.scale };
      viewRef.current = panned;
      zoomAt(mid[0], mid[1], d / g.d);
      g.d = d;
      g.mid = mid;
      return;
    }
    if (g?.mode === "pan") {
      const v = g.view;
      applyView({ ...v, x: v.x - (ev.clientX - g.start[0]) / v.scale, y: v.y - (ev.clientY - g.start[1]) / v.scale });
      return;
    }

    const p = toWorld(ev.clientX, ev.clientY);

    if (g?.mode === "draw") {
      const d = draftRef.current;
      if (d) setDraft({ ...d, points: [d.points[0], snapPt(p, ev)] });
      return;
    }
    if (g?.mode === "move") {
      let dx = p[0] - g.start[0], dy = p[1] - g.start[1];
      if (!g.started) {
        if (Math.hypot(dx, dy) * viewRef.current.scale < 3) return;
        g.started = true;
        snapshot();
      }
      [dx, dy] = snapPt([dx, dy], ev);
      const o = g.orig;
      updateElement(g.id, o.points ? { points: o.points.map(([x, y]) => [x + dx, y + dy]) } : { x: o.x + dx, y: o.y + dy }, false);
      return;
    }
    if (g?.mode === "handle") {
      if (!g.started) {
        g.started = true;
        snapshot();
      }
      const s = snapPt(p, ev);
      const [kind, idx] = g.handle.split(":");
      const el = find(g.id);
      if (kind === "r") {
        updateElement(g.id, { d: snapLen(2 * dist([el.x, el.y], p), ev) }, false);
      } else if (kind === "rot") {
        // Rotate around the centre; snaps to 15° steps unless Shift is held.
        const [cx, cy] = el.file ? [el.x + el.width / 2, el.y + el.height / 2] : [el.x, el.y];
        let deg = (Math.atan2(p[1] - cy, p[0] - cx) * 180) / Math.PI + 90;
        if (!ev.shiftKey) deg = Math.round(deg / 15) * 15;
        deg = ((deg + 540) % 360) - 180;
        updateElement(g.id, { rotation: Math.round(deg * 10) / 10 }, false);
      } else if (kind === "sc") {
        // Proportional scaling of an overlay around its centre.
        g.orig ||= el;
        const o = g.orig;
        const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
        const f = dist([cx, cy], p) / (Math.hypot(o.width, o.height) / 2);
        if (f > 0.01) updateElement(g.id, { x: cx - (o.width * f) / 2, y: cy - (o.height * f) / 2, width: o.width * f, height: o.height * f }, false);
      } else if (kind === "m") {
        // Dragging a midpoint inserts a new vertex there and keeps dragging it.
        const i = Number(idx) + 1;
        updateElement(g.id, (e) => ({ points: [...e.points.slice(0, i), s, ...e.points.slice(i)] }), false);
        g.handle = "v:" + i;
      } else {
        const i = Number(idx);
        updateElement(g.id, (e) => ({ points: e.points.map((q, j) => (j === i ? s : q)) }), false);
      }
      return;
    }

    const d = draftRef.current;
    if (d && (d.type === "poly" || d.type === "line")) setDraft({ ...d, hover: snapPt(p, ev) });
  }

  function onPointerUp(ev) {
    pointers.current.delete(ev.pointerId);
    const g = drag.current;
    if (g?.mode === "pinch") {
      if (pointers.current.size === 0) drag.current = null;
      else if (pointers.current.size === 1) {
        // One finger still down: keep panning with it instead of jumping.
        const [rest] = [...pointers.current.values()];
        drag.current = { mode: "pan", start: rest, view: viewRef.current };
      }
      return;
    }
    drag.current = null;
    if (g?.mode === "draw") {
      const d = draftRef.current;
      setDraft(null);
      if (!d) return;
      const [a, b] = d.points;
      const tiny = dist(a, b) * viewRef.current.scale < 6;
      if (d.type === "rect" && !tiny) {
        const [x1, x2] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
        const [y1, y2] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
        addElement({ type: "area", kind: areaKind, color: "", points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] });
      } else if (d.type === "dim" && !tiny) addElement({ type: "dim", points: [a, b] });
      else if (d.type === "calibrate" && !tiny) calibrate([a, b]);
    }
  }

  function onDoubleClick(ev) {
    const target = ev.target.closest?.("[data-handle]");
    if (target && target.dataset.handle.startsWith("v:")) {
      const i = Number(target.dataset.handle.slice(2));
      const el = find(target.dataset.owner);
      const min = el.type === "area" ? 3 : 2;
      if (el.type !== "dim" && el.points.length > min) updateElement(el.id, { points: el.points.filter((_, j) => j !== i) });
      return;
    }
    if (tool === "poly" || tool === "line") finishPath();
  }

  // ---------- keyboard ----------

  useEffect(() => {
    const typing = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    const down = (ev) => {
      if (typing(ev.target)) return;
      const mod = ev.metaKey || ev.ctrlKey;
      if (ev.key === " ") {
        spaceDown.current = true;
        ev.preventDefault();
        return;
      }
      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        ev.shiftKey ? undoRedo(redo, undo) : undoRedo(undo, redo);
        return;
      }
      if (mod && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        undoRedo(redo, undo);
        return;
      }
      if (mod && ev.key.toLowerCase() === "d" && selectedId) {
        ev.preventDefault();
        duplicate(selectedId);
        return;
      }
      if (mod) return;
      if (ev.key === "Escape") {
        if (draftRef.current) setDraft(null);
        else if (selectedId) setSelectedId(null);
        else setTool("select");
        return;
      }
      if (ev.key === "Enter") return finishPath();
      if ((ev.key === "Backspace" || ev.key === "Delete") && selectedId) {
        ev.preventDefault();
        return removeElement(selectedId);
      }
      if (ev.key.startsWith("Arrow") && selectedId) {
        ev.preventDefault();
        const step = ev.shiftKey ? 1 : 0.1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
        return updateElement(selectedId, (e) => (e.points ? { points: e.points.map(([x, y]) => [x + dx, y + dy]) } : { x: e.x + dx, y: e.y + dy }));
      }
      if ((ev.key === "[" || ev.key === "]") && selectedId) {
        const el = find(selectedId);
        if (el && "rotation" in el) {
          const step = (ev.shiftKey ? 1 : 15) * (ev.key === "[" ? -1 : 1);
          return updateElement(selectedId, { rotation: ((el.rotation + step + 540) % 360) - 180 });
        }
      }
      if (ev.key === "+" || ev.key === "=") return zoomCenter(1.25);
      if (ev.key === "-") return zoomCenter(0.8);
      if (ev.key === "0") return fit();
      const t = TOOLS.find((x) => x.key === ev.key.toLowerCase());
      if (t) setTool(t.id);
    };
    const up = (ev) => ev.key === " " && (spaceDown.current = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  function duplicate(eid) {
    const el = find(eid);
    if (!el || el.file) return;
    const off = Math.max(0.5, planRef.current.snapStep * 5);
    const copy = el.points ? { ...el, points: el.points.map(([x, y]) => [x + off, y + off]) } : { ...el, x: el.x + off, y: el.y + off };
    delete copy.id;
    addElement(copy);
  }

  function reorder(eid, toFront) {
    change((p) => {
      if (p.overlays.some((o) => o.id === eid)) {
        const ov = p.overlays.find((o) => o.id === eid);
        const rest = p.overlays.filter((o) => o.id !== eid);
        return { ...p, overlays: toFront ? [...rest, ov] : [ov, ...rest] };
      }
      const el = p.elements.find((e) => e.id === eid);
      const rest = p.elements.filter((e) => e.id !== eid);
      return { ...p, elements: toFront ? [...rest, el] : [el, ...rest] };
    });
  }

  async function doExport() {
    try {
      setSelectedId(null);
      setDraft(null);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await exportPng(svgRef.current, planRef.current);
    } catch (err) {
      alert("Esportazione non riuscita: " + err.message);
    }
  }

  if (!plan) return <div className="splash">Caricamento progetto…</div>;

  const selected = plan.elements.find((e) => e.id === selectedId) || plan.overlays.find((o) => o.id === selectedId) || null;
  const tools = plan.overlays.length ? [...TOOLS, { id: "calibrate", label: "Calibra immagine", key: "k" }] : TOOLS;

  async function addPhotoPin(ev) {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    if (!files.length || !photoPoint.current) return;
    try {
      const photos = await uploadPhotos(files);
      const [x, y] = photoPoint.current;
      addElement({ type: "photo", x, y, photos });
    } catch (err) {
      onError(err);
    }
  }

  function placeRectified(r) {
    // Put the reference rectangle in the middle of the screen; the user then aligns it.
    const v = viewRef.current;
    const cx = v.x + size.w / v.scale / 2, cy = v.y + size.h / v.scale / 2;
    const x = cx - r.refW / 2 - r.refX, y = cy - r.refH / 2 - r.refY;
    addOverlay({
      file: r.file, name: "Foto raddrizzata " + new Date().toLocaleDateString("it-IT"), x, y, width: r.width, height: r.height,
      opacity: 0.85, locked: false, source: `Riferimento ${r.refW}×${r.refH} m`, date: new Date().toISOString().slice(0, 10)
    });
    setRectifySource(null);
    setBgDialog(false);
  }
  const cursor = spaceDown.current || tool === "pan" ? "grab" : CURSORS[tool] || "crosshair";

  return (
    <div className="editor">
      <header className="topbar editor-bar">
        <button className="ghost" onClick={() => save().then(() => go(""))} title="Torna ai progetti">‹</button>
        <h1 className="plan-title">{plan.name}</h1>
        <span className={"save-state " + saveState}>
          {{ saved: "Salvato", saving: "Salvo…", dirty: "Modifiche…", error: "Errore di salvataggio" }[saveState]}
        </span>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => undoRedo(undo, redo)} disabled={!undo.current.length} title="Annulla (⌘Z)"><Icon name="undo" /></button>
        <button className="icon-btn" onClick={() => undoRedo(redo, undo)} disabled={!redo.current.length} title="Ripeti (⇧⌘Z)"><Icon name="redo" /></button>
        <button className="icon-btn hide-sm" onClick={() => zoomCenter(0.8)} title="Riduci (-)"><Icon name="minus" /></button>
        <button className="zoom-label hide-sm" onClick={fit} title="Adatta alla finestra (0)">{view ? Math.round(view.scale) : "–"} px/m</button>
        <button className="icon-btn hide-sm" onClick={() => zoomCenter(1.25)} title="Ingrandisci (+)"><Icon name="plus" /></button>
        <button className="icon-btn" onClick={fit} title="Adatta alla finestra"><Icon name="fit" /></button>
        <button className="icon-btn" onClick={doExport} title="Esporta immagine"><Icon name="download" /></button>
        <button className={"icon-btn" + (panelOpen ? " active" : "")} onClick={() => setPanelOpen((v) => !v)} title="Pannello"><Icon name="panel" /></button>
      </header>

      <div className="editor-body">
        <nav className="toolbar">
          {tools.map((t) => (
            <button key={t.id} className={"tool" + (tool === t.id ? " active" : "")} onClick={() => setTool(t.id)} title={`${t.label} (${t.key.toUpperCase()})`}>
              <Icon name={t.id} />
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="canvas-wrap" ref={wrapRef}>
          {view && size.w > 0 && (
            <PlanCanvas
              plan={plan}
              view={view}
              size={size}
              plants={plants}
              selectedId={selectedId}
              draft={draft}
              svgRef={svgRef}
              cursor={cursor}
              handlers={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick }}
              hidden={hidden}
            />
          )}
          {(tool === "poly" || tool === "line") && (
            <div className="hint">
              {draft ? (
                <>
                  Clicca per aggiungere punti · {tool === "poly" ? "clicca sul primo punto, " : ""}doppio clic o Invio per finire
                  <button className="small primary" onClick={finishPath}>Fine</button>
                  <button className="small ghost" onClick={() => setDraft(null)}>Annulla</button>
                </>
              ) : (
                "Clicca per iniziare a disegnare · Maiusc per disattivare l'aggancio"
              )}
            </div>
          )}
          {tool === "calibrate" && <div className="hint">Traccia su “{calibrationTarget()?.name}” una distanza che conosci (es. un lato della casa), poi inserisci la misura reale</div>}
          {tool === "stone" && <div className="hint">Clicca per posare piastre {stoneOpts.shape === "round" ? "Ø" + stoneOpts.w * 100 : stoneOpts.w * 100 + "×" + stoneOpts.h * 100} cm · [ ] per ruotare quella selezionata</div>}
          {tool === "pozzetto" && <div className="hint">Clicca dove si trova il pozzetto</div>}
          {tool === "photo" && <div className="hint">Clicca nel punto dove hai scattato o che la foto mostra</div>}
          <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={addPhotoPin} />
          {tool === "plant" && <div className="hint">Clicca dove vuoi mettere: {plants.get(plantId)?.name}</div>}
        </div>

        {panelOpen && (
          <Inspector
            plan={plan}
            plants={plants}
            selected={selected}
            tool={tool}
            plantId={plantId}
            setPlantId={setPlantId}
            areaKind={areaKind}
            setAreaKind={setAreaKind}
            lineKind={lineKind}
            setLineKind={setLineKind}
            change={change}
            updateElement={updateElement}
            removeElement={removeElement}
            duplicate={duplicate}
            reorder={reorder}
            openBackground={() => setBgDialog(true)}
            hidden={hidden}
            setHidden={setHidden}
            stoneOpts={stoneOpts}
            setStoneOpts={setStoneOpts}
            pozzOpts={pozzOpts}
            setPozzOpts={setPozzOpts}
            pipeOpts={pipeOpts}
            setPipeOpts={setPipeOpts}
            onRectify={(src) => setRectifySource(src)}
            onError={onError}
            startCalibrate={() => setTool("calibrate")}
            onClose={() => setPanelOpen(false)}
            onSelect={(eid) => setSelectedId(eid)}
          />
        )}
      </div>

      {bgDialog && (
        <BackgroundDialog
          plan={plan}
          view={view}
          size={size}
          onClose={() => setBgDialog(false)}
          onError={onError}
          onSet={(overlay) => {
            addOverlay(overlay);
            setBgDialog(false);
            setTimeout(fit, 0);
          }}
          onRectify={(file) => setRectifySource(file)}
        />
      )}
      {rectifySource && <PhotoRectify source={rectifySource} onClose={() => setRectifySource(null)} onDone={placeRectified} onError={onError} />}
    </div>
  );
}
