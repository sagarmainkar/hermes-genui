// bubble: a scatter with a third number shown as dot size. x places the dots (by value when numeric, else evenly);
// series[0].data is the y value; an optional series[1].data is the bubble size.
import { fmt, partColour, seriesName, type ChartSpec } from "./chartData";

export function Bubble({ spec }: { spec: ChartSpec }) {
  const ys = spec.series[0]?.data ?? [];
  const sizes = spec.series[1]?.data ?? [];
  const numericX = spec.x.every((x) => typeof x === "number" || (typeof x === "string" && x.trim() !== "" && isFinite(Number(x))));
  const xs = spec.x.map((x) => Number(x));
  const data = spec.x
    .map((_, i) => ({ x: numericX ? xs[i] : i, y: ys[i], s: sizes[i] }))
    .filter((p): p is { x: number; y: number; s: number | null } => typeof p.y === "number");
  if (!data.length) return null;

  const xLo = numericX ? Math.min(...data.map((d) => d.x)) : 0;
  const xHi = numericX ? Math.max(...data.map((d) => d.x)) : data.length - 1;
  const yLo = Math.min(...data.map((d) => d.y));
  const yHi = Math.max(...data.map((d) => d.y));
  const sizeMax = Math.max(1, ...data.map((d) => (typeof d.s === "number" ? d.s : 0)));
  const xSpan = xHi - xLo || 1;
  const ySpan = yHi - yLo || 1;
  const X = (v: number) => 6 + (numericX ? ((v - xLo) / xSpan) * 88 : (data.length <= 1 ? 44 : (v / (data.length - 1)) * 88));
  const Y = (v: number) => 94 - ((v - yLo) / ySpan) * 88;
  const radius = (s: number | null) => (typeof s === "number" ? 2 + Math.sqrt(s / sizeMax) * 7 : 4);

  return (
    <figure className="hb-bubble">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <svg className="hb-bubble-svg" viewBox="0 0 100 100" role="img"
        aria-label={`${spec.title ?? "Bubble"}: ${data.length} points`}>
        {data.map((d, i) => (
          <circle key={i} cx={X(d.x)} cy={Y(d.y)} r={radius(d.s)} fill={partColour(0)} fillOpacity={0.35}
            stroke={partColour(0)} strokeWidth={0.6} vectorEffect="non-scaling-stroke">
            <title>{`${spec.x[i] ?? `Point ${i + 1}`}: ${fmt(d.y, spec.unit)}${typeof d.s === "number" ? ` · size ${fmt(d.s)}` : ""}`}</title>
          </circle>
        ))}
      </svg>
      <div className="hb-bubble-legend">{seriesName(spec.series, 0)}{spec.series[1] ? ` · bubble size = ${seriesName(spec.series, 1)}` : ""}</div>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
