// bullet: a thin actual-vs-target strip per row, with qualitative bands behind it (Stephen Few's bullet graph).
// series[0] = actual values (one per x label); series[1] (optional) = targets; spec.bands = band maxima (absolute).
import { fmt, type ChartSpec } from "./chartData";

export function Bullet({ spec }: { spec: ChartSpec }) {
  const actual = spec.series[0]?.data ?? [];
  const targets = spec.series[1]?.data ?? [];
  const nums = [...actual, ...targets].filter((v): v is number => typeof v === "number" && isFinite(v));
  const max = Math.max(1, ...nums);
  const bands = spec.bands && spec.bands.length ? spec.bands : [max * 0.5, max * 0.8, max];
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;

  return (
    <figure className="hb-bullet">
      {spec.title && <figcaption className="hb-chart-title">{spec.title}</figcaption>}
      <ul className="hb-bullet-rows">
        {spec.x.map((label, i) => {
          const v = actual[i];
          const t = targets[i];
          const value = typeof v === "number" && isFinite(v) ? v : null;
          const target = typeof t === "number" && isFinite(t) ? t : null;
          return (
            <li className="hb-bullet-row" key={i}>
              <span className="hb-bullet-label">{label}</span>
              <span className="hb-bullet-track" aria-hidden="true">
                {bands.map((b, k) => {
                  const from = k === 0 ? 0 : bands[k - 1];
                  return <span key={k} className="hb-bullet-band" style={{ left: pct(from), width: pct(b - from) }} />;
                })}
                {value !== null && <span className="hb-bullet-value" style={{ width: pct(value) }} />}
                {target !== null && <span className="hb-bullet-target" style={{ left: pct(target) }} />}
              </span>
              <span className="hb-bullet-num">
                {value === null ? "–" : fmt(value, spec.unit)}
                {target !== null && <span className="hb-bullet-goal"> / {fmt(target, spec.unit)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {spec.source && <div className="hb-chart-source">{spec.source}</div>}
    </figure>
  );
}
