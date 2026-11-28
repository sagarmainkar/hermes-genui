// A compact wall of project cards — one visual unit per project, so a whole portfolio is one block. Each card carries a
// title, an optional id, a status chip with up to three tiny tags, a lifecycle ring, up to three metrics, what needs
// the owner, freshness and one action (plus a quieter second one). Cards come as one list, or as labelled shelves.
import { useContext } from "react";
import { BlockActions } from "../../host/actions";
import type { CardItem, CardRing, CardShelf, CardsBlock } from "./read";

// A status chip borrows the tone vocabulary; "unknown" is never good, never blank (see needs line).
const STATUS_TONE: Record<string, string> = { active: "good", done: "good", parked: "warn", archived: "neutral" };
const RING_STROKE: Record<string, string> = {
  good: "var(--hb-good)", warn: "var(--hb-warn)", bad: "var(--hb-warn)", neutral: "var(--hb-accent)",
};

/** How the wall's tracks are counted: the model's explicit 1/2/3, or "auto" when the board said nothing (the old
 *  auto-fit, so boards written before `columns` existed draw exactly as they did). */
type Layout = 1 | 2 | 3 | "auto";

/** A span-2 card fills the row on the two-up wall — stated `columns: 2`, or no columns at all, because the wall's
 *  default is two. On one or three columns the span is ignored, not refused. */
function spanFillsRow(layout: Layout): boolean {
  return layout === 2 || layout === "auto";
}

export function Cards({ items, columns, shelves }: CardsBlock) {
  const layout: Layout = columns === 1 ? 1 : columns === 2 ? 2 : columns === 3 ? 3 : "auto";
  if (shelves && shelves.length) {
    return (
      <div className="hb-cards-shelves">
        {shelves.map((shelf, i) => <Shelf key={i} shelf={shelf} layout={layout} />)}
      </div>
    );
  }
  return <Wall cards={items ?? []} layout={layout} />;
}

/** The wall itself. Two- and three-up are measured against the wall's own width, not the window's: the same board has
 *  to work in a chat column, in the Mission Control pane and in the webapp (see cards.css). A wall carrying a hero is
 *  measured too, so the ordinary cards beside it stay two-up and collapse to one on a narrow pane. */
function Wall({ cards, layout }: { cards: CardItem[]; layout: Layout }) {
  const hero = spanFillsRow(layout) && cards.some((card) => card.span === 2);
  const grid = (
    <div className={hero ? `hb-cards hb-cards-${layout} hb-cards-hero` : `hb-cards hb-cards-${layout}`}>
      {cards.map((card, i) => <Card key={i} card={card} layout={layout} />)}
    </div>
  );
  return layout === 3 || hero ? <div className="hb-cards-frame">{grid}</div> : grid;
}

/** One labelled group of cards: a small heading and the same grid the plain wall draws. */
function Shelf({ shelf, layout }: { shelf: CardShelf; layout: Layout }) {
  return (
    <section className="hb-card-shelf" aria-label={shelf.label}>
      <h4 className="hb-card-shelf-label">{shelf.label}</h4>
      <Wall cards={shelf.items} layout={layout} />
    </section>
  );
}

function Card({ card, layout }: { card: CardItem; layout: Layout }) {
  const { send } = useContext(BlockActions);
  const band = card.ring || (card.metrics && card.metrics.length);
  const action = card.action;
  const secondary = card.secondary;
  // A full-row card is only meaningful on a two-up wall; on one or three columns the span is ignored, not refused.
  const wide = card.span === 2 && spanFillsRow(layout);
  return (
    <article className={wide ? "hb-card hb-card-wide" : "hb-card"} aria-label={cardLabel(card)}>
      <header className="hb-card-head">
        <div className="hb-card-titles">
          <h3 className="hb-card-title">{card.title}</h3>
          {card.id && <div className="hb-card-id">{card.id}</div>}
        </div>
        {card.status && <span className={`hb-card-chip hb-tone-${STATUS_TONE[card.status] ?? "neutral"}`}>{card.status}</span>}
        {card.tags && card.tags.length > 0 && (
          <ul className="hb-card-tags" aria-label="tags">
            {card.tags.map((tag, i) => <li className="hb-card-tag" key={i}>{tag}</li>)}
          </ul>
        )}
      </header>

      {band && (
        <div className="hb-card-band">
          {card.ring && <Ring ring={card.ring} />}
          {card.metrics && card.metrics.length > 0 && (
            <dl className="hb-card-metrics">
              {card.metrics.map((m, i) => (
                <div className="hb-card-metric" key={i}>
                  <dt>{m.label}</dt>
                  <dd className={isUnknownWord(m.value) ? "hb-tone-neutral" : `hb-tone-${m.tone ?? "neutral"}`}>
                    <span className="hb-card-value">{m.value}</span>
                    {m.trend && m.trend.length > 1 && <Sparkline values={m.trend} />}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <Facts card={card} />

      <NeedsLine card={card} />

      {(card.freshness || card.stale || action || secondary) && (
        <footer className="hb-card-foot">
          <span className={card.stale ? "hb-card-fresh hb-card-fresh-dim" : "hb-card-fresh"}>{card.freshness ?? ""}</span>
          {card.stale && <span className="hb-card-stale">stale</span>}
          {(action || secondary) && (
            <span className="hb-card-acts">
              {action && (action.run
                ? <button type="button" className="hb-card-action" onClick={() => send(action.run!)}>{action.label}</button>
                : action.url
                  ? <a className="hb-card-action" href={action.url} target="_blank" rel="noreferrer">{action.label}</a>
                  : null)}
              {secondary && (secondary.run
                ? <button type="button" className="hb-card-secondary" onClick={() => send(secondary.run!)}>{secondary.label}</button>
                : secondary.url
                  ? <a className="hb-card-secondary" href={secondary.url} target="_blank" rel="noreferrer">{secondary.label}</a>
                  : null)}
            </span>
          )}
        </footer>
      )}
    </article>
  );
}

function Facts({ card }: { card: CardItem }) {
  const rows: [string, string | undefined][] = [
    ["owner", card.owner], ["milestone", card.milestone], ["trend", card.trend], ["budget", card.budget], ["ARR", card.arr],
  ];
  const shown = rows.filter(([, v]) => v) as [string, string][];
  if (!shown.length) return null;
  return (
    <dl className="hb-card-facts">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd className={k === "trend" ? trendTone(v) : undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function trendTone(v: string): string {
  const t = v.trim();
  const down = t.startsWith("-") || /down|▼|↓/i.test(t);
  const up = t.startsWith("+") || /up|▲|↑/i.test(t);
  return `hb-tone-${down ? "bad" : up ? "good" : "neutral"}`;
}

/** The needs line: what needs the owner (tone-coloured), or a calm `clear` — but `unknown` whenever any value on the
 *  card positively reports unknown, because an unknown is a value, never a clean bill of health. */
function NeedsLine({ card }: { card: CardItem }) {
  if (card.needs?.text) {
    return <p className={`hb-card-needs hb-tone-${card.needs.tone ?? "warn"}`}><span className="hb-card-dot" />{card.needs.text}</p>;
  }
  const word = cardIsUnknown(card) ? "unknown" : "clear";
  return <p className={`hb-card-needs hb-tone-${word === "unknown" ? "neutral" : "good"}`}><span className="hb-card-dot" />{word}</p>;
}

/** A four-segment lifecycle ring; the current stage is emphasised, the centre names the current word. `size: "sm"`
 *  draws the same drawing at 28px for narrow cards, with the metrics column kept where it was. */
function Ring({ ring }: { ring: CardRing }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const arc = (circumference / 4) * 0.9;
  const centre = ring.label
    ?? (ring.at !== undefined ? ring.stages[ring.at] : "unknown");
  const stroke = RING_STROKE[ring.tone ?? "neutral"] ?? "var(--hb-accent)";
  const small = ring.size === "sm";
  const box = small ? 28 : 40;
  return (
    <svg
      className={small ? "hb-card-ring hb-card-ring-sm" : "hb-card-ring"}
      viewBox="0 0 40 40"
      width={box}
      height={box}
      role="img"
      aria-label={ringLabel(ring)}
    >
      {ring.stages.map((_, i) => {
        const current = ring.at === i;
        return (
          <circle
            key={i}
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={current ? stroke : "var(--hb-line-strong, var(--hb-line))"}
            strokeOpacity={current ? 1 : 0.55}
            strokeWidth={current ? 4.6 : 3}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference - arc}`}
            transform={`rotate(${i * 90 - 90} 20 20)`}
          />
        );
      })}
      <text x="20" y="22.5" textAnchor="middle" className="hb-card-ring-label">{centre.slice(0, 7)}</text>
    </svg>
  );
}

// A metric's sparkline: 20px tall, no axes and no labels (the value already says the number, so it is hidden from
// screen readers), drawn in one colour from the theme.
const SPARK_W = 64;
const SPARK_H = 20;

/** One trend's line across the small box; a flat trend runs across the middle. The latest point is on the right. */
function sparkPath(values: number[]): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = 1.5;
  const span = SPARK_H - 2 * pad;
  const y = (v: number) => (hi === lo ? SPARK_H / 2 : pad + (1 - (v - lo) / (hi - lo)) * span);
  const x = (i: number) => (i / (values.length - 1)) * SPARK_W;
  return values.map((v, i) => `${i ? "L" : "M"}${round(x(i))} ${round(y(v))}`).join("");
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function Sparkline({ values }: { values: number[] }) {
  return (
    <svg className="hb-card-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={sparkPath(values)} />
    </svg>
  );
}

function isUnknownWord(value: string): boolean {
  return value.trim().toLowerCase() === "unknown";
}

function cardIsUnknown(card: CardItem): boolean {
  const metricUnknown = (card.metrics ?? []).some((m) => isUnknownWord(m.value));
  const ringUnknown = card.ring?.label ? isUnknownWord(card.ring.label) : false;
  return metricUnknown || ringUnknown;
}

function ringLabel(ring: CardRing): string {
  const path = `Lifecycle ${ring.stages.join(" to ")}`;
  const now = ring.at !== undefined ? `, now ${ring.stages[ring.at]}` : "";
  const health = ring.label ? `, health ${ring.label}` : "";
  return `${path}${now}${health}`;
}

function cardLabel(card: CardItem): string {
  const status = card.status ? `, ${card.status}` : "";
  const needs = card.needs?.text ? `, needs you: ${card.needs.text}` : "";
  const tags = card.tags && card.tags.length ? `, ${card.tags.join(", ")}` : "";
  const stale = card.stale ? ", stale" : "";
  return `${card.title}${status}${needs}${tags}${stale}`;
}
