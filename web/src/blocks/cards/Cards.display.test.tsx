/// <reference types="vite/client" />
// The cards display pack drawn for real: every case goes through the normal path (stored JSON → readBlocks → Blocks),
// then reads the DOM a person would see. An "unknown" value must still be the literal word in every one of them.
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetBoards } from "../checklist/savedState";
import { drawWithActions as draw, withStyles } from "../../core/testing";
import cardsCss from "./cards.css?raw";

afterEach(cleanup);
beforeEach(() => forgetBoards());

const RING = { stages: ["PLAN", "TRACK", "IMPLEMENT", "METRIC"], at: 0, label: "smooth", tone: "good" };
const card = (extra: object = {}) => ({ title: "Mission Control", ...extra });
const wall = (items: object[], extra: object = {}) => [{ type: "cards", ...extra, items }];

describe("cards: span", () => {
  it("gives a span-2 card the whole row on a two-up wall", () => {
    const { container } = draw(wall([card({ span: 2, title: "Hero", ring: RING }), card({ title: "Sibling" })], { columns: 2 }));
    const cards = [...container.querySelectorAll(".hb-card")];
    expect(cards[0].classList.contains("hb-card-wide")).toBe(true);
    expect(cards[1].classList.contains("hb-card-wide")).toBe(false);
    // Same anatomy: the ring and metrics are still drawn on the wide card.
    expect(cards[0].querySelector(".hb-card-ring")).toBeTruthy();
  });

  it("fills the row when the board says nothing, because the wall's default is two", () => {
    const { container } = draw(wall([card({ span: 2, title: "Hero" }), card({ title: "Sibling" })]));
    expect(container.querySelector(".hb-cards-auto.hb-cards-hero")).toBeTruthy();
    expect(container.querySelectorAll(".hb-card")[0].classList.contains("hb-card-wide")).toBe(true);
    expect(container.querySelectorAll(".hb-card")[1].classList.contains("hb-card-wide")).toBe(false);
  });

  it("ignores span 2 on a one- or three-column wall, without an error", () => {
    for (const columns of [1, 3] as const) {
      const { container } = draw(wall([card({ span: 2 })], { columns }));
      expect(container.querySelector(".hb-card-wide")).toBeNull();
      expect(container.querySelector(".hb-cards-hero")).toBeNull();
    }
  });

  it("draws the cards beside a hero in exactly two tracks, and leaves hero-less boards as they were", () => {
    // A hero wall measures itself and states two tracks: an auto-fit would draw three ordinary cards on a 1000px wall.
    const hero = draw(wall([card({ span: 2, title: "Hero" }), card({ title: "A" }), card({ title: "B" }), card({ title: "C" })], { columns: 2 }));
    const grid = hero.container.querySelector(".hb-cards-2.hb-cards-hero")!;
    expect(hero.container.querySelector(".hb-cards-frame > .hb-cards-hero")).toBeTruthy();
    expect(grid).toBeTruthy();
    // The hero is the only card that takes the row; the other three stay ordinary (two per track, second row).
    expect([...hero.container.querySelectorAll(".hb-card-wide")]).toHaveLength(1);
    // A wall with no hero keeps the shipped auto-fit: no hero class, no measuring frame, same class as before.
    const plain = draw(wall([card({ title: "A" }), card({ title: "B" })], { columns: 2 })).container;
    expect(plain.querySelector(".hb-cards-2")).toBeTruthy();
    expect(plain.querySelector(".hb-cards-hero")).toBeNull();
    expect(plain.querySelector(".hb-cards-frame")).toBeNull();
  });

  it("gives a hero its two tracks inside a shelf too", () => {
    const { container } = draw([{ type: "cards", columns: 2, shelves: [
      { label: "Needs you · 2", items: [card({ span: 2, title: "Hero" }), card({ title: "A" }), card({ title: "B" })] },
    ] }]);
    expect(container.querySelector(".hb-card-shelf .hb-cards-2.hb-cards-hero")).toBeTruthy();
    expect([...container.querySelectorAll(".hb-card-wide")]).toHaveLength(1);
  });
});

describe("cards: ring.size", () => {
  it("draws a 28px ring with the marker and the centre word, and keeps the metrics where they were", () => {
    const { container } = draw(wall([card({ ring: { ...RING, size: "sm" }, metrics: [{ label: "velocity", value: "0.75/wk" }] })]));
    const ring = container.querySelector(".hb-card-ring")!;
    expect(ring.classList.contains("hb-card-ring-sm")).toBe(true);
    expect(ring.getAttribute("width")).toBe("28");
    expect(ring.getAttribute("height")).toBe("28");
    expect(ring.querySelectorAll("circle")).toHaveLength(4);
    expect(ring.textContent).toBe("smooth");
    // The metrics column is still drawn beside it, at its own width.
    expect(container.querySelector(".hb-card-metrics .hb-card-metric")).toBeTruthy();
    const unstyle = withStyles(cardsCss);
    try {
      // The 12px the ring gives up stays in the band, so the metrics column does not move between the sizes.
      expect(getComputedStyle(ring).marginRight).toBe("12px");
    } finally {
      unstyle();
    }
  });

  it("draws the 40px ring when the size says nothing or says md", () => {
    const { container } = draw(wall([card({ ring: RING }), card({ ring: { ...RING, size: "md" } })]));
    const rings = container.querySelectorAll(".hb-card-ring");
    expect(rings[0].getAttribute("width")).toBe("40");
    expect(rings[1].getAttribute("width")).toBe("40");
    expect(container.querySelector(".hb-card-ring-sm")).toBeNull();
  });
});

describe("cards: tags", () => {
  it("draws up to three muted chips beside the status chip", () => {
    const { container } = draw(wall([card({ status: "active", tags: ["blocked", "no evidence", "2 overdue"] })]));
    const tags = [...container.querySelectorAll(".hb-card-tag")];
    expect(tags.map((t) => t.textContent)).toEqual(["blocked", "no evidence", "2 overdue"]);
    expect(container.querySelector(".hb-card-head .hb-card-chip")!.textContent).toBe("active");
    const unstyle = withStyles(cardsCss);
    try {
      // Muted, never the tone `needs` uses: the chip carries no tone class at all.
      expect(tags[0].className).toBe("hb-card-tag");
      expect(getComputedStyle(tags[0]).color).toBe("var(--hb-muted)");
      expect(getComputedStyle(tags[0]).whiteSpace).toBe("nowrap");
    } finally {
      unstyle();
    }
  });

  it("leaves the row out entirely when a card has no tags", () => {
    const { container } = draw(wall([card(), card({ tags: [] })]));
    expect(container.querySelector(".hb-card-tag")).toBeNull();
  });
});

describe("cards: stale", () => {
  it("dims the freshness line, adds a plain stale chip, and leaves the values and `needs` alone", () => {
    const items = [
      card({ freshness: "as of 16:52 UTC", stale: true, needs: { text: "4 plans await your yes", tone: "warn" },
        metrics: [{ label: "velocity", value: "unknown" }] }),
      card({ freshness: "as of 16:52 UTC", needs: { text: "4 plans await your yes", tone: "warn" } }),
    ];
    const { container } = draw(wall(items));
    const stale = container.querySelectorAll(".hb-card")[0];
    expect(stale.querySelector(".hb-card-stale")!.textContent).toBe("stale");
    expect(stale.querySelector(".hb-card-fresh")!.classList.contains("hb-card-fresh-dim")).toBe(true);
    // Never colour-only: the card's own label carries the word, and so does the chip.
    expect(stale.getAttribute("aria-label")).toContain("stale");
    // The tone of `needs` and the value are untouched by staleness.
    expect(stale.querySelector(".hb-card-needs")!.className).toContain("hb-tone-warn");
    expect(stale.querySelector(".hb-card-needs")!.textContent).toBe("4 plans await your yes");
    expect(stale.querySelector(".hb-card-metric dd")!.textContent).toBe("unknown");
    // The fresh card keeps a plain freshness line.
    const fresh = container.querySelectorAll(".hb-card")[1];
    expect(fresh.querySelector(".hb-card-stale")).toBeNull();
    expect(fresh.querySelector(".hb-card-fresh")!.classList.contains("hb-card-fresh-dim")).toBe(false);
  });

  it("shows the chip even when a stale card has no freshness line", () => {
    const { container } = draw(wall([card({ stale: true })]));
    expect(container.querySelector(".hb-card-stale")).toBeTruthy();
  });
});

describe("cards: the second action", () => {
  it("draws a quieter text link beside the primary action", () => {
    draw(wall([card({
      action: { label: "Open chat", run: "Open the project chat" },
      secondary: { label: "Browser", url: "https://example.org/p" },
    })]));
    const link = screen.getByRole("link", { name: "Browser" });
    expect(link.className).toBe("hb-card-secondary");
    expect(link.getAttribute("href")).toBe("https://example.org/p");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    expect(screen.getByRole("button", { name: "Open chat" }).className).toBe("hb-card-action");
  });

  it("keeps the consumer's plain-http loopback link as a real href, and drops a remote http one", () => {
    const loopback = "http://127.0.0.1:8765/#/project/PJ-20261023-001";
    draw(wall([
      card({ title: "Loopback", secondary: { label: "Browser", url: loopback } }),
      card({ title: "Remote", secondary: { label: "Elsewhere", url: "http://example.org/p" } }),
    ]));
    expect(screen.getByRole("link", { name: "Browser" }).getAttribute("href")).toBe(loopback);
    // A link the policy refuses is not drawn as a link at all (the card keeps its label, nothing clickable).
    expect(screen.queryByRole("link", { name: "Elsewhere" })).toBeNull();
  });

  it("sends the secondary's own message when it is a button", () => {
    const { send } = draw(wall([card({
      action: { label: "Open chat", run: "Open the project chat" },
      secondary: { label: "Notes", run: "Open the notes" },
    })]));
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(send).toHaveBeenCalledWith("Open the notes");
    fireEvent.click(screen.getByRole("button", { name: "Open chat" }));
    expect(send).toHaveBeenCalledWith("Open the project chat");
  });
});

describe("cards: metric trends", () => {
  it("draws a small unlabelled line after the value, and draws nothing when there is no trend", () => {
    const { container } = draw(wall([
      card({ metrics: [{ label: "velocity", value: "0.75/wk", trend: [0.4, 0.5, 0.75] }] }),
      card({ title: "Plain", metrics: [{ label: "velocity", value: "1/wk" }] }),
    ]));
    const sparks = container.querySelectorAll(".hb-card-spark");
    expect(sparks).toHaveLength(1);
    expect(sparks[0].getAttribute("aria-hidden")).toBe("true");
    expect(sparks[0].querySelector("path")!.getAttribute("d")).toMatch(/^M[\d.]+ [\d.]+L/);
    // The value is still there, and a trend never replaces it.
    expect(container.querySelector(".hb-card-metric dd")!.textContent).toContain("0.75/wk");
  });
});

describe("cards: columns", () => {
  it("draws three tracks at columns: 3, keeps two as stated, auto-fits an unstated wall, and one at columns: 1", () => {
    const three = draw(wall([card()], { columns: 3 })).container;
    expect(three.querySelector(".hb-cards-frame > .hb-cards-3")).toBeTruthy();
    expect(three.querySelector(".hb-cards-hero")).toBeNull();
    expect(draw(wall([card()], { columns: 2 })).container.querySelector(".hb-cards-2")).toBeTruthy();
    // A board that never said `columns` keeps the auto-fit it always drew — a class of its own, same tracks.
    expect(draw(wall([card()])).container.querySelector(".hb-cards-auto")).toBeTruthy();
    expect(draw(wall([card()], { columns: 1 })).container.querySelector(".hb-cards-1")).toBeTruthy();
  });

  it("measures three-up against the wall's own width, so a narrow pane collapses it", () => {
    const unstyle = withStyles(cardsCss);
    try {
      // The frame is the container the tracks are measured against — not the window.
      const frame = draw(wall([card()], { columns: 3 })).container.querySelector(".hb-cards-frame")!;
      expect(getComputedStyle(frame).containerType).toBe("inline-size");
    } finally {
      unstyle();
    }
  });
});

describe("cards: shelves", () => {
  const shelves = [
    { label: "Needs you · 1", items: [card({ title: "NEMO", needs: { text: "4 plans await your yes" } })] },
    { label: "Parked · 2", items: [card({ title: "Old site", status: "parked" }), card({ title: "Blog", status: "parked" })] },
  ];

  it("draws one labelled group per shelf, each its own wall", () => {
    const { container } = draw([{ type: "cards", columns: 2, shelves }]);
    const groups = container.querySelectorAll(".hb-card-shelf");
    expect(groups).toHaveLength(2);
    expect(groups[0].getAttribute("aria-label")).toBe("Needs you · 1");
    expect(groups[0].querySelector(".hb-card-shelf-label")!.textContent).toBe("Needs you · 1");
    expect(groups[0].querySelectorAll(".hb-card")).toHaveLength(1);
    expect(groups[1].querySelectorAll(".hb-card")).toHaveLength(2);
    // Same card anatomy and the same track count inside a shelf.
    expect(groups[0].querySelector(".hb-cards-2")).toBeTruthy();
    expect(container.querySelector(".hb-cards-shelves")).toBeTruthy();
  });

  it("still draws the honest unknown inside a shelf", () => {
    const { container } = draw([{ type: "cards", shelves: [
      { label: "Active · 1", items: [card({ metrics: [{ label: "velocity", value: "unknown" }] })] },
    ] }]);
    expect(container.querySelector(".hb-card-needs")!.textContent).toBe("unknown");
  });
});
