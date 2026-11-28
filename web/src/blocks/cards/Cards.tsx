// A compact wall of project cards — one visual unit per project, so a whole portfolio is one block. Each card carries a
// title, an optional id, a status chip, a lifecycle ring, up to three metrics, what needs the owner and one action.
import { useContext } from "react";
import { BlockActions } from "../../host/actions";
import type { CardItem, CardRing, CardsBlock } from "./read";

// A status chip borrows the tone vocabulary; "unknown" is never good, never blank (see needs line).
const STATUS_TONE: Record<string, string> = { active: "good", done: "good", parked: "warn", archived: "neutral" };
const RING_STROKE: Record<string, string> = {
  good: "var(--hb-good)", warn: "var(--hb-warn)", bad: "var(--hb-warn)", neutral: "var(--hb-accent)",
};

export function Cards({ items, columns }: CardsBlock) {
  return (
    <div className={`hb-cards hb-cards-${columns === 1 ? 1 : 2}`}>
      {items.map((card, i) => <Card key={i} card={card} />)}
    </div>
  );
}

function Card({ card }: { card: CardItem }) {
  const { send } = useContext(BlockActions);
  const band = card.ring || (card.metrics && card.metrics.length);
  const action = card.action;
  return (
    <article className="hb-card" aria-label={cardLabel(card)}>
      <header className="hb-card-head">
        <div className="hb-card-titles">
          <h3 className="hb-card-title">{card.title}</h3>
          {card.id && <div className="hb-card-id">{card.id}</div>}
        </div>
        {card.status && <span className={`hb-card-chip hb-tone-${STATUS_TONE[card.status] ?? "neutral"}`}>{card.status}</span>}
      </header>

      {band && (
        <div className="hb-card-band">
          {card.ring && <Ring ring={card.ring} />}
          {card.metrics && card.metrics.length > 0 && (
            <dl className="hb-card-metrics">
              {card.metrics.map((m, i) => (
                <div className="hb-card-metric" key={i}>
                  <dt>{m.label}</dt>
                  <dd className={isUnknownWord(m.value) ? "hb-tone-neutral" : `hb-tone-${m.tone ?? "neutral"}`}>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <Facts card={card} />

      <NeedsLine card={card} />

      {(card.freshness || action) && (
        <footer className="hb-card-foot">
          <span className="hb-card-fresh">{card.freshness ?? ""}</span>
          {action && (action.run
            ? <button type="button" className="hb-card-action" onClick={() => send(action.run!)}>{action.label}</button>
            : action.url
              ? <a className="hb-card-action" href={action.url} target="_blank" rel="noreferrer">{action.label}</a>
              : null)}
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

/** A ~40px four-segment lifecycle ring; the current stage is emphasised, the centre names the current word. */
function Ring({ ring }: { ring: CardRing }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const arc = (circumference / 4) * 0.9;
  const centre = ring.label
    ?? (ring.at !== undefined ? ring.stages[ring.at] : "unknown");
  const stroke = RING_STROKE[ring.tone ?? "neutral"] ?? "var(--hb-accent)";
  return (
    <svg
      className="hb-card-ring"
      viewBox="0 0 40 40"
      width="40"
      height="40"
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
  return `${card.title}${status}${needs}`;
}
