import { describe, expect, it } from "vitest";
import { actsBeforeTheModel, align, cutAtWord, firstWords } from "./fields";

describe("cutAtWord", () => {
  it("leaves text that fits alone", () => {
    expect(cutAtWord("Host city?", 20)).toBe("Host city?");
    expect(cutAtWord("x".repeat(20), 20)).toBe("x".repeat(20));
  });
  it("cuts between words and ends in an ellipsis, within the limit", () => {
    const question = "Why do transformers need positional encoding if attention already sees everything?";
    const cut = cutAtWord(question, 60);
    expect(cut).toBe("Why do transformers need positional encoding if attention…");
    expect(cut.length).toBeLessThanOrEqual(60);
  });
  it("drops a comma or dash left at the cut", () => {
    expect(cutAtWord("Rome, Paris, London and Berlin", 14)).toBe("Rome, Paris…");
    expect(cutAtWord("Delhi – Agra – Jaipur", 9)).toBe("Delhi…");
  });
  it("cuts inside a word only when one long word fills most of the room", () => {
    expect(cutAtWord("See https://example.org/a/very/long/path", 20)).toBe("See https://example…");
  });
});

describe("firstWords", () => {
  it("takes the first field with text, trimmed, and cuts it between words", () => {
    expect(firstWords([undefined, "  Most golds?  "], 140)).toBe("Most golds?");
    expect(firstWords([" ", "one two three"], 10)).toBe("one two…");
    expect(firstWords([5, null], 10)).toBeUndefined();
  });
});

describe("align", () => {
  it("reads the three words, trimmed and caseless the way models write", () => {
    expect(align("center")).toBe("center");
    expect(align(" Center ")).toBe("center");
    expect(align("RIGHT")).toBe("right");
    expect(align("left")).toBe("left");
  });
  it("gives nothing for anything else, which leaves the ask to the board", () => {
    expect(align("middle")).toBeUndefined();
    expect(align(7)).toBeUndefined();
    expect(align(undefined)).toBeUndefined();
    expect(align(null)).toBeUndefined();
    expect(align(["center"])).toBeUndefined();
  });
});

describe("actsBeforeTheModel", () => {
  it("refuses a command, a shell line or an @-reference", () => {
    for (const m of ["/reset", "  @file:notes.txt", "!ls", "Summarise @url:https://x.org"]) {
      expect(actsBeforeTheModel(m)).toBe(true);
    }
  });
  it("is not fooled by an invisible mark in front (cleaning would drop it before sending)", () => {
    for (const hidden of ["\u200b", "\u200d", "\u2060", "\ufeff", "\u202e", "\u200b \u200c"]) {
      expect(actsBeforeTheModel(`${hidden}/reset`)).toBe(true);
      expect(actsBeforeTheModel(`${hidden}!ls`)).toBe(true);
      expect(actsBeforeTheModel(`${hidden}@file:x`)).toBe(true);
    }
  });
  it("leaves ordinary messages alone, joiners and all", () => {
    for (const m of ["Plan day 2", "Email name@example.com", "Meet @ 5pm", "Trip for the \u{1F468}\u200d\u{1F469}\u200d\u{1F467} family", undefined]) {
      expect(actsBeforeTheModel(m)).toBe(false);
    }
  });
});
