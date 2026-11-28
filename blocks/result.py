"""result: a delivered result — a draft, a comparison, an answer — with its sources and the model that made it."""

from .common import has_text, safe_text

SOURCES_MAX = 6


def check_result(block: dict, path: str) -> list[tuple[str, str]]:
    """A result needs body text; optional sources are up to 6, each a label (+ optional url).

    {"body": "Draft reply…", "sources": [{"label": "IRS 2026"}]} → []
    {"title": "no body"} → [("0", "result needs body text")]
    """
    if not has_text(block.get("body")):
        return [(path, "result needs body text")]
    sources = block.get("sources")
    problems = []
    if sources is not None:
        if not isinstance(sources, list) or len(sources) > SOURCES_MAX:
            problems.append((f"{path}.sources", f"sources must be at most {SOURCES_MAX}"))
        else:
            for i, source in enumerate(sources):
                if not (isinstance(source, dict) and has_text(source.get("label"))):
                    problems.append((f"{path}.sources.{i}", "source needs a label"))
    return problems


def text_result(block: dict) -> str:
    """The title, the body, and the sources as a short list."""
    lines = []
    title = safe_text(block.get("title"), 80)
    if title:
        lines.append(f"**{title}**")
    body = safe_text(block.get("body"), 600)
    if body:
        lines.append(body)
    raw_sources = block.get("sources")
    sources = raw_sources if isinstance(raw_sources, list) else []
    for source in sources[:SOURCES_MAX]:
        if isinstance(source, dict) and has_text(source.get("label")):
            lines.append(f"- {safe_text(source.get('label'), 80)}")
    return "\n".join(lines)
