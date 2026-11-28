// tasks: work-order / action-item cards. A status box, a title, and a meta line (owner · due · priority).
import { actsBeforeTheModel, clean, keepFirst, NO_SEND, str, type Trail } from "../../core/fields";

export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type TaskPriority = "low" | "med" | "high";
export type TaskItem = { title: string; owner?: string; due?: string; status?: TaskStatus; priority?: TaskPriority; note?: string; run?: string };
export type TasksBlock = { type: "tasks"; title?: string; items: TaskItem[] };

const MAX_TASKS = 40;
const STATUSES = ["todo", "doing", "blocked", "done"] as const;
const PRIORITIES = ["low", "med", "high"] as const;

function status(v: unknown): TaskStatus | undefined {
  if (typeof v !== "string") return undefined;
  const w = v.trim().toLowerCase();
  return (STATUSES as readonly string[]).includes(w) ? (w as TaskStatus) : undefined;
}
function priority(v: unknown): TaskPriority | undefined {
  if (typeof v !== "string") return undefined;
  const w = v.trim().toLowerCase();
  return (PRIORITIES as readonly string[]).includes(w) ? (w as TaskPriority) : undefined;
}

/** tasks: 1-40 action items; each needs a title. A run that would act before the model drops the task (NO_SEND). */
export function readTasks(raw: any, here: Trail): TasksBlock | null {
  const list = Array.isArray(raw.items) ? raw.items : undefined;
  if (!list) return here.drop("tasks needs items");
  const items: TaskItem[] = [];
  list.forEach((item: any, i: number) => {
    const title = item && typeof item === "object" ? str(item.title, 140) : undefined;
    if (!title) { here.at("items").at(i).drop("task needs a title"); return; }
    if (actsBeforeTheModel(item.run)) { here.at("items").at(i).drop(NO_SEND); return; }
    items.push(clean({
      title, owner: str(item.owner, 40), due: str(item.due, 40), status: status(item.status),
      priority: priority(item.priority), note: str(item.note, 200), run: str(item.run, 300),
    }));
  });
  if (!items.length) return here.drop("tasks has no titled task");
  return clean({ type: "tasks" as const, title: str(raw.title, 80), items: keepFirst(items, MAX_TASKS, here, "tasks") });
}
