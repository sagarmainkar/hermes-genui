"""cards: 1-14 compact project cards — one block for a whole portfolio.

A single project today costs ~6 blocks; at 14 projects that overruns a board. One `cards` block holds the wall:
title, an optional id line, a status chip (with up to three tiny tags), a 4-segment lifecycle ring, up to three
metrics, what needs the owner, freshness, and one action (plus a quieter second one) — per card. The cards come
either as one `items` list or as labelled `shelves` ("Needs you / Active / Parked"), never both.
"""

from .common import NO_SEND, acts_before_the_model, has_text, is_safe_link, md_link, safe_text, safe_url
from .kpis import is_trend

CARD_MAX = 14
METRIC_MAX = 3
STATUSES = ("active", "parked", "done", "archived")
TONES = ("good", "warn", "bad", "neutral")
RING_SIZES = ("sm", "md")
TAGS_MAX = 3
TAG_CHARS = 24
SHELF_MAX = 6


def check_cards(block: dict, path: str) -> list[tuple[str, str]]:
    """1-14 cards, each with a title; the ring, metrics, needs, tags, stale flag and actions are optional but, when
    present, must be well shaped. Cards come as one `items` list or as labelled `shelves`, never both.

    {"items": [{"title": "Mission Control"}]} → []
    {"items": []} → [("0", "cards needs 1-14 items")]
    {"items": [{"title": "X", "ring": {"stages": ["A", "B", "C"]}}]} → [("0.items.0.ring.stages", "...4...")]
    {"items": [{"title": "X"}], "shelves": [{"label": "Y", "items": [...]}]}
      → [("0", "cards takes items or shelves, not both")]
    """
    if "items" in block and "shelves" in block:
        return [(path, "cards takes items or shelves, not both")]
    shelves = block.get("shelves")
    if shelves is not None:
        problems = _check_shelves(shelves, f"{path}.shelves")
    else:
        items = block.get("items")
        if not isinstance(items, list) or not 1 <= len(items) <= CARD_MAX:
            return [(path, f"cards needs 1-{CARD_MAX} items")]
        problems = []
        for i, item in enumerate(items):
            problems += _check_card(item, f"{path}.items.{i}")
    columns = block.get("columns")
    if columns is not None and not (
            isinstance(columns, int) and not isinstance(columns, bool) and columns in (1, 2, 3)):
        problems.append((path, "columns must be 1, 2 or 3"))
    return problems


def _check_shelves(shelves: object, path: str) -> list[tuple[str, str]]:
    """Labelled groups of cards: 1-6 shelves, each a label and 1-14 cards; 1-14 cards in the block altogether.

    {"shelves": [{"label": "Needs you", "items": [{"title": "X"}]}]} → []
    {"shelves": [{"items": [{"title": "X"}]}]} → [("0.shelves.0", "shelf needs a label and items")]
    """
    if not isinstance(shelves, list) or not 1 <= len(shelves) <= SHELF_MAX:
        return [(path, f"shelves must be 1-{SHELF_MAX} shelves")]
    problems: list[tuple[str, str]] = []
    total = 0
    for k, shelf in enumerate(shelves):
        where = f"{path}.{k}"
        if not (isinstance(shelf, dict) and has_text(shelf.get("label"))):
            problems.append((where, "shelf needs a label and items"))
            continue
        items = shelf.get("items")
        if not isinstance(items, list) or not 1 <= len(items) <= CARD_MAX:
            problems.append((where, f"shelf needs 1-{CARD_MAX} items"))
            continue
        total += len(items)
        for i, item in enumerate(items):
            problems += _check_card(item, f"{where}.items.{i}")
    if not problems and not 1 <= total <= CARD_MAX:
        problems.append((path, f"cards needs 1-{CARD_MAX} items"))
    return problems


def _check_card(item: object, path: str) -> list[tuple[str, str]]:
    if not (isinstance(item, dict) and has_text(item.get("title"))):
        return [(path, "card needs a title")]
    problems = []
    status = item.get("status")
    if status is not None:
        if not (isinstance(status, str) and status.strip().lower() in STATUSES):
            problems.append((f"{path}.status", "status must be active, parked, done or archived"))
    span = item.get("span")
    if span is not None and not (isinstance(span, int) and not isinstance(span, bool) and span in (1, 2)):
        problems.append((f"{path}.span", "span must be 1 or 2"))
    ring = item.get("ring")
    if ring is not None:
        problems += _check_ring(ring, f"{path}.ring")
    tags = item.get("tags")
    if tags is not None:
        if not isinstance(tags, list) or not 0 <= len(tags) <= TAGS_MAX:
            problems.append((f"{path}.tags", f"tags must be 0-{TAGS_MAX} labels"))
        elif not all(isinstance(tag, str) for tag in tags):
            problems.append((f"{path}.tags", "each tag must be a short text label"))
        elif not all(len(tag.strip()) <= TAG_CHARS for tag in tags):
            problems.append((f"{path}.tags", f"each tag must be at most {TAG_CHARS} characters"))
    stale = item.get("stale")
    if stale is not None and not isinstance(stale, bool):
        problems.append((f"{path}.stale", "stale must be true or false"))
    metrics = item.get("metrics")
    if metrics is not None:
        if not isinstance(metrics, list) or not 0 <= len(metrics) <= METRIC_MAX:
            problems.append((f"{path}.metrics", f"metrics must be 0-{METRIC_MAX} items"))
        else:
            for j, metric in enumerate(metrics):
                problems += _check_metric(metric, f"{path}.metrics.{j}")
    needs = item.get("needs")
    if needs is not None and not (isinstance(needs, dict) and has_text(needs.get("text"))):
        problems.append((f"{path}.needs", "needs must be {text, tone?}"))
    problems += _check_action(item.get("action"), f"{path}.action", "action")
    problems += _check_action(item.get("secondary"), f"{path}.secondary", "secondary")
    return problems


def _check_metric(metric: object, path: str) -> list[tuple[str, str]]:
    """One metric: a label and a value, and when there is a trend, 2-60 finite numbers (the kpis rule).

    {"label": "velocity", "value": "0.75/wk", "trend": [0.4, 0.5, 0.75]} → []
    {"label": "velocity", "value": "0.75/wk", "trend": [1]} → [(path, "trend must be a list of 2-60 numbers")]
    """
    # The Desktop reader keeps a value only when it is text or a number (read.ts's readMetrics drops the rest),
    # so an object or array value must not pass here and then vanish from the drawing.
    value = metric.get("value") if isinstance(metric, dict) else None
    if not (isinstance(metric, dict) and has_text(metric.get("label"))
            and (has_text(value) or (isinstance(value, (int, float)) and not isinstance(value, bool)))):
        return [(path, "metric needs a label and a value")]
    if "trend" in metric and not is_trend(metric["trend"]):
        return [(f"{path}.trend", "trend must be a list of 2-60 numbers")]
    return []


def _check_ring(ring: object, path: str) -> list[tuple[str, str]]:
    if not isinstance(ring, dict):
        return [(path, "ring must be an object")]
    problems = []
    stages = ring.get("stages")
    if not isinstance(stages, list) or len(stages) != 4 or not all(has_text(s) for s in stages):
        problems.append((f"{path}.stages", "ring.stages must be exactly 4 non-empty labels"))
    at = ring.get("at")
    if at is not None and not (isinstance(at, int) and not isinstance(at, bool) and 0 <= at <= 3):
        problems.append((f"{path}.at", "ring.at must be an integer 0-3"))
    size = ring.get("size")
    if size is not None and not (isinstance(size, str) and size.strip().lower() in RING_SIZES):
        problems.append((f"{path}.size", "ring.size must be sm or md"))
    return problems


def _check_action(action: object, path: str, what: str) -> list[tuple[str, str]]:
    """A card's action or its quieter secondary: a label, a run message that never acts before the model, and a link
    that follows the one link policy (https anywhere, http only on this machine).

    {"label": "Browser", "url": "https://…"} → []
    {"label": "Browser", "url": "http://127.0.0.1:8765/#/p"} → []
    {"label": "Browser", "url": "http://x.org/p"} → [(path + ".url", "url must be https, or http on this machine …")]
    {"label": "Go", "run": "/reset"} → [(path, NO_SEND)]
    """
    if action is None:
        return []
    if not (isinstance(action, dict) and has_text(action.get("label"))):
        return [(path, f"{what} needs a label")]
    if acts_before_the_model(action.get("run")):
        return [(path, NO_SEND)]
    url = action.get("url")
    if url is not None and not is_safe_link(url):
        return [(f"{path}.url", "url must be https, or http on this machine (127.0.0.1, localhost, [::1])")]
    return []


def _has_unknown(item: dict) -> bool:
    """True when any value the card would draw positively reports "unknown" (a ring centre word or a metric value).

    An unknown is a value, not an absence: a card carrying one must never read as a calm `clear`.
    """
    ring = item.get("ring")
    if isinstance(ring, dict) and _unknown_word(ring.get("label")):
        return True
    metrics = item.get("metrics")
    if isinstance(metrics, list):
        for metric in metrics:
            if isinstance(metric, dict) and _unknown_word(metric.get("value")):
                return True
    return False


def _unknown_word(value: object) -> bool:
    return isinstance(value, str) and value.strip().lower() == "unknown"


def text_cards(block: dict) -> str:
    """One card per paragraph: title/status, its tags, the ring line, metrics (with any trend), the needs line (and
    whether the figures are stale) and the actions, as Markdown. Shelves keep their headings.

    {"shelves": [{"label": "Needs you · 1", "items": [{"title": "X", "tags": ["blocked"], "stale": true}]}]}
    → "**Needs you · 1**\\n\\n**X**\\ntags: blocked\\nneeds you… · stale"
    """
    shelves = block.get("shelves")
    if isinstance(shelves, list):
        groups = []
        for shelf in shelves[:SHELF_MAX]:
            if not isinstance(shelf, dict):
                continue
            body = _cards_text(shelf.get("items"))
            if not body:
                continue
            label = safe_text(shelf.get("label"), 60)
            groups.append(f"**{label}**\n\n{body}" if label else body)
        return _with_layout(block, "\n\n".join(groups))
    return _with_layout(block, _cards_text(block.get("items")))


def _with_layout(block: dict, body: str) -> str:
    """The wall's own shape as a quiet last line, for a reader who cannot see the drawing.

    A layout word is not a figure and does not belong in a card's paragraph; but a text surface that drops it
    describes a different board than the one drawn (the columns, a card that spans the row, a small ring).
    """
    note = _layout_note(block)
    return f"{body}\n\n_{note}_" if body and note else body


def _layout_note(block: dict) -> str:
    """Columns, a spanning card and a small ring, when the board asks for them.

    {"columns": 3, "items": [{"span": 2}, {"ring": {"size": "sm", ...}}]} → "3 columns · 1 card spans 2 · small rings"
    {"items": [{"title": "X"}]} → ""
    """
    items = block.get("items") if isinstance(block.get("items"), list) else [
        i for shelf in (block.get("shelves") or []) if isinstance(shelf, dict)
        for i in (shelf.get("items") or []) if isinstance(i, dict)]
    cards = [i for i in items if isinstance(i, dict)]
    words = []
    columns = block.get("columns")
    if isinstance(columns, int) and not isinstance(columns, bool) and columns in (1, 2, 3):
        words.append(f"{columns} columns")
    spanning = sum(1 for c in cards if c.get("span") == 2)
    if spanning:
        words.append(f"{spanning} card spans 2" if spanning > 1 else "1 card spans 2")
    small = sum(1 for c in cards if isinstance(c.get("ring"), dict) and c["ring"].get("size") == "sm")
    if small:
        words.append("small rings" if small > 1 else "small ring")
    return "wall: " + " · ".join(words) if words else ""


def _cards_text(raw_items: object) -> str:
    items = raw_items if isinstance(raw_items, list) else []
    cards = []
    for item in items[:CARD_MAX]:
        if not isinstance(item, dict):
            continue
        title = safe_text(item.get("title"), 80)
        if not title:
            continue
        lines = [_head(title, item.get("status"), item.get("id"))]
        tags = _tag_text(item.get("tags"))
        if tags:
            lines.append(f"tags: {tags}")
        ring = item.get("ring")
        if isinstance(ring, dict):
            line = _ring_line(ring)
            if line:
                lines.append(line)
        metrics = item.get("metrics")
        if isinstance(metrics, list) and metrics:
            cells = [f"{safe_text(m.get('label'), 40)} {safe_text(m.get('value'), 40)}{_trend_note(m.get('trend'))}"
                     for m in metrics if isinstance(m, dict) and has_text(m.get("label"))]
            if cells:
                lines.append(" · ".join(cells))
        facts = [f"{label} {safe_text(item.get(key), 40)}"
                 for key, label in (("owner", "owner"), ("milestone", "milestone"), ("trend", "trend"),
                                    ("budget", "budget"), ("arr", "ARR")) if has_text(item.get(key))]
        if facts:
            lines.append(" · ".join(facts))
        needs = _needs_line(item)
        if needs:
            lines.append(needs)
        action = item.get("action")
        if isinstance(action, dict) and has_text(action.get("label")):
            lines.append(_action_line(action))
        second = _secondary_line(item.get("secondary"))
        if second:
            lines.append(second)
        cards.append("\n".join(lines))
    return "\n\n".join(cards)


def _action_line(action: dict) -> str:
    """A card's action as Markdown: its label, linked when it carries a url the reader would keep (the one link
    policy: https anywhere, http only on this machine).

    {"label": "Browser", "url": "https://x.org/p"} → "[Browser](https://x.org/p)"
    {"label": "Open chat", "run": "Open…"} → "[Open chat]"
    """
    label = safe_text(action.get("label"), 40)
    url = action.get("url")
    return md_link(label, safe_url(url)) if is_safe_link(url) else f"[{label}]"


def _tag_text(tags: object) -> str:
    """The card's tiny tags as one line: ["blocked", "no evidence"] → "blocked · no evidence"."""
    if not isinstance(tags, list):
        return ""
    shown = [safe_text(tag, TAG_CHARS) for tag in tags[:TAGS_MAX] if has_text(tag)]
    return " · ".join(shown)


def _trend_note(trend: object) -> str:
    """A metric's trend as the recent points, inside brackets: [0.4, 0.5, 0.75] → " (trend 0.4 → 0.5 → 0.75)".

    A sparkline cannot be drawn as text, so the shape survives as its latest numbers (the last 12) rather than
    vanishing. A null slot is a gap the model measured nothing in: it keeps its place as "…", never a crash.
    Anything that is not a readable trend adds nothing.
    """
    if not (isinstance(trend, list) and is_trend(trend)):
        return ""
    points = " → ".join("…" if v is None else f"{v:g}" for v in trend[-12:])
    return f" (trend {points})"


def _secondary_line(secondary: object) -> str:
    """A card's quieter second action: the same shapes as the main one, marked "also".

    {"label": "Browser", "url": "https://x.org/p"} → "also: [Browser](https://x.org/p)"
    {"label": "Browser", "url": "http://127.0.0.1:8765/#/project/PJ-1"} → "also: [Browser](http://127.0.0.1:8765/#/project/PJ-1)"
    {"label": "Open chat", "run": "Open…"} → "also: [Open chat]"
    """
    if not (isinstance(secondary, dict) and has_text(secondary.get("label"))):
        return ""
    label = safe_text(secondary.get("label"), 40)
    url = secondary.get("url")
    if is_safe_link(url):
        return f"also: {md_link(label, safe_url(url))}"
    return f"also: [{label}]"


def _head(title: str, status: object, card_id: object = None) -> str:
    """The card's first line: its title, then its status chip and its id when it has them.

    ("Mission Control", "active", "MC-12") → "**Mission Control** — active · MC-12"
    ("Quiet", None, None) → "**Quiet**"
    """
    marks = [safe_text(v, 40) for v in (status, card_id) if has_text(v)]
    return f"**{title}** — {' · '.join(marks)}" if marks else f"**{title}**"


def _ring_line(ring: dict) -> str:
    stages = ring.get("stages")
    if not isinstance(stages, list) or not stages:
        return ""
    labels = " · ".join(safe_text(s, 24) for s in stages[:4])
    at = ring.get("at")
    shown = isinstance(at, int) and not isinstance(at, bool) and 0 <= at < len(stages)
    now = f" (now: {safe_text(stages[at], 24)})" if shown else ""
    centre = f" · {safe_text(ring.get('label'), 24)}" if has_text(ring.get("label")) else ""
    return f"{labels}{now}{centre}"


def _needs_line(item: dict) -> str:
    needs = item.get("needs")
    asked = isinstance(needs, dict) and has_text(needs.get("text"))
    line = f"needs you: {safe_text(needs.get('text'), 120)}" if asked else ""
    if not line:
        line = "unknown" if _has_unknown(item) else "clear"
    freshness = safe_text(item.get("freshness"), 40) if has_text(item.get("freshness")) else ""
    line = f"{line} · {freshness}" if freshness else line
    return f"{line} · stale" if item.get("stale") is True else line
