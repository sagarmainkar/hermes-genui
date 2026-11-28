// gauge: one value on a half-circle scale against a target, with qualitative bands (poor / fair / good).
// Reading: spec.series[0].data[0] is the value; spec.min / spec.max set the scale; spec.target marks the goal;
// spec.bands (absolute values) draw the background bands. Nothing here invents a value — a missing number shows "–".
import { fmt, type ChartSpec } from "./chartData";

const R = 66;
const CX = 84;
const CY = 84;
const SW = 13;

function point(t: number): [number, number] {
  const angle = Math.PI * (1 - t); // 1 → left (180°), 0 → right (0°)
  return [CX + R * Math.cos(angle), CY - R * Math.sin(angle)];
}

function arcPath(from: number, to: number): string {
  const [x0, y0] = point(from);
  const [x1, y1] = point(to);
  const large = Math.abs(to - from) > 0.5 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
}

export function Gauge({ spec }: { spec: ChartSpec }) {
  const raw = spec.series[0]?.data[0] ?? null;
  const value = typeof raw === "number" && isFinite(raw) ? raw : null;
  const min = typeof spec.min === "number" ? spec.min : 0;
  const max = typeof spec.max === "number" && spec.max > min ? spec.max : Math.max(min + 1, value ?? 0, spec.target ?? 0);
  const target = typeof spec.target === "number" ? spec.target : undefined;
  const clamp = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min || 1)));
  const bands = spec.bands && spec.bands.length ? spec.bands.map(clamp) : [0.5, 0.8, 1];
  const shown = value === null ? null : value;
  const at = shown === null ? 0 : clamp(shown);
  const toneAt = shown === null ? "hb-gauge-value" : target !== undefined && shown >= target ? "hb-gauge-value hb-gauge-hit" : "hb-gauge-value";

  return (
    <figure className="hb-gauge">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <svg className="hb-gauge-svg" viewBox="0 0 168 104" role="img" aria-label={aria(spec, shown, min, max, target)}>
        <path className="hb-gauge-track" d={arcPath(1, 0)} stroke="var(--hb-line)" fill="none" strokeWidth={SW} strokeLinecap="round" />
        {bands.map((b, i) => {
          const from = i === 0 ? 0 : bands[i - 1];
          return <path key={i} className="hb-gauge-band" d={arcPath(from, b)} stroke={`var(--hb-chart-${i + 1})`} fill="none" strokeWidth={SW} strokeOpacity={0.18} strokeLinecap="butt" />;
        })}
        {shown !== null && <path className={toneAt} d={arcPath(0, at)} stroke="var(--hb-accent)" fill="none" strokeWidth={SW} strokeLinecap="round" />}
        {target !== undefined && (() => {
          const [tx, ty] = point(clamp(target));
          const [ax, ay] = point(clamp(target));
          const dx = ax - CX, dy = ay - CY;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          return <line className="hb-gauge-target" x1={tx - ux * (SW / 2 + 3)} y1={ty - uy * (SW / 2 + 3)} x2={tx + ux * (SW / 2 + 3)} y2={ty + uy * (SW / 2 + 3)} stroke="var(--hb-ink)" strokeWidth={2.5} strokeLinecap="round" />;
        })()}
        <text className="hb-gauge-big" x={CX} y={CY - 4} textAnchor="middle">{shown === null ? "–" : fmt(shown, spec.unit)}</text>
        <text className="hb-gauge-sub" x={CX} y={CY + 12} textAnchor="middle">{target !== undefined ? `target ${fmt(target, spec.unit)}` : ""}</text>
        <text className="hb-gauge-min" x={point(1)[0]} y={CY + 16} textAnchor="middle">{fmt(min, spec.unit)}</text>
        <text className="hb-gauge-max" x={point(0)[0]} y={CY + 16} textAnchor="middle">{fmt(max, spec.unit)}</text>
      </svg>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}

function aria(spec: ChartSpec, value: number | null, min: number, max: number, target?: number): string {
  const name = spec.title || "Gauge";
  const v = value === null ? "no value" : fmt(value, spec.unit);
  const t = target !== undefined ? `, target ${fmt(target, spec.unit)}` : "";
  return `${name}: ${v} on a scale ${fmt(min, spec.unit)} to ${fmt(max, spec.unit)}${t}`;
}
