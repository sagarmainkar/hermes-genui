// control: a process measure in time order with its centre line and 3-sigma limits — the SPC chart: ordinary
// variation vs a change worth investigating. spec.x are the time labels; series[0].data the measurements.
import { fmt, type ChartSpec } from "./chartData";

export function Control({ spec }: { spec: ChartSpec }) {
  const data = spec.series[0]?.data ?? [];
  const points = data
    .map((v, i) => ({ i, v }))
    .filter((p): p is { i: number; v: number } => typeof p.v === "number");
  const values = points.map((p) => p.v);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const sd = values.length ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) : 0;
  const ucl = mean + 3 * sd;
  const lcl = mean - 3 * sd;
  const lo = Math.min(lcl, ...values);
  const hi = Math.max(ucl, ...values);
  const span = hi - lo || 1;
  const n = data.length || 1;
  const X = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const Y = (v: number) => 100 - ((v - lo) / span) * 100;
  const outside = points.filter((p) => p.v > ucl || p.v < lcl).length;

  return (
    <figure className="hb-control">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <svg className="hb-control-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
        aria-label={`${spec.title ?? "Control chart"}: mean ${fmt(mean, spec.unit)}, ${outside} point(s) outside the limits`}>
        <line x1="0" y1={Y(ucl)} x2="100" y2={Y(ucl)} stroke="var(--hb-warn)" strokeDasharray="3 2" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={Y(mean)} x2="100" y2={Y(mean)} stroke="var(--hb-ink-2)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={Y(lcl)} x2="100" y2={Y(lcl)} stroke="var(--hb-warn)" strokeDasharray="3 2" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        <polyline points={points.map((p) => `${X(p.i)},${Y(p.v)}`).join(" ")} fill="none" stroke="var(--hb-accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {points.map((p) => (
          <circle key={p.i} cx={X(p.i)} cy={Y(p.v)} r={0.9}
            fill={p.v > ucl || p.v < lcl ? "var(--hb-warn)" : "var(--hb-accent)"}
            stroke="var(--hb-surface)" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="hb-control-note">
        mean <strong>{fmt(mean, spec.unit)}</strong> · UCL {fmt(ucl, spec.unit)} · LCL {fmt(lcl, spec.unit)}
        {outside > 0 ? ` · ${outside} outside` : ""}
      </div>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
