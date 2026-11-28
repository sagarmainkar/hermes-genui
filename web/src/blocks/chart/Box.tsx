// box plot: median, quartiles and whiskers per group, from each series' raw values (one series per group).
// series[k].data are that group's raw numbers; spec.x[k] (or the series name) labels it.
import { fmt, type ChartSpec } from "./chartData";

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[Math.min(base + 1, sorted.length - 1)];
  return sorted[base] + (next - sorted[base]) * rest;
}

export function Box({ spec }: { spec: ChartSpec }) {
  const groups = spec.series
    .map((s, k) => ({
      label: (spec.x[k] as string) ?? s.name ?? `Group ${k + 1}`,
      values: s.data.filter((v): v is number => typeof v === "number").sort((a, b) => a - b),
    }))
    .filter((g) => g.values.length);
  const all = groups.flatMap((g) => g.values);
  if (!all.length) return null;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const Y = (v: number) => 96 - ((v - lo) / span) * 90;
  const w = 100 / groups.length;

  return (
    <figure className="hb-box">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <svg className="hb-box-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
        aria-label={`${spec.title ?? "Box plot"} across ${groups.length} groups`}>
        {groups.map((g, k) => {
          const q1 = quantile(g.values, 0.25);
          const med = quantile(g.values, 0.5);
          const q3 = quantile(g.values, 0.75);
          const mn = g.values[0];
          const mx = g.values[g.values.length - 1];
          const cx = (k + 0.5) * w;
          return (
            <g key={k}>
              <line x1={cx} y1={Y(mn)} x2={cx} y2={Y(mx)} stroke="var(--hb-ink-2)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              <line x1={cx - w * 0.12} y1={Y(mx)} x2={cx + w * 0.12} y2={Y(mx)} stroke="var(--hb-ink-2)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              <line x1={cx - w * 0.12} y1={Y(mn)} x2={cx + w * 0.12} y2={Y(mn)} stroke="var(--hb-ink-2)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              <rect x={cx - w * 0.26} y={Y(q3)} width={w * 0.52} height={Math.max(0.6, Y(q1) - Y(q3))}
                fill="var(--hb-accent-soft)" stroke="var(--hb-accent)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              <line x1={cx - w * 0.26} y1={Y(med)} x2={cx + w * 0.26} y2={Y(med)} stroke="var(--hb-accent)" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      <div className="hb-box-axis">
        {groups.map((g, k) => <span key={k} className="hb-box-label" style={{ width: `${w}%` }}>{g.label}</span>)}
      </div>
      <div className="hb-box-note">median of medians {fmt(quantile(all.slice().sort((a, b) => a - b), 0.5), spec.unit)}</div>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
