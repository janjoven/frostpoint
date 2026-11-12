export type Breakpoint = "mobile" | "tablet" | "desktop";
export type LayoutRule = {
  page: string;
  breakpoint: Breakpoint;
  selector: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  inline?: boolean;
  text?: { original: string; value: string };
};
export const STORAGE_KEY = "fp-layout-editor-v1";
const queries: Record<Breakpoint, string> = {
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px)",
};
export const breakpointFor = (width: number): Breakpoint => width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
export type ResizeEdge = "top" | "right" | "bottom" | "left";
export function resizeEdge(base: LayoutRule, edge: ResizeEdge, width: number, height: number, dx: number, dy: number): LayoutRule {
  if (edge === "right") return { ...base, width: Math.max(16, Math.round(width + dx)) };
  if (edge === "bottom") return { ...base, height: Math.max(16, Math.round(height + dy)) };
  if (edge === "left") {
    const next = Math.max(16, Math.round(width - dx));
    return { ...base, width: next, x: base.x + width - next };
  }
  const next = Math.max(16, Math.round(height - dy));
  return { ...base, height: next, y: base.y + height - next };
}
export const ruleKey = (rule: Pick<LayoutRule, "page" | "breakpoint" | "selector">) => JSON.stringify([rule.page, rule.breakpoint, rule.selector]);

export function updateRule(rules: LayoutRule[], next: LayoutRule) {
  return [...rules.filter((rule) => ruleKey(rule) !== ruleKey(next)), next];
}

export function layoutCSS(rules: LayoutRule[]) {
  return rules.map((rule) => {
    const declarations = [`translate: ${rule.x}px ${rule.y}px !important;`];
    if (rule.inline) declarations.push("display: inline-block !important;");
    if (rule.width !== undefined) declarations.push(`width: ${rule.width}px !important;`, "max-width: none !important;", "box-sizing: border-box !important;");
    if (rule.height !== undefined) declarations.push(`height: ${rule.height}px !important;`, "box-sizing: border-box !important;");
    return `@media ${queries[rule.breakpoint]} {\n  html[data-ui-page=${JSON.stringify(rule.page)}] ${rule.selector} {\n    ${declarations.join("\n    ")}\n  }\n}`;
  }).join("\n\n");
}

export function readRules(): LayoutRule[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((rule): rule is LayoutRule => rule && typeof rule.page === "string" && typeof rule.selector === "string" && Object.hasOwn(queries, rule.breakpoint) && Number.isFinite(rule.x) && Number.isFinite(rule.y) && (rule.width === undefined || Number.isFinite(rule.width) && rule.width >= 16) && (rule.height === undefined || Number.isFinite(rule.height) && rule.height >= 16) && (rule.text === undefined || rule.text && typeof rule.text.original === "string" && typeof rule.text.value === "string"));
  } catch { return []; }
}

/** Edit a single direct text node, preserving nested icons, controls and React-owned nodes. */
export function editableTextNode(element: HTMLElement): Text | null {
  if (element.matches("input, textarea, select, option, script, style, [contenteditable]")) return null;
  const nodes = Array.from(element.childNodes).filter((node): node is Text => node.nodeType === 3 && !!node.textContent?.trim());
  return nodes.length === 1 ? nodes[0] : null;
}

export function textEditsJSON(rules: LayoutRule[]) {
  return JSON.stringify({
    version: 1,
    instructions: "Apply these text replacements in the source components or their data source. CSS export contains layout only. Selectors identify preview elements, not source file locations.",
    edits: rules.filter((rule) => rule.text).map(({ page, breakpoint, selector, text }) => ({ page, breakpoint, selector, original: text!.original, replacement: text!.value })),
  }, null, 2);
}

/** Prefer explicit, stable hooks; fall back to a structural selector for any element. */
export function elementSelector(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current.id !== "root") {
    const hook = current.dataset.uiId;
    if (hook) { parts.unshift(`[data-ui-id=${JSON.stringify(hook)}]`); break; }
    if (current.id) { parts.unshift(`#${CSS.escape(current.id)}`); break; }
    const tag = current.tagName.toLowerCase();
    const siblings = Array.from(current.parentElement?.children ?? []).filter((sibling) => sibling.tagName === current!.tagName);
    parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
    current = current.parentElement;
  }
  if (current?.id === "root") parts.unshift("#root");
  return parts.join(" > ");
}
