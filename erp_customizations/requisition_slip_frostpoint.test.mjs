import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";

const script = readFileSync(new URL("./requisition_slip_frostpoint.js", import.meta.url), "utf8");
function fixture(initial = "") {
  const state = { value: initial, previousOnloadCalls: 0, refreshes: 0, labels: 0, accsysChecked: initial === "ACS-RS-%" };
  const checkbox = { checked: false, events: {}, prop(key, value) { if (arguments.length === 1) return this[key]; this[key] = value; return this; }, on(key, fn) { this.events[key] = fn; } };
  const id = { df: { onchange() { state.accsysChecked = state.value === "ACS-RS-%"; } }, get_value() { return state.value; }, async set_value(value) { state.value = value; this.df.onchange(); } };
  const listview = { page: { fields_dict: { name: id } }, filter_area: { standard_filters_wrapper: {} }, start: 25, refresh() { state.refreshes++; } };
  const frappe = { listview_settings: { "Requisition Slip": { onload() { state.previousOnloadCalls++; } } } };
  const $ = () => { state.labels++; return { appendTo() { return this; }, find() { return checkbox; } }; };
  vm.runInNewContext(script, { frappe, $ });
  const load = () => frappe.listview_settings["Requisition Slip"].onload(listview);
  load();
  return { state, checkbox, id, listview, load };
}

test("FROSTPOINT filters FRP IDs and restores the previous search", async () => {
  const f = fixture("RS-2026");
  f.checkbox.prop("checked", true);
  await f.checkbox.events.change();
  assert.equal(f.state.value, "FRP-%");
  assert.equal(f.listview.start, 0);
  f.checkbox.prop("checked", false);
  await f.checkbox.events.change();
  assert.equal(f.state.value, "RS-2026");
});

test("existing ACCSYS ID-change handler remains synchronized", async () => {
  const f = fixture("ACS-RS-%");
  f.checkbox.prop("checked", true);
  await f.checkbox.events.change();
  assert.equal(f.state.accsysChecked, false);
  f.checkbox.prop("checked", false);
  await f.checkbox.events.change();
  assert.equal(f.state.accsysChecked, true);
  assert.equal(f.state.previousOnloadCalls, 1);
});

test("manual filter edits and repeated loading do not duplicate controls", async () => {
  const f = fixture("FRP-%");
  assert.equal(f.checkbox.checked, true);
  await f.id.set_value("");
  assert.equal(f.checkbox.checked, false);
  f.load();
  assert.equal(f.state.labels, 1);
});
