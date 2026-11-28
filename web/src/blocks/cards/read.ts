// cards: a compact wall of project cards — one block for a whole portfolio. Reads stored JSON into safe, drawable cards
// and never invents values: an "unknown" stays the literal word, and nothing is turned into a zero or a blank.
import { actsBeforeTheModel, clean, firstList, https, keepFirst, NO_SEND, str, type Trail } from "../../core/fields";

export type CardTone = "good" | "warn" | "bad" | "neutral";
export type CardRing = { stages: string[]; at?: number; label?: string; tone?: CardTone };
export type CardMetric = { label: string; value: string; tone?: CardTone };
export type CardNeeds = { text: string; tone?: CardTone };
export type CardAction = { label: string; run?: string; url?: string };
export type CardItem = {
  title: string; id?: string; status?: string; ring?: CardRing; metrics?: CardMetric[];
  needs?: CardNeeds; freshness?: string; action?: CardAction;
  owner?: string; milestone?: string; trend?: string; budget?: string; arr?: string;
};
export type CardsBlock = { type: "cards"; columns?: 1 | 2; items: CardItem[] };

const MAX_CARDS = 14;
const MAX_METRICS = 3;
const STATUSES = ["active", "parked", "done", "archived"] as const;
const TONES = ["good", "warn", "bad", "neutral"] as const;

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

/**
 * cards: 1-14 project cards (items, also `cards`). Each needs a title; the ring, metrics, needs and action are read only
 * when well shaped. An action whose run would act before the model (/ @ !) drops the whole card, noted NO_SEND.
 *   {type: "cards", items: [{title: "Mission Control", status: "active"}, {subtitle: "no title"}]}
 *   → {type: "cards", items: [{title: "Mission Control", status: "active"}]}
 */
export function readCards(raw: any, here: Trail): CardsBlock | null {
  const list = firstList([raw.items, raw.cards]);
  if (!list) return here.drop("cards needs items");
  const items: CardItem[] = [];
  list.forEach((item, i) => {
    const card = readCard(item);
    if (!card) {
      here.at("items").at(i).drop("card has no title");
      return;
    }
    if (card.action?.run && actsBeforeTheModel(card.action.run)) {
      here.at("items").at(i).drop(NO_SEND);
      return;
    }
    items.push(card);
  });
  if (!items.length) return here.drop("cards has no card with a title");
  const columns: 1 | 2 | undefined = raw.columns === 1 ? 1 : raw.columns === 2 ? 2 : undefined;
  return clean({ type: "cards" as const, columns, items: keepFirst(items, MAX_CARDS, here, "cards") });
}

function readCard(item: any): CardItem | null {
  if (!item || typeof item !== "object") return null;
  const title = str(item.title, 80);
  if (!title) return null;
  return clean({
    title,
    id: str(item.id, 40),
    status: status(item.status),
    ring: readRing(item.ring),
    metrics: readMetrics(item.metrics),
    needs: readNeeds(item.needs),
    freshness: str(item.freshness, 60),
    action: readAction(item.action),
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
  return clean({ stages, at, label: str(v.label, 24), tone: tone(v.tone) });
}

function readMetrics(v: any): CardMetric[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: CardMetric[] = [];
  for (const m of v) {
    if (!m || typeof m !== "object") continue;
    const label = str(m.label, 60);
    const value = str(m.value, 60) ?? (typeof m.value === "number" ? String(m.value) : undefined);
    if (!label || value === undefined) continue;
    out.push(clean({ label, value, tone: tone(m.tone) }));
    if (out.length >= MAX_METRICS) break;
  }
  return out.length ? out : undefined;
}

function readNeeds(v: any): CardNeeds | undefined {
  if (!v || typeof v !== "object") return undefined;
  const text = str(v.text, 160);
  return text ? clean({ text, tone: tone(v.tone) }) : undefined;
}

function readAction(v: any): CardAction | undefined {
  if (!v || typeof v !== "object") return undefined;
  const label = str(v.label, 60);
  if (!label) return undefined;
  return clean({ label, run: str(v.run, 300), url: https(v.url) });
}
