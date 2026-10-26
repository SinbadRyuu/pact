import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDraft, emptyDraft, formatEntry, parseEntry, progressLabel } from "./signal";

test("parseEntry reads single prices and zones", () => {
  assert.deepEqual(parseEntry("4115.5"), { from: 4115.5, to: null });
  assert.deepEqual(parseEntry("4115.5 - 4112"), { from: 4115.5, to: 4112 });
  assert.deepEqual(parseEntry("4115.5-4112"), { from: 4115.5, to: 4112 });
  assert.deepEqual(parseEntry("4,115.5 – 4,112"), { from: 4115.5, to: 4112 });
  assert.deepEqual(parseEntry("4115 to 4112"), { from: 4115, to: 4112 });
  assert.deepEqual(parseEntry("4112 - 4112"), { from: 4112, to: null });
  // Half-typed zone (after pressing the "-" button) is not accepted until the second price is in.
  assert.equal(parseEntry("4115 - "), null);
});

test("parseEntry rejects junk", () => {
  assert.equal(parseEntry(""), null);
  assert.equal(parseEntry("abc"), null);
  assert.equal(parseEntry("1 - 2 - 3"), null);
  assert.equal(parseEntry("-5"), null);
});

const filled = () => ({
  ...emptyDraft("vt-capital"),
  direction: "SELL" as const,
  entry: "4115.5 - 4112",
  takeProfits: ["4105", "4100", "4095", "", "", ""],
  stopLoss: "4120",
});

test("a full sell passes with no warnings", () => {
  const r = checkDraft(filled());
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.signal?.takeProfits, [4105, 4100, 4095]);
  assert.equal(r.signal?.entryFrom, 4115.5);
  assert.equal(r.signal?.entryTo, 4112);
  assert.equal(r.signal?.notes, null);
});

test("entry, TP1 and stop loss are required", () => {
  const r = checkDraft(emptyDraft("vt-capital"));
  assert.ok(r.errors.entry);
  assert.ok(r.errors.tp1);
  assert.ok(r.errors.stopLoss);
  assert.equal(r.errors.tp2, undefined);
  assert.equal(r.signal, null);
});

test("optional TPs can be skipped and are compacted in order", () => {
  const d = filled();
  d.takeProfits = ["4105", "", "4095", "", "4090", ""];
  assert.deepEqual(checkDraft(d).signal?.takeProfits, [4105, 4095, 4090]);
});

test("wrong-side levels warn but still post", () => {
  const d = { ...filled(), takeProfits: ["4120", "4130", "4145", "4150", "", ""], stopLoss: "4105" };
  const r = checkDraft(d);
  assert.equal(r.warnings.length, 2);
  assert.ok(r.signal);
});

test("formatting", () => {
  assert.equal(formatEntry({ entryFrom: 4121, entryTo: 4118 }), "4,118 – 4,121");
  assert.equal(formatEntry({ entryFrom: 4115.5, entryTo: null }), "4,115.5");
  assert.equal(progressLabel({ status: "active", targetsHit: 1, takeProfits: [1, 2, 3] }), "Target 1 hit");
  assert.equal(progressLabel({ status: "take_profit", targetsHit: 3, takeProfits: [1, 2, 3] }), "All targets hit");
  assert.equal(progressLabel({ status: "stop_loss", targetsHit: 0, takeProfits: [1] }), "Stopped out");
});
