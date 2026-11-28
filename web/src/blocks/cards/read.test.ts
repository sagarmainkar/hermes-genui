// The cards reader's display pack: span, a small ring, tags, stale, a second action, metric trends, three columns and
// shelves. Each field is read only when it is well shaped, nothing is invented, and an "unknown" value stays a value.
import { describe, expect, it } from "vitest";
import { readBlocks, readBlocksNoted } from "../../core/readBlocks";

const card = (extra: object = {}) => ({ title: "Mission Control", ...extra });
const cards = (raw: object) => readBlocks([{ type: "cards", ...raw }])[0] as any;

describe("cards: span", () => {
  it("reads 1 and 2 and ignores anything else", () => {
    expect(cards({ items: [card({ span: 2 })] }).items[0].span).toBe(2);
    expect(cards({ items: [card({ span: 1 })] }).items[0].span).toBe(1);
    for (const bad of [3, 0, "2", true, 1.5]) expect("span" in cards({ items: [card({ span: bad })] }).items[0]).toBe(false);
  });
});

describe("cards: ring.size", () => {
  const ring = (size: unknown) => ({ stages: ["PLAN", "TRACK", "IMPLEMENT", "METRIC"], at: 0, size });
  it("reads sm and md, caselessly, and ignores other words", () => {
    expect(cards({ items: [card({ ring: ring("sm") })] }).items[0].ring.size).toBe("sm");
    expect(cards({ items: [card({ ring: ring(" MD ") })] }).items[0].ring.size).toBe("md");
    for (const bad of ["xs", 28, true]) expect("size" in cards({ items: [card({ ring: ring(bad) })] }).items[0].ring).toBe(false);
  });
});

describe("cards: tags", () => {
  it("keeps up to three, each cut to 24 characters", () => {
    expect(cards({ items: [card({ tags: ["blocked", "no evidence"] })] }).items[0].tags).toEqual(["blocked", "no evidence"]);
    expect(cards({ items: [card({ tags: ["a", "b", "c", "d"] })] }).items[0].tags).toEqual(["a", "b", "c"]);
    expect(cards({ items: [card({ tags: ["x".repeat(40)] })] }).items[0].tags).toEqual(["x".repeat(24)]);
  });

  it("drops the row when there is nothing to say", () => {
    for (const empty of [[], ["", "  "], "blocked", 3]) {
      expect("tags" in cards({ items: [card({ tags: empty })] }).items[0]).toBe(false);
    }
  });
});

describe("cards: stale", () => {
  it("reads a boolean only", () => {
    expect(cards({ items: [card({ stale: true })] }).items[0].stale).toBe(true);
    expect(cards({ items: [card({ stale: false })] }).items[0].stale).toBe(false);
    for (const bad of ["true", 1, 0]) expect("stale" in cards({ items: [card({ stale: bad })] }).items[0]).toBe(false);
  });
});

describe("cards: the second action", () => {
  it("reads a run message, an https link, or the consumer's http loopback", () => {
    const withRun = cards({ items: [card({ secondary: { label: "Notes", run: "Open the notes" } })] }).items[0];
    expect(withRun.secondary).toEqual({ label: "Notes", run: "Open the notes" });
    const withLink = cards({ items: [card({ secondary: { label: "Browser", url: "https://example.org/p" } })] }).items[0];
    expect(withLink.secondary).toEqual({ label: "Browser", url: "https://example.org/p" });
    // The documented consumer link is plain http on this machine: it must survive, not vanish.
    const loopback = "http://127.0.0.1:8765/#/project/PJ-20261023-001";
    expect(cards({ items: [card({ secondary: { label: "Browser", url: loopback } })] }).items[0].secondary)
      .toEqual({ label: "Browser", url: loopback });
  });

  it("still refuses a dangerous scheme or plain http to a remote host, on the secondary and the action", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<b>x</b>", "http://example.org/p", "http://127.0.0.1.evil/p"]) {
      expect(cards({ items: [card({ secondary: { label: "Bad", url } })] }).items[0].secondary).toEqual({ label: "Bad" });
      expect(cards({ items: [card({ action: { label: "Bad", url } })] }).items[0].action).toEqual({ label: "Bad" });
    }
  });

  it("drops the card when the secondary's run would act before the model", () => {
    const noted = readBlocksNoted([{ type: "cards", items: [card({ secondary: { label: "Go", run: "/reset" } })] }]);
    expect(noted.blocks).toEqual([]);
    expect(noted.dropped[0].path).toBe("0.items.0");
    expect(noted.dropped[0].why).toMatch(/can't start with \/ @ or !/);
  });
});

describe("cards: metric trends", () => {
  it("keeps a metric's finite numbers, the latest 60 at most, and omits a trend that cannot draw", () => {
    const metric = (trend: unknown) => ({ metrics: [{ label: "velocity", value: "0.75/wk", trend }] });
    expect(cards({ items: [card(metric([0.4, 0.5, 0.75]))] }).items[0].metrics[0].trend).toEqual([0.4, 0.5, 0.75]);
    expect(cards({ items: [card(metric([100, "90", null, 85, 80]))] }).items[0].metrics[0].trend).toEqual([100, 85, 80]);
    expect(cards({ items: [card(metric(Array.from({ length: 80 }, (_, i) => i)))] }).items[0].metrics[0].trend)
      .toEqual(Array.from({ length: 60 }, (_, i) => i + 20));
    for (const bad of [[1], "1,2", [1, "2"]]) {
      expect("trend" in cards({ items: [card(metric(bad))] }).items[0].metrics[0]).toBe(false);
    }
  });
});

describe("cards: columns", () => {
  it("accepts one, two or three and ignores anything else", () => {
    for (const good of [1, 2, 3] as const) expect(cards({ columns: good, items: [card()] }).columns).toBe(good);
    for (const bad of [0, 4, "3", true]) expect("columns" in cards({ columns: bad, items: [card()] })).toBe(false);
  });
});

describe("cards: shelves", () => {
  const shelves = [
    { label: "Needs you · 1", items: [card({ title: "NEMO", needs: { text: "4 plans await your yes" } })] },
    { label: "Parked · 1", items: [card({ title: "Old site", status: "parked" })] },
  ];

  it("reads labelled groups instead of a flat list", () => {
    const block = cards({ shelves });
    expect(block.shelves.map((s: any) => s.label)).toEqual(["Needs you · 1", "Parked · 1"]);
    expect(block.shelves[0].items[0].title).toBe("NEMO");
    expect("items" in block).toBe(false);
  });

  it("prefers items when a stored block says both, rather than drawing either twice", () => {
    const block = cards({ items: [card({ title: "Flat" })], shelves });
    expect(block.items.map((c: any) => c.title)).toEqual(["Flat"]);
    expect("shelves" in block).toBe(false);
  });

  it("leaves out a shelf without a label or without a drawable card", () => {
    const noted = readBlocksNoted([{ type: "cards", shelves: [shelves[0], { items: [card()] }, { label: "Empty", items: [] }] }]);
    expect((noted.blocks[0] as any).shelves).toHaveLength(1);
    expect(noted.dropped.map((d) => d.path)).toContain("0.shelves.1");
  });

  it("drops the block when there is neither form", () => {
    const noted = readBlocksNoted([{ type: "cards", shelves: [] }]);
    expect(noted.blocks).toEqual([]);
    expect(noted.dropped[0].why).toBe("cards needs items or shelves");
  });
});

describe("cards: honesty is untouched by the display fields", () => {
  it("still reads unknown as the literal word, whatever the new fields say", () => {
    const block = cards({
      columns: 3,
      items: [{
        title: "Librarian", span: 2, tags: ["no evidence"], stale: true, ring: { stages: ["P", "T", "I", "M"], size: "sm" },
        metrics: [{ label: "velocity", value: "unknown", trend: [1, 2, 3] }],
      }],
    });
    expect(block.items[0].metrics[0].value).toBe("unknown");
  });
});
