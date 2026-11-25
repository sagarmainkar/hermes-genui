// The layered overlay stack. A reader can open full-size layers over the page one at a time — a chart's
// drill-down detail (blocks/chart/ChartDetail.tsx), a photo (blocks/images/Images.tsx) — and a keypress must
// reach ONE of them: the topmost, the layer opened last over the others. Without a shared stack every layer
// listens on the window alone and the key answers all of them at once, so one Escape would close both. Each
// open layer takes the top here; when it answers the key it stops the event where it stands; when it closes,
// the layer underneath takes the keys back, focus and state intact.
let seq = 0;
const stack: number[] = [];

/** A layer opened now takes the top of the stack; keep the id it hands back until it closes. */
export function pushLayer(): number {
  stack.push(++seq);
  return seq;
}

/** The layer closed: give the keys back to whatever sits underneath. */
export function popLayer(id: number): void {
  const at = stack.indexOf(id);
  if (at >= 0) stack.splice(at, 1);
}

/** Whether this layer is the one the keyboard belongs to right now. */
export function isTopLayer(id: number): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
