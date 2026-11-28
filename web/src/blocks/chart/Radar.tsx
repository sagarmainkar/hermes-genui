// radar: several measures for one or more items on shared axes radiating from a centre (2-3 series).
// spec.x are the axes; each series holds one value per axis, scaled against the largest value on the chart.
import { fmt, partColour, seriesName, type ChartSpec } from "./chartData";

const CX = 50;
const CY = 50;
const R = 40;

function point(i: number, n: number, r: number): [number, number] {
  const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
  return [CX + Math.cos(angle) * r, CY + Math.sin(angle) * r];
}

export function Radar({ spec }: { spec: ChartSpec }) {
  const axes = spec.x;
  const n = axes.length;
  const series = spec.series.slice(0, 3);
  const max = Math.max(1, ...series.flatMap((s) => s.data.filter((v): v is number => typeof v === "number")));
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <figure className="hb-radar">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <svg className="hb-radar-svg" viewBox="0 0 100 100" role="img" aria-label={`${spec.title ?? "Radar"} across ${axes.join(", ")}`}>
        {rings.map((f) => (
          <polygon key={f} fill="none" stroke="var(--hb-line)" strokeWidth={0.4} vectorEffect="non-scaling-stroke"
            points={axes.map((_, i) => point(i, n, R * f).join(",")).join(" ")} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, n, R);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--hb-line)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />;
        })}
        {series.map((s, k) => (
          <polygon key={k} fill={partColour(k)} fillOpacity={0.16} stroke={partColour(k)} strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            points={axes.map((_, i) => {
              const v = s.data[i];
              const f = typeof v === "number" ? Math.min(1, v / max) : 0;
              return point(i, n, R * f).join(",");
            }).join(" ")} />
        ))}
      </svg>
      <div className="hb-radar-legend">
        {series.map((s, k) => <span key={k} className="hb-radar-key"><i style={{ background: partColour(k) }} />{seriesName(series, k)}: {s.data.filter((v): v is number => typeof v === "number").map((v) => fmt(v, spec.unit)).join(" / ")}</span>)}
      </div>
      <div className="hb-radar-axes">{axes.map((a, i) => <span key={i} className="hb-radar-axis-label">{a}</span>)}</div>
    </figure>
  );
}
