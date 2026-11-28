// treemap: parts of a whole as nested rectangles, area proportional to value; the biggest read first.
// spec.x are the labels; series[0].data their positive values (non-positive values are dropped).
import { fmt, partColour, type ChartSpec } from "./chartData";

type Rect = { x: number; y: number; w: number; h: number };

function layout(items: number[], x: number, y: number, w: number, h: number, out: Rect[]): void {
  if (items.length === 1) { out.push({ x, y, w, h }); return; }
  const total = items.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  let split = 1;
  for (let i = 0; i < items.length - 1; i += 1) {
    acc += items[i];
    if (acc >= total / 2) { split = i + 1; break; }
  }
  if (split >= items.length) split = items.length - 1;
  const left = items.slice(0, split);
  const right = items.slice(split);
  const frac = left.reduce((a, b) => a + b, 0) / total;
  if (w >= h) {
    layout(left, x, y, w * frac, h, out);
    layout(right, x + w * frac, y, w * (1 - frac), h, out);
  } else {
    layout(left, x, y, w, h * frac, out);
    layout(right, x, y + h * frac, w, h * (1 - frac), out);
  }
}

export function Treemap({ spec }: { spec: ChartSpec }) {
  const data = spec.series[0]?.data ?? [];
  const items = spec.x
    .map((label, i) => ({ label, v: data[i] }))
    .filter((d): d is { label: string; v: number } => typeof d.v === "number" && d.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = items.reduce((s, d) => s + d.v, 0);
  if (!items.length) return null;
  const rects: Rect[] = [];
  layout(items.map((d) => d.v), 0, 0, 100, 100, rects);

  return (
    <figure className="hb-treemap">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <div className="hb-treemap-field" role="img" aria-label={`${spec.title ?? "Treemap"}: ${items.length} parts`}>
        {items.map((d, i) => {
          const r = rects[i];
          const share = total > 0 ? d.v / total : 0;
          return (
            <div
              key={i}
              className="hb-treemap-cell"
              style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`, background: partColour(i) }}
              title={`${d.label}: ${fmt(d.v, spec.unit)} · ${Math.round(share * 100)}%`}
            >
              <span className="hb-treemap-label">{d.label}</span>
              {r.w > 20 && r.h > 22 && <span className="hb-treemap-value">{fmt(d.v, spec.unit)}</span>}
            </div>
          );
        })}
      </div>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
