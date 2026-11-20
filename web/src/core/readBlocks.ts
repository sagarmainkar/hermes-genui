// Reading stored blocks: JSON from the plugin's store → blocks the drawing code can draw. Each type has its own
// reader in blocks/<type>/read.ts, with a comment and a worked example, listed in registry.tsx. The rule throughout:
// drop what doesn't fit and note why; never show broken data.
import { REGISTRY, type Block } from "../registry";
import { align, Trail, type Align, type Diagnostic } from "./fields";

/** Every block type that can be drawn, containers included. */
export const BLOCK_TYPES: string[] = Object.keys(REGISTRY);

/**
 * Stored JSON → its blocks, notes on what was dropped, and the board's own words from the stored envelope: its
 * placement default (where the cards sit) and its text default (how the words inside them read). A lone block
 * object is a list of one, and the store's {blocks: [...]} envelope is unwrapped (it may say align or
 * text_align beside blocks). Anything else gives no blocks.
 *   [{type: "heading", text: "Day 1"}, {type: "weather"}]
 *   → {blocks: [{type: "heading", text: "Day 1"}], dropped: [{path: "1", why: 'unknown type "weather"'}]}
 */
export function readBlocksNoted(data: unknown): {
  blocks: Block[]; dropped: Diagnostic[]; align?: Align; textAlign?: Align;
} {
  let list: unknown = data;
  let board: Align | undefined;
  let boardText: Align | undefined;
  if (isObject(list) && Array.isArray((list as any).blocks)) {
    // The envelope's own words are the board's defaults. A block that merely spells its children `blocks` (a
    // section with `blocks: [...]` on its own line — drawn unwrapped, as it has always been) is not an envelope:
    // its align is the block's own ask, not a board default.
    if (typeof (list as any).type !== "string") {
      board = align((list as any).align);
      boardText = align((list as any).text_align); // the same three words; they move the reading, not the card
    }
    list = (list as any).blocks;
  }
  if (isObject(list) && typeof (list as any).type === "string") list = [list];
  const top = new Trail();
  const blocks: Block[] = [];
  if (Array.isArray(list)) {
    list.forEach((raw, i) => {
      blocks.push(...readOne(raw, top.at(i), 0));
    });
  }
  return { blocks, dropped: top.dropped, align: board, textAlign: boardText };
}

/** Just the blocks to draw. */
export function readBlocks(data: unknown): Block[] {
  return readBlocksNoted(data).blocks;
}

/** Where a block's own spec asked to be drawn, read by the board (core/Blocks.tsx); undefined when it didn't say.
 *  A drawing never reads it: placement is the board's business, kept off each block's props. */
export function alignOf(block: Block): Align | undefined {
  return (block as { align?: Align }).align;
}

/** How a block's own spec asked its words to read (text_align, the same three words as align); undefined when it
 *  didn't say. Like placement, only the board reads it — a drawing never does. */
export function textAlignOf(block: Block): Align | undefined {
  return (block as { text_align?: Align }).text_align;
}

function isObject(v: unknown): boolean {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** One item (top level or a container's child) → zero, one or several blocks (a flattened container gives its
 *  children). `depth` counts the containers above it. */
function readOne(raw: unknown, here: Trail, depth: number): Block[] {
  if (!isObject(raw)) {
    here.drop("not a block object");
    return [];
  }
  const kind = (raw as any).type;
  const entry = Object.hasOwn(REGISTRY, kind) ? REGISTRY[kind as Block["type"]] : undefined;
  if (!entry) {
    here.drop(`unknown type "${kind}"`);
    return [];
  }
  const read = entry.read(raw, here, depth, readOne);
  if (!read) return [];
  const blocks = Array.isArray(read) ? read : [read];
  // An ask the drawing didn't want for itself belongs to it: a row drawn as a stack places every block of the
  // stack where the row said, and reads its words the way the row said. (Blocks drawn inside a container that
  // survives are placed by the container, not here.)
  const asked = align((raw as any).align);
  if (asked) for (const block of blocks) if (alignOf(block) === undefined) Object.assign(block, { align: asked });
  const askedText = align((raw as any).text_align);
  if (askedText) for (const block of blocks) if (textAlignOf(block) === undefined) {
    Object.assign(block, { text_align: askedText });
  }
  return blocks;
}
