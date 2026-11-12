import { useQueryClient } from "@tanstack/react-query";
import { DotsSixVertical } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { homePath, useAuth, useCart } from "../store";
import { mockRoles, resetMocks, switchMockRole, type MockRole } from "./api";
import { keepOnScreen, type Position } from "./position";

const POSITION_KEY = "fp-mock-toolbar-position";
function savedPosition(): Position | null {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null");
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
  } catch { /* storage unavailable */ }
  return null;
}

export default function MockToolbar() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const nav = useNavigate();
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const [position, setPosition] = useState<Position | null>(savedPosition);
  const [dragging, setDragging] = useState(false);
  const constrain = (point: Position) => keepOnScreen(point, { width: window.innerWidth, height: window.innerHeight }, panel.current!.getBoundingClientRect());

  useEffect(() => {
    const fit = () => {
      const rect = panel.current!.getBoundingClientRect();
      setPosition((previous) => {
        const next = keepOnScreen(previous ?? { x: rect.left, y: rect.top }, { width: window.innerWidth, height: window.innerHeight }, rect);
        return previous?.x === next.x && previous.y === next.y ? previous : next;
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(panel.current!);
    window.addEventListener("resize", fit);
    fit();
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, []);
  useEffect(() => {
    if (!position || dragging) return;
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* storage unavailable */ }
  }, [position, dragging]);

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    const rect = panel.current!.getBoundingClientRect();
    drag.current = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
    event.preventDefault();
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    setPosition(constrain({ x: event.clientX - active.dx, y: event.clientY - active.dy }));
  }
  function endDrag() { drag.current = null; setDragging(false); }
  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 40 : 16;
    const delta: Record<string, Position> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    if (!delta[event.key]) return;
    event.preventDefault();
    const rect = panel.current!.getBoundingClientRect();
    setPosition(constrain({ x: rect.left + delta[event.key].x, y: rect.top + delta[event.key].y }));
  }
  async function select(role: MockRole, reset = false) {
    await qc.cancelQueries();
    if (reset) resetMocks();
    const next = switchMockRole(role);
    useCart.getState().clear();
    qc.clear();
    useAuth.getState().setUser(next);
    nav(homePath(next));
  }
  return (
    <aside ref={panel} className={`mock-toolbar${dragging ? " is-dragging" : ""}`} aria-label="Mock preview controls" style={position ? { left: position.x, top: position.y, bottom: "auto" } : undefined}>
      <button type="button" className="mock-drag-handle" aria-label="Move mock controls: drag or use arrow keys" title="Drag to move · Arrow keys to reposition" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={moveWithKeys}><DotsSixVertical size={20} aria-hidden="true" /></button>
    <details className="mock-panel">
      <summary>Mock mode · {user?.role ?? "guest"}</summary>
      <div className="mock-controls">
      <span>Sample data · saved in this browser</span>
      <label>Preview as <select value={user?.role ?? "guest"} onChange={(e) => void select(e.target.value as MockRole)}>
        {mockRoles.map((role) => <option key={role} value={role}>{role === "guest" ? "Guest / login" : role[0].toUpperCase() + role.slice(1)}</option>)}
      </select></label>
      <button type="button" onClick={() => void select("customer", true)}>Reset demo</button>
      </div>
    </details>
    </aside>
  );
}
