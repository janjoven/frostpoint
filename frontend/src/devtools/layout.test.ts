import { afterEach, describe, expect, it, vi } from "vitest";
import { breakpointFor, editableTextNode, layoutCSS, readRules, resizeEdge, textEditsJSON, updateRule, type LayoutRule } from "./layout";

const rule: LayoutRule = { page: "/admin/", breakpoint: "desktop", selector: '[data-ui-id="dashboard-hero"]', x: 12, y: -4, width: 600 };
afterEach(() => vi.unstubAllGlobals());

describe("layout export", () => {
  it("resizes horizontal edges without setting the automatic height", () => {
    expect(resizeEdge(rule, "right", 600, 200, 40, 99)).toEqual({ ...rule, width: 640 });
    const left = resizeEdge(rule, "left", 600, 200, 40, 99);
    expect(left).toEqual({ ...rule, x: 52, width: 560 });
    expect(left.x + left.width!).toBe(rule.x + 600);
    expect(left.height).toBeUndefined();
  });
  it("resizes vertical edges without changing width and keeps the opposite edge anchored", () => {
    expect(resizeEdge(rule, "bottom", 600, 200, 99, 30)).toEqual({ ...rule, height: 230 });
    const top = resizeEdge(rule, "top", 600, 200, 99, 30);
    expect(top).toEqual({ ...rule, y: 26, height: 170 });
    expect(top.y + top.height!).toBe(rule.y + 200);
  });
  it("keeps the opposite edge in place when a resize reaches its minimum", () => {
    const left = resizeEdge(rule, "left", 600, 200, 900, 0);
    expect(left.width).toBe(16);
    expect(left.x + left.width!).toBe(rule.x + 600);
    const top = resizeEdge(rule, "top", 600, 200, 0, 900);
    expect(top.height).toBe(16);
    expect(top.y + top.height!).toBe(rule.y + 200);
  });
  it("exports text as source replacement data, separately from layout CSS", () => {
    const edited = { ...rule, text: { original: "My orders", value: "Your orders" } };
    const data = JSON.parse(textEditsJSON([edited, { ...rule, selector: "#other" }]));
    expect(data.edits).toEqual([{ page: rule.page, breakpoint: rule.breakpoint, selector: rule.selector, original: "My orders", replacement: "Your orders" }]);
    expect(layoutCSS([edited])).not.toContain("Your orders");
  });
  it("targets a direct text node without replacing icons or nested child elements", () => {
    const text = { nodeType: 3, textContent: " Add to cart" };
    const icon = { nodeType: 1, textContent: "" };
    const element = { matches: () => false, childNodes: [icon, text] } as unknown as HTMLElement;
    expect(editableTextNode(element)).toBe(text);
    expect(editableTextNode({ ...element, childNodes: [text, { nodeType: 3, textContent: "Another label" }] } as unknown as HTMLElement)).toBeNull();
    expect(editableTextNode({ matches: () => true } as unknown as HTMLElement)).toBeNull();
  });
  it("scopes overrides to their page and viewport, without fixing an automatic height", () => {
    const css = layoutCSS([rule]);
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('html[data-ui-page="/admin/"] [data-ui-id="dashboard-hero"]');
    expect(css).toContain("translate: 12px -4px !important;");
    expect(css).toContain("width: 600px !important;");
    expect(css).not.toContain("height:");
  });
  it("updates only the matching element, page and viewport", () => {
    const mobile = { ...rule, breakpoint: "mobile" as const, width: 300 };
    const anotherPage = { ...rule, page: "/admin/orders" };
    const result = updateRule([rule, mobile, anotherPage], { ...rule, x: 40 });
    expect(result).toHaveLength(3);
    expect(result).toContainEqual(mobile);
    expect(result).toContainEqual(anotherPage);
    expect(result).toContainEqual({ ...rule, x: 40 });
  });
  it("uses separate responsive ranges", () => {
    expect([767, 768, 1023, 1024].map(breakpointFor)).toEqual(["mobile", "tablet", "tablet", "desktop"]);
  });
  it("ignores malformed saved overrides and tolerates unavailable storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify([rule, { ...rule, x: null }, { ...rule, breakpoint: "unknown" }, { ...rule, height: -1 }]) });
    expect(readRules()).toEqual([rule]);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Unavailable"); } });
    expect(readRules()).toEqual([]);
  });
});
