// pareto: the vital few — categories sorted largest-first as bars, with the running cumulative share as a line.
// spec.x are the category names; spec.series[0].data their values (non-positive values are dropped).
import { fmt, type ChartSpec } from "./chartData";

export function Pareto({ spec }: { spec: ChartSpec }) {
  const data = spec.series[0]?.data ?? [];
  const items = spec.x
    .map((label, i) => ({ label, v: data[i] }))
    .filter((d): d is { label: string; v: number } => typeof d.v === "number" && d.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = items.reduce((s, d) => s + d.v, 0);
  const max = items[0]?.v ?? 1;
  let running = 0;
  const cumulative = items.map((d) => {
    running += d.v;
    return total > 0 ? running / total : 0;
  });
  const n = items.length;
  const step = n > 0 ? 100 / n : 100;

  if (!n) return null;

  const points = cumulative.map((c, i) => `${(i + 0.5) * step},${100 - c * 100}`).join(" ");

  return (
    <figure className="hb-pareto">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <div className="hb-pareto-plot">
        <svg className="hb-pareto-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} fill="none" stroke="var(--hb-accent)" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="hb-pareto-bars">
          {items.map((d, i) => (
            <div
              className="hb-pareto-bar"
              key={i}
              style={{ height: `${(d.v / max) * 100}%`, width: `${step * 0.7}%` }}
              title={`${d.label}: ${fmt(d.v, spec.unit)} · ${Math.round(cumulative[i] * 100)}% cumulative`}
            >
              <span className="hb-pareto-bar-fill" />
            </div>
          ))}
        </div>
      </div>
      <div className="hb-pareto-axis">
        {items.map((d, i) => <span key={i} className="hb-pareto-label" style={{ width: `${step}%` }}>{d.label}</span>)}
      </div>
      <div className="hb-pareto-cum">
        {items.map((_, i) => <span key={i} className="hb-pareto-cum-cell" style={{ width: `${step}%` }}>{Math.round(cumulative[i] * 100)}%</span>)}
      </div>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
