// A donut's centre words and its highlighted slice: the two display-only fields a lifecycle wheel needs. They belong
// to pie and donut; every other kind ignores them. Drawn through the normal path (stored JSON → readBlocks → Blocks).
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { drawWithActions as draw } from "../../core/testing";
import { readBlocks } from "../../core/readBlocks";
import type { ChartBlock } from "./read";

beforeEach(() => pinLocale("en-US"));
afterEach(cleanup);

const chart = (raw: object) => (readBlocks([{ type: "chart", ...raw }]) as ChartBlock[])[0].spec;
const DONUT = { kind: "donut", x: ["PLAN", "TRACK", "IMPLEMENT"], series: [{ name: "Lifecycle", data: [4, 0, 6] }] };

describe("chart: a donut's centre words", () => {
  it("reads {label, value} for a donut and a pie", () => {
    expect(chart({ ...DONUT, center: { label: "PLAN", value: "smooth" } }).center).toEqual({ label: "PLAN", value: "smooth" });
    expect(chart({ ...DONUT, kind: "pie", center: { label: "PLAN", value: "smooth" } }).center)
      .toEqual({ label: "PLAN", value: "smooth" });
  });

  it("ignores centre words on every other kind", () => {
    const bar = chart({ kind: "bar", x: ["Q1", "Q2"], series: [{ data: [1, 2] }], center: { label: "PLAN", value: "smooth" } });
    expect("center" in bar).toBe(false);
  });

  it("draws the model's words in the hole instead of the total", () => {
    const { container } = draw([{ type: "chart", ...DONUT, center: { label: "PLAN", value: "smooth" } }]);
    expect(container.querySelector(".hb-pie-total")!.textContent).toBe("smooth");
    expect(container.querySelector(".hb-pie-svg")!.textContent).toContain("PLAN");
    expect(container.querySelector(".hb-pie-svg")!.textContent).not.toContain("Total");
  });

  it("keeps the drawing's own headline when the model gave no centre words", () => {
    const { container } = draw([{ type: "chart", ...DONUT }]);
    expect(container.querySelector(".hb-pie-svg")!.textContent).toContain("Total");
  });
});

describe("chart: a donut's highlight", () => {
  it("reads an index into the x the model wrote, even after an empty slice is dropped", () => {
    // TRACK (index 1) has no positive value, so the drawn slices are PLAN, IMPLEMENT; highlight 2 still means IMPLEMENT.
    expect(chart({ ...DONUT, highlight: 2 }).highlight).toBe(1);
    expect(chart({ ...DONUT, highlight: 0 }).highlight).toBe(0);
  });

  it("ignores a highlight that is not an index into x, or belongs to another kind", () => {
    for (const bad of [3, -1, "1", 1.5, true]) expect("highlight" in chart({ ...DONUT, highlight: bad })).toBe(false);
    const bar = chart({ kind: "bar", x: ["Q1", "Q2"], series: [{ data: [1, 2] }], highlight: 0 });
    expect("highlight" in bar).toBe(false);
  });

  it("keeps the highlighted slice lit and fades the rest at rest", () => {
    // highlight 2 is IMPLEMENT, which is the second slice drawn (TRACK had no value and was dropped).
    const { container } = draw([{ type: "chart", ...DONUT, highlight: 2 }]);
    const slices = [...container.querySelectorAll(".hb-slice")];
    expect(slices.map((s) => s.getAttribute("opacity"))).toEqual(["0.55", "1"]);
  });

  it("leaves every slice lit when nothing is highlighted", () => {
    const { container } = draw([{ type: "chart", ...DONUT }]);
    expect([...container.querySelectorAll(".hb-slice")].map((s) => s.getAttribute("opacity"))).toEqual(["1", "1"]);
  });
});
