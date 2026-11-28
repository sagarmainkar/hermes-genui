// tasks: work-order / action-item cards. A status box, a title, and a meta line (owner · due · priority).
import { useContext } from "react";
import { BlockActions } from "../../host/actions";
import type { TaskItem, TaskStatus, TasksBlock } from "./read";

const GLYPH: Record<TaskStatus, string> = { todo: "○", doing: "◐", blocked: "✕", done: "●" };
const STATUS_TONE: Record<TaskStatus, string> = { todo: "neutral", doing: "good", blocked: "bad", done: "good" };
const PRIORITY_TONE: Record<string, string> = { low: "neutral", med: "warn", high: "bad" };

export function Tasks({ items, title }: TasksBlock) {
  const { send } = useContext(BlockActions);
  return (
    <figure className="hb-tasks">
      {title && <figcaption className="hb-chart-title">{title}</figcaption>}
      <ul className="hb-task-list">
        {items.map((task, i) => <Task key={i} task={task} onRun={task.run ? () => send(task.run!) : undefined} />)}
      </ul>
    </figure>
  );
}

function Task({ task, onRun }: { task: TaskItem; onRun?: () => void }) {
  const status = task.status ?? "todo";
  const body = (
    <>
      <span className={`hb-task-box hb-tone-${STATUS_TONE[status]}`} aria-hidden="true">{GLYPH[status]}</span>
      <span className="hb-task-text">
        <span className={`hb-task-title${status === "done" ? " hb-task-done" : ""}`}>{task.title}</span>
        {(task.owner || task.due || task.priority) && (
          <span className="hb-task-meta">
            {task.owner && <span className="hb-task-owner">{task.owner}</span>}
            {task.due && <span className="hb-task-due">{task.due}</span>}
            {task.priority && <span className={`hb-task-prio hb-tone-${PRIORITY_TONE[task.priority]}`}>{task.priority}</span>}
          </span>
        )}
        {task.note && <span className="hb-task-note">{task.note}</span>}
      </span>
    </>
  );
  const label = `${task.title}, ${status}${task.owner ? `, ${task.owner}` : ""}`;
  return (
    <li className="hb-task" aria-label={label}>
      {onRun
        ? <button type="button" className="hb-task-hit" onClick={onRun}>{body}</button>
        : <div className="hb-task-hit hb-task-static">{body}</div>}
    </li>
  );
}
