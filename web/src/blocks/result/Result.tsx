// result: a delivered result card — the title, the body, its sources, and the model that made it.
import type { ResultBlock } from "./read";

export function Result({ title, body, sources, model }: ResultBlock) {
  return (
    <figure className="hb-result">
      {title && <figcaption className="hb-result-title">{title}</figcaption>}
      <p className="hb-result-body">{body}</p>
      {sources && sources.length > 0 && (
        <ul className="hb-result-sources">
          {sources.map((s, i) => (
            <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}</li>
          ))}
        </ul>
      )}
      {model && <div className="hb-result-model">by {model}</div>}
    </figure>
  );
}
