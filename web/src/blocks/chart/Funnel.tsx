// funnel: ordered stages, each narrower than the one before, with the step conversion printed between rows.
// spec.x are the stage labels in order; spec.series[0].data are their counts (a null stage is skipped).
import { fmt, type ChartSpec } from "./chartData";

export function Funnel({ spec }: { spec: ChartSpec }) {
  const data = spec.series[0]?.data ?? [];
  const rows = spec.x
    .map((label, i) => ({ label, v: typeof data[i] === "number" ? (data[i] as number) : null }))
    .filter((r) => r.v !== null && (r.v as number) >= 0) as { label: string; v: number }[];
  const max = Math.max(1, ...rows.map((r) => r.v));

  return (
    <figure className="hb-funnel">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <ol className="hb-funnel-rows">
        {rows.map((r, i) => {
          const prev = i > 0 ? rows[i - 1].v : r.v;
          const conv = i > 0 && prev > 0 ? Math.round((r.v / prev) * 100) : null;
          const share = Math.max(4, (r.v / max) * 100);
          return (
            <li className="hb-funnel-row" key={i}>
              <span className="hb-funnel-label">{r.label}</span>
              <span className="hb-funnel-track">
                <span className="hb-funnel-bar" style={{ width: `${share}%` }}>
                  <span className="hb-funnel-value">{fmt(r.v, spec.unit)}</span>
                </span>
              </span>
              <span className="hb-funnel-conv">{conv === null ? "" : `${conv}%`}</span>
            </li>
          );
        })}
      </ol>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
