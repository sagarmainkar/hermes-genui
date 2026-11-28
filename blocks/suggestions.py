"""suggestions: proposed changes to accept or skip, each with a reason — the 'Hermes proposes, you dispose' card."""

from .common import NO_SEND, acts_before_the_model, has_text, safe_text

SUG_MAX = 20


def check_suggestions(block: dict, path: str) -> list[tuple[str, str]]:
    """1-20 suggestions, each with text; an accept or skip message may not act before the model.

    {"items": [{"text": "Move the deadline", "reason": "two plans slipped", "accept": "Accept: move deadline"}]} → []
    {"items": [{"text": "X", "accept": "/reset"}]} → [(".items.0", a button's message can't …)]
    """
    items = block.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= SUG_MAX:
        return [(path, f"suggestions needs 1-{SUG_MAX} items")]
    problems = []
    for i, item in enumerate(items):
        here = f"{path}.items.{i}"
        if not (isinstance(item, dict) and has_text(item.get("text"))):
            problems.append((here, "suggestion needs text"))
            continue
        if acts_before_the_model(item.get("accept")) or acts_before_the_model(item.get("skip")):
            problems.append((here, NO_SEND))
    return problems


def text_suggestions(block: dict) -> str:
    """One line per suggestion: its text, then its reason."""
    raw = block.get("items")
    items = raw if isinstance(raw, list) else []
    lines = []
    for item in items[:SUG_MAX]:
        if isinstance(item, dict) and has_text(item.get("text")):
            reason = safe_text(item.get("reason"), 120)
            lines.append(f"- {safe_text(item.get('text'), 160)}" + (f" — {reason}" if reason else ""))
    return "\n".join(lines)
