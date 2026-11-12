import { ArrowsOutCardinal, Code, Cursor, DownloadSimple, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation } from "react-router-dom";
import { breakpointFor, editableTextNode, elementSelector, layoutCSS, readRules, resizeEdge, ruleKey, STORAGE_KEY, textEditsJSON, updateRule, type LayoutRule, type ResizeEdge } from "./layout";
import "./editor.css";

type Drag = { id: number; kind: "move" | ResizeEdge; startX: number; startY: number; base: LayoutRule; width: number; height: number; before: LayoutRule[] };

export default function LayoutEditor() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(true);
  const [rules, setRules] = useState<LayoutRule[]>(readRules);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState(window.innerWidth);
  const [message, setMessage] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [past, setPast] = useState<LayoutRule[][]>([]);
  const [future, setFuture] = useState<LayoutRule[][]>([]);
  const drag = useRef<Drag | null>(null);
  const latestRules = useRef(rules);
  const originalTexts = useRef(new WeakMap<Text, { original: string; value: string }>());
  latestRules.current = rules;
  const breakpoint = breakpointFor(viewport);
  const selector = selected?.isConnected ? elementSelector(selected) : "";
  const key = ruleKey({ page: pathname, breakpoint, selector });
  const saved = rules.find((rule) => ruleKey(rule) === key);
  const base: LayoutRule = saved ?? { page: pathname, breakpoint, selector, x: 0, y: 0, inline: selected?.isConnected && getComputedStyle(selected).display === "inline" ? true : undefined };
  const textNode = selected?.isConnected ? editableTextNode(selected) : null;
  const originalText = textNode ? originalTexts.current.get(textNode) : undefined;
  const currentText = saved?.text?.value ?? (textNode ? originalText && textNode.data === originalText.value ? originalText.original : textNode.data : "");
  useEffect(() => { setTextDraft(currentText); }, [selected, currentText]);

  function commit(next: LayoutRule[]) {
    setPast((previous) => [...previous.slice(-49), rules]);
    setFuture([]);
    setRules(next);
  }
  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((next) => [...next, rules]);
    setPast(past.slice(0, -1));
    setRules(previous);
  }
  function redo() {
    const next = future.at(-1);
    if (!next) return;
    setPast((previous) => [...previous, rules]);
    setFuture(future.slice(0, -1));
    setRules(next);
  }

  useEffect(() => {
    if (!open && !editing && !past.length && !future.length) return;
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || drag.current) return;
      const target = event.target instanceof Element ? event.target : null;
      // Keep native undo while typing; applied editor changes use the shared history.
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && !(key === "y" && event.ctrlKey)) return;
      event.preventDefault();
      if (event.shiftKey || key === "y") redo(); else undo();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [open, editing, past, future, rules]);

  useEffect(() => {
    if (!preview) return;
    const applied = new Map<Text, { original: string; value: string }>();
    const apply = () => {
      for (const rule of rules) {
        if (!rule.text || rule.page !== pathname || rule.breakpoint !== breakpoint) continue;
        let elements: NodeListOf<HTMLElement>;
        try { elements = document.querySelectorAll<HTMLElement>(rule.selector); } catch { continue; }
        for (const element of elements) {
          if (element.closest("[data-layout-editor], .mock-toolbar")) continue;
          const node = editableTextNode(element);
          if (!node || node.data !== rule.text.original || node.data === rule.text.value) continue;
          applied.set(node, { original: node.data, value: rule.text.value });
          originalTexts.current.set(node, { original: node.data, value: rule.text.value });
          node.data = rule.text.value;
        }
      }
    };
    const observer = new MutationObserver(apply);
    const root = document.getElementById("root");
    if (root) observer.observe(root, { subtree: true, childList: true, characterData: true });
    apply();
    return () => {
      observer.disconnect();
      for (const [node, text] of applied) {
        if (node.data === text.value) node.data = text.original;
      }
    };
  }, [rules, preview, pathname, breakpoint]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rules)); }
    catch { setMessage("Browser storage is unavailable. Export CSS to keep your changes."); }
  }, [rules]);
  useEffect(() => { setSelected(null); setRect(null); drag.current = null; }, [pathname, breakpoint]);
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!editing) return;
    const select = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest("[data-layout-editor], [data-developer-controls], .mock-toolbar")) return;
      const element = target instanceof HTMLElement ? target : target.closest<HTMLElement>("button, a, div, span, section");
      if (!element || !document.getElementById("root")?.contains(element)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSelected(element);
      setMessage("");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setEditing(false); setSelected(null); }
    };
    // Block native controls and pointer handlers as well as click actions during selection.
    document.addEventListener("pointerdown", select, true);
    document.addEventListener("click", select, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", select, true); document.removeEventListener("click", select, true); document.removeEventListener("keydown", escape); };
  }, [editing]);
  useEffect(() => {
    if (!selected || !editing) { setRect(null); return; }
    let frame: number;
    // Follow scrolling, responsive reflow and chart/content updates without modifying app DOM.
    const refresh = () => {
      if (!selected.isConnected) { setSelected(null); setRect(null); return; }
      const next = selected.getBoundingClientRect();
      setRect((previous) => previous && ["x", "y", "width", "height"].every((field) => previous[field as keyof DOMRect] === next[field as keyof DOMRect]) ? previous : next);
      frame = requestAnimationFrame(refresh);
    };
    refresh();
    return () => cancelAnimationFrame(frame);
  }, [selected, editing]);

  function start(event: ReactPointerEvent<HTMLButtonElement>, kind: Drag["kind"]) {
    if (event.button !== 0 || !selected) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = selected.getBoundingClientRect();
    drag.current = { id: event.pointerId, kind, startX: event.clientX, startY: event.clientY, base, width: box.width, height: box.height, before: rules };
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = Math.round(event.clientX - current.startX), dy = Math.round(event.clientY - current.startY);
    const next = current.kind === "move" ? { ...current.base, x: current.base.x + dx, y: current.base.y + dy } : resizeEdge(current.base, current.kind, current.width, current.height, dx, dy);
    setRules(updateRule(current.before, next));
  }
  function finish(cancel = false) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (cancel) setRules(current.before);
    else if (JSON.stringify(latestRules.current) !== JSON.stringify(current.before)) {
      setPast((previous) => [...previous.slice(-49), current.before]);
      setFuture([]);
    }
  }
  function exportCSS() {
    const css = `/* Frostpoint layout overrides. Import this file after app.css.\n * Page + viewport scoped. Review at mobile, tablet and desktop widths.\n * Structural selectors can change when markup or list order changes.\n * For permanent edits, add data-ui-id hooks or apply values to component CSS.\n */\n\n${layoutCSS(rules)}\n`;
    const url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "layout-overrides.css";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Exported layout-overrides.css. Import it after app.css in src/main.tsx to apply it.");
  }
  function exportText() {
    const url = URL.createObjectURL(new Blob([textEditsJSON(rules)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "text-edits.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Exported text-edits.json. Apply the replacements in the source components or their data source; CSS cannot change text.");
  }

  return <>
    {preview && <style>{layoutCSS(rules)}</style>}
    {!open ? <button data-layout-editor className="layout-launch" type="button" onClick={() => setOpen(true)}><Code size={18} aria-hidden="true" /> UI editor{editing ? " · Selecting" : ""}</button> : <aside data-layout-editor className="layout-editor" aria-label="Developer layout editor">
      <div className="layout-editor-heading"><strong><Code size={19} aria-hidden="true" /> UI editor</strong><button type="button" className="btn icon sm" aria-label="Minimize UI editor" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <p>Local development</p>
      <div className="layout-editor-actions"><button type="button" className={`btn ${editing ? "primary" : ""}`} aria-pressed={editing} onClick={() => { setEditing(!editing); setPreview(true); }}><Cursor size={17} />{editing ? "Selecting elements" : "Select element"}</button><button type="button" className="btn" aria-pressed={preview} onClick={() => { setPreview(!preview); setEditing(false); }}>{preview ? "Show original" : "Show edits"}</button></div>
      <small>Enable selection, then click any element. Drag Move to reposition it, or drag one of the four edge handles to resize that side. Turn selection off to use the app. Escape exits selection.</small>
      <div className="layout-editor-scope"><strong>{breakpoint} · {viewport}px</strong><span>{pathname}</span></div>
      {selected?.isConnected ? <>
        <label className="layout-selector">Selected element<code>{selector}</code></label>
        {textNode || saved?.text ? <div className="layout-text-edit"><label>Text content<textarea className="input" value={textDraft} disabled={!preview} onChange={(event) => setTextDraft(event.target.value)} rows={3} /></label><button type="button" className="btn sm" disabled={!preview || textDraft === currentText || !textDraft.trim()} onClick={() => commit(updateRule(rules, { ...base, text: { original: saved?.text?.original ?? textNode!.data, value: textDraft } }))}>Apply text</button><small>Edits the selected text only. Export text changes separately to apply them in source.</small></div> : <small>To edit text, select its label or heading directly. Containers with multiple text nodes and form values are not edited.</small>}
        <div className="layout-editor-fields">
          {(["x", "y", "width", "height"] as const).map((field) => <label key={`${key}-${field}`}>{({ x: "Move X", y: "Move Y", width: "Width", height: "Height" })[field]} (px)<input className="input" type="number" min={field === "width" || field === "height" ? 16 : undefined} key={`${key}-${field}-${base[field] ?? "auto"}`} defaultValue={base[field] ?? ""} placeholder="Auto" disabled={!preview} onBlur={(event) => {
            const raw = event.currentTarget.value;
            const value = raw === "" ? undefined : Math.round(Number(raw));
            if (raw !== "" && (!Number.isFinite(value) || ((field === "width" || field === "height") && value! < 16))) { event.currentTarget.value = String(base[field] ?? ""); return; }
            const next = { ...base, [field]: value ?? (field === "x" || field === "y" ? 0 : undefined) };
            if (next[field] !== base[field]) commit(updateRule(rules, next));
          }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>)}
        </div>
        <button type="button" className="btn sm" disabled={!saved} onClick={() => commit(rules.filter((rule) => ruleKey(rule) !== key))}>Reset element</button>
      </> : <div className="layout-editor-empty">{editing ? "Click an element on the page to begin." : "Select an element to adjust its position and size."}</div>}
      <div className="layout-editor-actions"><button type="button" className="btn sm" title="Undo (Ctrl+Z)" disabled={!past.length} onClick={undo}>Undo</button><button type="button" className="btn sm" title="Redo (Ctrl+Shift+Z or Ctrl+Y)" disabled={!future.length} onClick={redo}>Redo</button><button type="button" className="btn sm" disabled={!rules.some((rule) => rule.page === pathname && rule.breakpoint === breakpoint)} onClick={() => commit(rules.filter((rule) => rule.page !== pathname || rule.breakpoint !== breakpoint))}>Reset view</button></div>
      <small>Ctrl+Z undoes applied edits. Ctrl+Shift+Z / Ctrl+Y redoes them. While typing, Ctrl+Z keeps the field's normal undo.</small>
      <button type="button" className="btn primary" disabled={!rules.length} onClick={exportCSS}><DownloadSimple size={18} /> Export CSS ({rules.length})</button>
      <button type="button" className="btn" disabled={!rules.some((rule) => rule.text)} onClick={exportText}><DownloadSimple size={18} /> Export text edits</button>
      <small>Edits save in this browser. Export and import the CSS into the project to include them in deployment. Moving changes visual position; resizing changes layout.</small>
      {message && <p role="status" className="layout-editor-message">{message}</p>}
    </aside>}
    {editing && preview && rect && <div data-layout-editor className="layout-selection" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      <button type="button" className="layout-move" aria-label="Move selected element" title="Drag to move" onPointerDown={(event) => start(event, "move")} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish()}><ArrowsOutCardinal size={16} /> Move</button>
      {(["top", "right", "bottom", "left"] as const).map((edge) => <button key={edge} type="button" className={`layout-resize layout-resize-${edge}`} aria-label={`Resize ${edge} edge`} title={`Drag to resize ${edge} edge`} onPointerDown={(event) => start(event, edge)} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish()} />)}
    </div>}
  </>;
}
