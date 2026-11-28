// suggestions: proposed changes to accept or skip, each with a reason. Accept/Skip send their message.
import { useContext } from "react";
import { BlockActions } from "../../host/actions";
import type { SuggestionsBlock } from "./read";

export function Suggestions({ items, title }: SuggestionsBlock) {
  const { send } = useContext(BlockActions);
  return (
    <figure className="hb-suggestions">
      {title && <figcaption className="hb-chart-title">{title}</figcaption>}
      <ul className="hb-sug-list">
        {items.map((s, i) => (
          <li className="hb-sug" key={i}>
            <span className="hb-sug-text">{s.text}</span>
            {s.reason && <span className="hb-sug-reason">{s.reason}</span>}
            {(s.accept || s.skip) && (
              <span className="hb-sug-actions">
                {s.accept && <button type="button" className="hb-sug-btn hb-sug-accept" onClick={() => send(s.accept!)}>Accept</button>}
                {s.skip && <button type="button" className="hb-sug-btn hb-sug-skip" onClick={() => send(s.skip!)}>Skip</button>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}
