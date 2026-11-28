// cards: a compact wall of project cards — one block for a whole portfolio. Reads stored JSON into safe, drawable cards
// and never invents values: an "unknown" stays the literal word, and nothing is turned into a zero or a blank.
import { actsBeforeTheModel, clean, firstList, keepFirst, NO_SEND, num, safeLink, str, type Trail } from "../../core/fields";

export type CardTone = "good" | "warn" | "bad" | "neutral";
export type CardRing = { stages: string[]; at?: number; label?: string; tone?: CardTone; size?: "sm" | "md" };
export type CardMetric = { label: string; value: string; tone?: CardTone; trend?: number[] };
export type CardNeeds = { text: string; tone?: CardTone };
export type CardAction = { label: string; run?: string; url?: string };
export type CardItem = {
  title: string; id?: string; status?: string; span?: 1 | 2; ring?: CardRing; metrics?: CardMetric[];
  needs?: CardNeeds; freshness?: string; stale?: boolean; tags?: string[]; action?: CardAction;
  secondary?: CardAction; owner?: string; milestone?: string; trend?: string; budget?: string; arr?: string;
};
/** Labelled group of cards: "Needs you · 3" holding the cards that need the owner. */
export type CardShelf = { label: string; items: CardItem[] };
export type CardsBlock = { type: "cards"; columns?: 1 | 2 | 3; items?: CardItem[]; shelves?: CardShelf[] };

const MAX_CARDS = 14;
const MAX_METRICS = 3;
const MAX_TAGS = 3;
const TAG_CHARS = 24;
const STATUSES = ["active", "parked", "done", "archived"] as const;
const TONES = ["good", "warn", "bad", "neutral"] as const;
// A metric's trend is a small line after the value: it needs 2 points, and more than 60 would not show in it.
const TREND_FEWEST = 2;
const TREND_MOST = 60;

function tone(v: unknown): CardTone | undefined {
  if (typeof v !== "string") return undefined;
  const word = v.trim().toLowerCase();
  return (TONES as readonly string[]).includes(word) ? (word as CardTone) : undefined;
}

function status(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const word = v.trim().toLowerCase();
  return (STATUSES as readonly string[]).includes(word) ? word : undefined;
}

/** How big the lifecycle ring is: "sm" or "md" (the default md is drawn when this says nothing). */
function ringSize(v: unknown): "sm" | "md" | undefined {
  if (typeof v !== "string") return undefined;
  const word = v.trim().toLowerCase();
  return word === "sm" ? "sm" : word === "md" ? "md" : undefined;
}

/**
 * cards: 1-14 project cards, as one `items` list or as labelled `shelves` (never both: `items` wins when a stored
 * block says both). Each card needs a title; the ring, metrics, needs, tags, stale flag and actions are read only
 * when well shaped. An action or secondary whose run would act before the model (/ @ !) drops the whole card.
 *   {type: "cards", items: [{title: "Mission Control", status: "active"}, {subtitle: "no title"}]}
 *   → {type: "cards", items: [{title: "Mission Control", status: "active"}]}
 */
export function readCards(raw: any, here: Trail): CardsBlock | null {
  const list = firstList([raw.items, raw.cards]);
  const read = list ? readList(list, here.at("items")) : [];
  const items = read.length ? read : undefined;
  const shelves = !items && Array.isArray(raw.shelves) ? readShelves(raw.shelves, here.at("shelves")) : undefined;
  if (!items && !shelves) return here.drop("cards needs items or shelves");
  const columns: 1 | 2 | 3 | undefined =
    raw.columns === 1 ? 1 : raw.columns === 2 ? 2 : raw.columns === 3 ? 3 : undefined;
  return clean({ type: "cards" as const, columns, items, shelves });
}

/** One list of cards as written → the cards that can be drawn, noting (and skipping) the ones that cannot. */
function readList(list: unknown[], here: Trail): CardItem[] {
  const items: CardItem[] = [];
  list.forEach((item, i) => {
    const card = readCard(item);
    if (!card) {
      here.at(i).drop("card has no title");
      return;
    }
    const bad = [card.action, card.secondary].find((a) => a?.run && actsBeforeTheModel(a.run));
    if (bad) {
      here.at(i).drop(NO_SEND);
      return;
    }
    items.push(card);
  });
  return items.length ? keepFirst(items, MAX_CARDS, here, "cards") : [];
}

/** shelves: [{label, items}]; a shelf without a label or without a drawable card is noted and left out. */
function readShelves(raw: any[], here: Trail): CardShelf[] | undefined {
  const shelves: CardShelf[] = [];
  raw.forEach((shelf: any, i: number) => {
    const label = shelf && typeof shelf === "object" ? str(shelf.label, 60) : undefined;
    if (!label) {
      here.at(i).drop("shelf has no label");
      return;
    }
    const items = Array.isArray(shelf.items) ? readList(shelf.items, here.at(i).at("items")) : [];
    if (!items.length) {
      here.at(i).drop("shelf has no card with a title");
      return;
    }
    shelves.push({ label, items });
  });
  return shelves.length ? shelves : undefined;
}

function readCard(item: any): CardItem | null {
  if (!item || typeof item !== "object") return null;
  const title = str(item.title, 80);
  if (!title) return null;
  return clean({
    title,
    id: str(item.id, 40),
    status: status(item.status),
    span: item.span === 1 || item.span === 2 ? (item.span as 1 | 2) : undefined,
    ring: readRing(item.ring),
    metrics: readMetrics(item.metrics),
    needs: readNeeds(item.needs),
    freshness: str(item.freshness, 60),
    stale: typeof item.stale === "boolean" ? item.stale : undefined,
    tags: readTags(item.tags),
    action: readAction(item.action),
    secondary: readAction(item.secondary),
    owner: str(item.owner, 40),
    milestone: str(item.milestone, 60),
    trend: str(item.trend, 20),
    budget: str(item.budget, 40),
    arr: str(item.arr, 40),
  });
}

function readRing(v: any): CardRing | undefined {
  if (!v || typeof v !== "object" || !Array.isArray(v.stages)) return undefined;
  const stages = v.stages
    .filter((s: unknown) => typeof s === "string" && s.trim() !== "")
    .map((s: string) => s.trim().slice(0, 24))
    .slice(0, 4);
  if (stages.length !== 4) return undefined;
  const at = Number.isInteger(v.at) && v.at >= 0 && v.at <= 3 ? (v.at as number) : undefined;
  const size = ringSize(v.size);
  return clean({ stages, at, label: str(v.label, 24), tone: tone(v.tone), size });
}

function readMetrics(v: any): CardMetric[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CardMetric[] = [];
  for (const m of v) {
    if (!m || typeof m !== "object") continue;
    const label = str(m.label, 60);
    const value = str(m.value, 60) ?? (num(m.value) !== null ? String(m.value) : undefined);
    if (!label || value === undefined) continue;
    out.push(clean({ label, value, tone: tone(m.tone), trend: readTrend(m.trend) }));
    if (out.length >= MAX_METRICS) break;
  }
  return out.length ? out : undefined;
}

/** A metric's trend: its finite numbers, the latest 60 at most; nothing with fewer than 2 (omitted silently).
 *  [0.4, "0.5", null, 0.75] → [0.4, 0.75];  [1] → undefined;  "1,2" → undefined */
function readTrend(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const numbers = v.map(num).filter((n): n is number => n !== null);
  return numbers.length >= TREND_FEWEST ? numbers.slice(-TREND_MOST) : undefined;
}

/** Up to three tiny labels ("blocked", "no evidence"), each cut to 24 characters; an empty list says nothing. */
function readTags(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const tags: string[] = [];
  for (const tag of v) {
    const text = str(tag, TAG_CHARS);
    if (text) tags.push(text);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags.length ? tags : undefined;
}

function readNeeds(v: any): CardNeeds | undefined {
  if (!v || typeof v !== "object") return undefined;
  const text = str(v.text, 160);
  return text ? clean({ text, tone: tone(v.tone) }) : undefined;
}

/** An action or the card's quieter secondary: a short label, and either a message for the composer or a link.
 *  The link follows safeLink: https anywhere, http only on this machine (the consumer's loopback Mission Control). */
function readAction(v: any): CardAction | undefined {
  if (!v || typeof v !== "object") return undefined;
  const label = str(v.label, 60);
  if (!label) return undefined;
  return clean({ label, run: str(v.run, 300), url: safeLink(v.url) });
}
