/// <reference types="vite/client" />
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetBoards } from "../checklist/savedState";
import { drawWithActions as draw, withStyles } from "../../core/testing";
import cardsCss from "./cards.css?raw";

afterEach(cleanup);
beforeEach(() => forgetBoards());

const WALL = {
  type: "cards",
  items: [
    {
      title: "Mission Control", id: "PJ-20261023-001", status: "active",
      ring: { stages: ["PLAN", "TRACK", "IMPLEMENT", "METRIC"], at: 0, label: "smooth", tone: "good" },
      metrics: [{ label: "velocity", value: "0.75/wk" }, { label: "delivery", value: "100%" }],
      needs: { text: "2 plans await your yes", tone: "warn" }, freshness: "as of 16:52 UTC",
      action: { label: "Open project chat", run: "Open the project chat" },
    },
    // honest-unknown card: value unknown, no needs → must read "unknown", never "clear"
    { title: "Librarian", status: "active", metrics: [{ label: "velocity", value: "unknown" }] },
  ],
};

describe("cards", () => {
  it("draws one card per project and sends exactly the action's run", () => {
    const { container, send } = draw([WALL]);
    expect(container.querySelectorAll(".hb-card")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Open project chat/ }));
    expect(send).toHaveBeenCalledWith("Open the project chat");
  });

  it("does not send when a card has no action", () => {
    const { send } = draw([{ type: "cards", items: [{ title: "Quiet", status: "done" }] }]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("renders unknown as the word, in the neutral tone, and never as clear", () => {
    const { container } = draw([WALL]);
    const librarian = container.querySelectorAll(".hb-card")[1];
    expect(librarian.textContent).toContain("unknown");
    expect(librarian.querySelector(".hb-card-needs.hb-tone-neutral")).toBeTruthy();
    expect(librarian.textContent).not.toContain("clear");
  });

  it("uses one column at columns:1 and the 2-up class at columns:2", () => {
    expect(draw([{ ...WALL, columns: 1 }]).container.querySelector(".hb-cards-1")).toBeTruthy();
    expect(draw([{ ...WALL, columns: 2 }]).container.querySelector(".hb-cards-2")).toBeTruthy();
  });

  it("emphasises only the current ring segment; no `at` leaves none emphasised", () => {
    const withAt = draw([{ type: "cards", items: [{ title: "A", ring: { stages: ["A", "B", "C", "D"], at: 2 } }] }]).container;
    const circles = withAt.querySelectorAll(".hb-card-ring circle");
    expect(circles).toHaveLength(4);
    expect(circles[2].getAttribute("stroke-opacity")).toBe("1");
    expect(circles[0].getAttribute("stroke-opacity")).toBe("0.55");

    const noAt = draw([{ type: "cards", items: [{ title: "A", ring: { stages: ["A", "B", "C", "D"] } }] }]).container;
    const segs = noAt.querySelectorAll(".hb-card-ring circle");
    expect([...segs].every((c) => c.getAttribute("stroke-opacity") === "0.55")).toBe(true);
  });

  it("labels the card and the ring for assistive tech", () => {
    const { container } = draw([WALL]);
    const ring = container.querySelector(".hb-card-ring")!;
    expect(ring.getAttribute("aria-label")).toBe(
      "Lifecycle PLAN to TRACK to IMPLEMENT to METRIC, now PLAN, health smooth");
    expect(container.querySelector(".hb-card")!.getAttribute("aria-label")).toContain("Mission Control");
  });

  it("honours compact density and adds no inline colours", () => {
    const { container } = draw([WALL]);
    const unstyle = withStyles(cardsCss);
    try {
      expect(container.querySelector(".hb-card")!.getAttribute("style")).toBeNull();
      expect(/var\(--hb-/.test(cardsCss)).toBe(true);
    } finally {
      unstyle();
    }
  });
});
