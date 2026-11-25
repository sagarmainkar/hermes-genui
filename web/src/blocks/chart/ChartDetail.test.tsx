// The drill-down: a click (or Enter) on a picked column, point, slice or row opens a focused detail of that datum —
// one dialog, mounted beside the chart, while the chart itself is NEVER re-mounted behind it. These tests hold that
// line: node identity, the kept pick, the aria shape and the returns (Escape, the close control, the scrim).
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pinLocale } from "../../lib/locale.testing";
import { readBlocks } from "../../core/readBlocks";
import type { ChartBlock } from "./read";
import { Blocks } from "../../core/Blocks";
import { ChartDetail, KIND_WORDS, type Detail } from "./ChartDetail";
import { isTopLayer, popLayer, pushLayer } from "../../core/overlays";

beforeEach(() => pinLocale("en-US"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const chart = (raw: object) => readBlocks([{ type: "chart", ...raw }]) as ChartBlock[];

const revenue = () => chart({ kind: "bar", title: "Monthly sales", source: "company ledger", unit: "$",
  x: ["Feb", "Mar", "Apr"], series: [{ name: "Revenue", data: [1, 42000, 1] }, { name: "Units", data: [2, 310, 2] }] });

/** Make jsdom measure the svg like a real drawing so pointer picks work (the layout width stays 560). */
function layoutLikeChrome(svg: Element, height = 210) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    width: 560, height, left: 0, top: 0, right: 560, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
}

/** Where the picked column's centre sits, read back from the x labels the drawing itself wrote. */
function labelX(container: HTMLElement, label: string): number {
  const text = [...container.querySelectorAll("text.hb-chart-axis")].find((t) => t.textContent === label)!;
  return Number(text.getAttribute("x"));
}

const sample: Detail = {
  datum: "March", chartTitle: "Monthly sales", kind: "Column",
  rows: [{ colour: "var(--hb-chart-1)", name: "Revenue", value: "$42,000" }],
  note: "25% of the quarter", source: "company ledger",
};

describe("the detail dialog itself", () => {
  it("says the datum, its kind and title, each row, the note and the source", () => {
    const { container } = render(<ChartDetail detail={sample} onClose={() => {}} />);
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail")!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Chart details: March");
    expect(dialog.querySelector(".hb-chart-detail-where")!.textContent).toBe("Column · Monthly sales");
    expect(dialog.querySelector(".hb-chart-detail-title")!.textContent).toBe("March");
    const row = dialog.querySelector(".hb-detail-row")!;
    expect(row.querySelector(".hb-detail-name")!.textContent).toBe("Revenue");
    expect(row.querySelector(".hb-detail-value")!.textContent).toBe("$42,000");
    expect(dialog.querySelector(".hb-detail-note")!.textContent).toBe("25% of the quarter");
    expect(dialog.querySelector(".hb-detail-source")!.textContent).toBe("company ledger");
  });

  it("owns the keyboard from its first frame: focus is on the close control", () => {
    const { container } = render(<ChartDetail detail={sample} onClose={() => {}} />);
    const close = container.querySelector<HTMLButtonElement>(".hb-overlay-close")!;
    expect(document.activeElement).toBe(close);
    expect(close.getAttribute("aria-label")).toBe("Close chart details");
  });

  it("Escape closes it, and Tab cannot leave it", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartDetail detail={sample} onClose={onClose} />);
    const close = container.querySelector(".hb-overlay-close")!;
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(close);  // the trap holds: the close control is the only stop
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("a click on the scrim closes; a click on the card does not", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartDetail detail={sample} onClose={onClose} />);
    fireEvent.click(container.querySelector(".hb-chart-detail-card")!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".hb-chart-detail")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("while it is up it is the top overlay; a layer opened over it takes the key, and when that closes the key returns", () => {
    const onClose = vi.fn();
    const { container } = render(<ChartDetail detail={sample} onClose={onClose} />);
    const over = pushLayer();  // a photo opened over the dialog
    expect(isTopLayer(over)).toBe(true);
    fireEvent.keyDown(container.querySelector(".hb-chart-detail")!, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();  // the topmost layer answers the key, not this one
    popLayer(over);
    fireEvent.keyDown(container.querySelector(".hb-chart-detail")!, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("unmounting gives the top back", () => {
    const { unmount } = render(<ChartDetail detail={sample} onClose={() => {}} />);
    const under = pushLayer();  // a layer that was already open below (a photo opened first)
    unmount();
    expect(isTopLayer(under)).toBe(true);
    popLayer(under);
  });

  it("each kind has its word for one piece of its drawing", () => {
    expect(KIND_WORDS).toMatchObject({
      line: "Point", bar: "Column", area: "Point", stacked: "Part", hbar: "Row", combo: "Point",
      pie: "Slice", donut: "Slice", scatter: "Point", waterfall: "Step",
    });
  });
});

describe("chart drill-down (up-and-down charts)", () => {
  it("adds nothing to the drawing at rest: no dialog, no overlay nodes", () => {
    const { container } = render(<Blocks blocks={revenue()} />);
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
    // At rest, the chart markup remains byte-for-byte compatible with release/0.5.0.
    expect(container.querySelector("svg.hb-chart-svg")!.outerHTML).not.toContain("aria-haspopup");
  });

  it("a click on a column opens the focused detail of that datum, not a re-drawn chart", () => {
    const { container } = render(<Blocks blocks={revenue()} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    layoutLikeChrome(svg);
    const x = labelX(container, "Mar");
    fireEvent.pointerDown(svg, { clientX: x, clientY: 60 });
    fireEvent.click(svg, { clientX: x, clientY: 60 });
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("role")).toBe("dialog");
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-label")).toBe("Chart details: Mar");
    expect(dialog!.textContent).toContain("Mar");
    expect(dialog!.textContent).toContain("$42,000");   // the full value, not the shortened headline
    expect(dialog!.textContent).toContain("310");       // every series, each its own row
    expect(dialog!.textContent).toContain("Column · Monthly sales");
    expect(dialog!.textContent).toContain("company ledger");  // provenance comes along
    expect(container.querySelectorAll("svg.hb-chart-svg").length).toBe(1);  // the ONE chart, never a second copy
  });

  it("a click after a drag across the drawing scrubs but does not open", () => {
    const { container } = render(<Blocks blocks={revenue()} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    layoutLikeChrome(svg);
    const x = labelX(container, "Mar");
    fireEvent.pointerDown(svg, { clientX: x, clientY: 60 });
    fireEvent.pointerMove(svg, { clientX: x + 240, clientY: 60, buttons: 1 });
    fireEvent.click(svg, { clientX: x + 240, clientY: 60 });
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
  });

  it("opens from the keyboard on the picked column, keeps the chart node, and returns to it", () => {
    const { container } = render(<Blocks blocks={revenue()} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    expect(svg.getAttribute("aria-haspopup")).toBeNull();
    svg.focus();
    fireEvent.keyDown(svg, { key: "ArrowRight" });           // pick Feb
    fireEvent.keyDown(svg, { key: "ArrowRight" });           // pick Mar
    const before = container.querySelector("svg.hb-chart-svg");
    fireEvent.keyDown(svg, { key: "Enter" });
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail")!;
    expect(dialog.textContent).toContain("Mar");
    expect(document.activeElement).toBe(dialog.querySelector("button"));  // the dialog owns the keyboard
    expect(container.querySelector("svg.hb-chart-svg")).toBe(before);     // the SAME chart node, never re-mounted
    fireEvent.keyDown(dialog.querySelector("button")!, { key: "Tab" });
    expect(document.activeElement).toBe(dialog.querySelector("button"));  // Tab cannot leave the dialog
    fireEvent.keyDown(dialog.querySelector("button")!, { key: "Escape" });
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
    expect(container.querySelector("svg.hb-chart-svg")).toBe(before);     // still the same node after the round trip
    expect(document.activeElement).toBe(svg);                             // the keyboard went back to the drawing
    // the pick survived open and close: Mar is still the one column fully lit (both series, each its own bar)
    const shades = [...container.querySelectorAll("path.hb-chart-bar")].map((b) => b.parentElement!.getAttribute("opacity"));
    expect(shades).toEqual(["0.55", "1", "0.55", "0.55", "1", "0.55"]);
    fireEvent.keyDown(container.querySelector("svg.hb-chart-svg")!, { key: "Enter" });  // and it reopens the same datum
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("Mar");
  });

  it("the close control returns focus to the drawing and the scrim click closes", () => {
    const { container } = render(<Blocks blocks={revenue()} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    layoutLikeChrome(svg);
    const x = labelX(container, "Mar");
    fireEvent.pointerDown(svg, { clientX: x, clientY: 60 });
    fireEvent.click(svg, { clientX: x, clientY: 60 });
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail")!;
    fireEvent.click(dialog.querySelector("button")!);
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
    expect(document.activeElement).toBe(svg);
    fireEvent.pointerDown(svg, { clientX: x, clientY: 60 });
    fireEvent.click(svg, { clientX: x, clientY: 60 });
    fireEvent.click(container.querySelector<HTMLElement>(".hb-chart-detail")!);  // the scrim itself
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
  });

  it("Chrome's stale blur after a close keeps the pick; a real leave still clears it", () => {
    // Closing a drill dialog we opened makes real Chrome fire one more blur on the drawing a beat AFTER it
    // has handed the keyboard back (a delayed stale-focus cleanup for the removed element). That blur has no
    // relatedTarget; clearing on it would erase the pick the return exists to preserve.
    const { container } = render(<Blocks blocks={revenue()} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    svg.focus();
    fireEvent.keyDown(svg, { key: "ArrowRight" });  // pick Feb
    fireEvent.keyDown(svg, { key: "Enter" });
    fireEvent.keyDown(container.querySelector(".hb-overlay-close")!, { key: "Escape" });
    fireEvent.blur(svg);  // the stale cleanup event: no handoff target
    const shades = [...container.querySelectorAll("path.hb-chart-bar")].map((b) => b.parentElement!.getAttribute("opacity"));
    expect(shades).toEqual(["1", "0.55", "0.55", "1", "0.55", "0.55"]);  // Feb still picked
    fireEvent.blur(svg, { relatedTarget: document.body });  // real leaving: focus hands off somewhere
    expect(container.querySelector(".hb-tip-on")).toBeNull();
  });
});

describe("scatter drill-down opens the dot that was picked, by place", () => {
  const dots = (points: object[]) => chart({ kind: "scatter", title: "Weight against price", unit: "kg",
    series: [{ name: "Samples", points }] });

  /** Click where a dot is drawn: its own centre, read back from the DOM the layout just wrote. */
  const clickDot = (container: HTMLElement, k: number) => {
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    layoutLikeChrome(svg, 230);
    const mark = container.querySelectorAll("circle.hb-chart-dot")[k];
    const x = Number(mark.getAttribute("cx"));
    const y = Number(mark.getAttribute("cy"));
    fireEvent.pointerDown(svg, { clientX: x, clientY: y });
    fireEvent.click(svg, { clientX: x, clientY: y });
    return container.querySelector<HTMLElement>(".hb-chart-detail")!;
  };

  it("a repeated x: clicking the HIGHER dot opens that point, and the detail says which point it is", () => {
    const { container } = render(<Blocks blocks={dots([{ x: 1, y: 10, label: "Light" }, { x: 1, y: 90, label: "Heavy" }])} />);
    expect(container.querySelectorAll("circle.hb-chart-dot").length).toBe(2);
    const dialog = clickDot(container, 1);  // dots read left to right, then top to bottom: index 1 is lower on screen
    expect(dialog.getAttribute("aria-label")).toBe("Chart details: Heavy");
    expect(dialog.textContent).toContain("Point 2 of 2");
    expect(dialog.textContent).toContain("Point");  // the kicker word for one piece of a scatter
  });

  it("exact twins open by keyboard each their own datum, and Enter names the point", () => {
    const { container } = render(<Blocks blocks={dots([{ x: 1, y: 50, label: "First" }, { x: 1, y: 50, label: "Second" }])} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    expect(svg.getAttribute("aria-haspopup")).toBeNull();
    svg.focus();
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    fireEvent.keyDown(svg, { key: "Enter" });
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("First");
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("Point 1 of 2");
    fireEvent.keyDown(container.querySelector(".hb-overlay-close")!, { key: "Escape" });
    fireEvent.keyDown(svg, { key: "ArrowRight" });  // from index 0 to index 1 — the twin below the same pixel
    fireEvent.keyDown(svg, { key: "Enter" });
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("Second");
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("Point 2 of 2");
  });

  it("a scrub across the dots does not open", () => {
    const { container } = render(<Blocks blocks={dots([{ x: 1, y: 10, label: "Light" }, { x: 4, y: 90, label: "Heavy" }])} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    layoutLikeChrome(svg, 230);
    const mark = container.querySelectorAll("circle.hb-chart-dot")[0];
    fireEvent.pointerDown(svg, { clientX: Number(mark.getAttribute("cx")), clientY: Number(mark.getAttribute("cy")) });
    fireEvent.pointerMove(svg, { clientX: 480, clientY: 40, buttons: 1 });
    fireEvent.click(svg, { clientX: 480, clientY: 40 });
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
  });
});

describe("waterfall drill-down reads the bridge", () => {
  const bridge = () => chart({ kind: "waterfall", title: "Monthly profit", unit: "₹", series: [{ points: [
    { label: "Revenue", value: 120, total: true }, { label: "Returns", value: -8 },
    { label: "Lending", value: 5 }, { label: "Net", value: 117, total: true }] }] });

  it("a click on a step says its move and the balance it produced", () => {
    const { container } = render(<Blocks blocks={bridge()} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    layoutLikeChrome(svg);
    const x = labelX(container, "Returns");
    fireEvent.pointerDown(svg, { clientX: x, clientY: 60 });
    fireEvent.click(svg, { clientX: x, clientY: 60 });
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail")!;
    expect(dialog.getAttribute("aria-label")).toBe("Chart details: Returns");
    expect(dialog.textContent).toContain("Step · Monthly profit");
    expect(dialog.textContent).toContain("balance");
    expect(dialog.textContent).toContain("₹112");
  });

  it("a total opens as a Total, from the keyboard too", () => {
    const { container } = render(<Blocks blocks={bridge()} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    svg.focus();
    fireEvent.keyDown(svg, { key: "ArrowRight" });  // Revenue, the opening total
    fireEvent.keyDown(svg, { key: "Enter" });
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail")!;
    expect(dialog.textContent).toContain("Total · Monthly profit");
    expect(dialog.textContent).toContain("₹120");
  });
});

describe("pie and row drill-down", () => {
  it("clicking a slice opens its value and share, and the pie keeps its picked slice after close", () => {
    const { container } = render(<Blocks blocks={chart({ kind: "donut", unit: "₹", title: "Budget",
      x: ["Stay", "Flights"], series: [{ name: "Amount", data: [18000, 2000] }] })} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-pie-svg")!;
    expect(svg.getAttribute("aria-haspopup")).toBeNull();
    fireEvent.click(container.querySelectorAll("path.hb-slice")[0]);
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail")!;
    expect(dialog.getAttribute("aria-label")).toBe("Chart details: Stay");
    expect(dialog.textContent).toContain("₹18,000");
    expect(dialog.textContent).toContain("90% of total");
    expect(dialog.textContent).toContain("Slice · Budget");
    fireEvent.keyDown(dialog.querySelector("button")!, { key: "Escape" });
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
    expect(document.activeElement).toBe(svg);  // the keyboard went back to the pie
    const faded = [...container.querySelectorAll("path.hb-slice")].map((s) => s.getAttribute("opacity"));
    expect(faded).toEqual(["1", "0.5"]);  // the picked slice is still picked
  });

  it("a legend row opens its slice too, and Enter opens the slice the keys picked", () => {
    const { container } = render(<Blocks blocks={chart({ kind: "pie", unit: "₹", title: "Budget",
      x: ["Stay", "Flights"], series: [{ name: "Amount", data: [18000, 2000] }] })} />);
    fireEvent.click(container.querySelectorAll("tbody tr td.hb-pie-name")[1]);
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("Flights");
    fireEvent.keyDown(container.querySelector(".hb-overlay-close")!, { key: "Escape" });
    const svg = container.querySelector<SVGSVGElement>("svg.hb-pie-svg")!;
    svg.focus();
    // the pick survived the close (Flights was opened first): ← steps back to the FIRST slice, not the last
    fireEvent.keyDown(svg, { key: "ArrowLeft" });
    fireEvent.keyDown(svg, { key: "Enter" });
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("Stay");
  });

  it("clicking an hbar row opens that row's full values, and the picked row survives the round trip", () => {
    const { container } = render(<Blocks blocks={chart({ kind: "hbar", title: "Flows", source: "the register",
      x: ["HDFC", "ICICI"], unit: "%", series: [{ name: "2025", data: [10.5, 12] }] })} />);
    const grid = container.querySelector<HTMLElement>(".hb-hbar-grid")!;
    expect(grid.getAttribute("aria-haspopup")).toBeNull();
    fireEvent.click(container.querySelector(".hb-hbar-label")!);
    const dialog = container.querySelector<HTMLElement>(".hb-chart-detail")!;
    expect(dialog.getAttribute("aria-label")).toBe("Chart details: HDFC");
    expect(dialog.textContent).toContain("Row · Flows");
    expect(dialog.textContent).toContain("10.5%");
    expect(dialog.textContent).toContain("the register");
    fireEvent.keyDown(dialog.querySelector("button")!, { key: "Escape" });
    expect(container.querySelector(".hb-chart-detail")).toBeNull();
    expect(document.activeElement).toBe(grid);  // focus returns to the rows
    const shades = [...container.querySelectorAll(".hb-hbar-bar")].map((b) => (b as HTMLElement).style.opacity);
    expect(shades).toEqual(["1", "0.55"]);  // the picked row is still picked
    grid.focus();
    fireEvent.keyDown(grid, { key: "ArrowDown" });  // to the second row
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(container.querySelector<HTMLElement>(".hb-chart-detail")!.textContent).toContain("ICICI");
  });
});

describe("nested overlays: one Escape steps down exactly one layer", () => {
  it("a photo opened over the detail takes the key; the detail waits; keys come back in order", () => {
    const blocks = [...revenue(), ...readBlocks([{ type: "images", images: [{ url: "https://e.test/a.jpg", caption: "Dock" }] }])];
    const { container } = render(<Blocks blocks={blocks} />);
    const svg = container.querySelector<SVGSVGElement>("svg.hb-chart-svg")!;
    layoutLikeChrome(svg);
    const x = labelX(container, "Mar");
    fireEvent.pointerDown(svg, { clientX: x, clientY: 60 });
    fireEvent.click(svg, { clientX: x, clientY: 60 });
    expect(container.querySelector(".hb-chart-detail")).not.toBeNull();
    fireEvent.click(container.querySelector(".hb-photo-open")!);
    expect(container.querySelector(".hb-photo-overlay")).not.toBeNull();  // the photo opened over the dialog
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".hb-photo-overlay")).toBeNull();      // the photo answered the key…
    expect(container.querySelector(".hb-chart-detail")).not.toBeNull();   // …and the detail waited, still open
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".hb-chart-detail")).toBeNull();       // the second key steps down one more
    expect(document.activeElement).toBe(svg);
  });
});
