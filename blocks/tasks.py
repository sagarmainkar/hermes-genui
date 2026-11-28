"""tasks: work-order / action-item cards — a title, an owner, a due date, a status and a priority."""

from .common import NO_SEND, acts_before_the_model, has_text, safe_text

TASK_MAX = 40
STATUSES = ("todo", "doing", "blocked", "done")
PRIORITIES = ("low", "med", "high")


def check_tasks(block: dict, path: str) -> list[tuple[str, str]]:
    """1-40 tasks, each titled; status and priority are optional but must be on the list when present; a run is guarded.

    {"items": [{"title": "Fix roof", "owner": "Leo", "due": "Fri", "status": "doing"}]} → []
    {"items": [{"title": "X", "status": "started"}]}
        → [(".items.0.status", "status must be todo, doing, blocked or done")]
    """
    items = block.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= TASK_MAX:
        return [(path, f"tasks needs 1-{TASK_MAX} items")]
    problems = []
    for i, item in enumerate(items):
        here = f"{path}.items.{i}"
        if not (isinstance(item, dict) and has_text(item.get("title"))):
            problems.append((here, "task needs a title"))
            continue
        status = item.get("status")
        if status is not None and not (isinstance(status, str) and status.strip().lower() in STATUSES):
            problems.append((f"{here}.status", "status must be todo, doing, blocked or done"))
        priority = item.get("priority")
        if priority is not None and not (isinstance(priority, str) and priority.strip().lower() in PRIORITIES):
            problems.append((f"{here}.priority", "priority must be low, med or high"))
        if acts_before_the_model(item.get("run")):
            problems.append((here, NO_SEND))
    return problems


def text_tasks(block: dict) -> str:
    """One line per task: status box, title, then owner / due / priority."""
    raw_items = block.get("items")
    items = raw_items if isinstance(raw_items, list) else []
    box = {"done": "[x]", "doing": "[~]", "blocked": "[!]", "todo": "[ ]"}
    lines = []
    for item in items[:TASK_MAX]:
        if not (isinstance(item, dict) and has_text(item.get("title"))):
            continue
        title = safe_text(item.get("title"), 120)
        status = safe_text(item.get("status"), 10).lower() if has_text(item.get("status")) else "todo"
        meta = [safe_text(item.get(k), 40) for k in ("owner", "due") if has_text(item.get(k))]
        priority = safe_text(item.get("priority"), 8)
        if has_text(priority):
            meta.append(f"!{priority}")
        tail = f" — {', '.join(meta)}" if meta else ""
        lines.append(f"- {box.get(status, '[ ]')} {title}{tail}")
    return "\n".join(lines)
