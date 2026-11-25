// The drill-down detail: one datum of a chart, focused, over the whole window. It borrows the images strip's
// full-size overlay pattern (blocks/images/Images.tsx): a scrim, a close control in the corner, Escape anywhere,
// a click on the scrim. What it shows is what the hover card knew — the datum's label, each series's full value,
// a note (a pie's share, a scatter point's own place in the drawing, a bridge bar's balance) and the chart's own
// source — but held still, big enough to read, until you leave. The drawing behind it is NEVER re-instantiated:
// the chart mounts this beside itself as one instance, and while it is up the dialog owns the keyboard (Escape,
// and Tab that stays on the close control). Beside the figure, not inside the card: a card that transforms or
// contains its own box would shrink a fixed overlay mounted within it to the card (Chrome measures that;
// tests/test_chart_drilldown_overlay.py keeps it so).
import { useEffect, useRef } from "react";
import { isTopLayer, popLayer, pushLayer } from "../../core/overlays";
import type { ChartKind } from "./chartData";
import type { TipRow } from "./ChartTip";

/** What the detail says about one datum. */
export type Detail = {
  /** the datum itself: a label, a point, a slice name */
  datum: string;
  chartTitle?: string;
  /** what the drawing calls one of its pieces: Column, Point, Slice, Row, Step… */
  kind: string;
  rows: TipRow[];
  note?: string;
  source?: string;
};

/** One word for one piece of each drawing, used as the detail's kicker. A waterfall says "Step" for a move and
 *  "Total" for a pinned balance — its drawing works that out per bar, from the same words its hover card uses. */
export const KIND_WORDS: Record<ChartKind, string> = {
  line: "Point", bar: "Column", area: "Point", stacked: "Part", hbar: "Row", combo: "Point",
  pie: "Slice", donut: "Slice", scatter: "Point", waterfall: "Step",
};

export function ChartDetail({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  // The dialog IS its mount: one instance, mounted and unmounted as the drill opens and closes. It takes the
  // top of the overlay stack for exactly as long as it is up — over it only a photo can sit (core/overlays.ts).
  const layer = useRef(0);
  useEffect(() => {
    const id = pushLayer();
    layer.current = id;
    return () => popLayer(id);
  }, []);

  useEffect(() => {
    close.current?.focus();  // the dialog owns the keyboard from its first frame
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Whatever opened over this dialog — a photo — sits on top; the key answers the topmost layer first.
        if (!isTopLayer(layer.current)) return;
        e.stopImmediatePropagation();  // one keypress steps down exactly one layer, never two
        onClose();
      } else if (e.key === "Tab") {
        if (!isTopLayer(layer.current)) return;  // the trap belongs to the topmost dialog alone
        e.preventDefault();  // the close control is the dialog's only stop
        e.stopImmediatePropagation();
        close.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="hb-chart-detail" role="dialog" aria-modal="true" aria-label={`Chart details: ${detail.datum}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button ref={close} type="button" className="hb-overlay-close" aria-label="Close chart details" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div className="hb-chart-detail-card">
        <div className="hb-chart-detail-where">{detail.kind}{detail.chartTitle ? ` · ${detail.chartTitle}` : ""}</div>
        <div className="hb-chart-detail-title">{detail.datum}</div>
        {detail.rows.map((row, k) => (
          <div key={k} className="hb-detail-row">
            <i style={{ background: row.colour }} />
            <span className="hb-detail-name">{row.name}</span>
            <b className="hb-detail-value">{row.value}</b>
          </div>
        ))}
        {detail.note && <div className="hb-detail-note">{detail.note}</div>}
        {detail.source && <div className="hb-detail-source">{detail.source}</div>}
      </div>
    </div>
  );
}
