"""cards, the display pack: span, a small ring, tags, stale, a second action, metric trends, three columns and
shelves. Each new field is checked strictly (a wrong one is refused with its own path) and the text fallback keeps
every one of them, so a chat app that cannot draw the wall still reads the same facts."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")

RING = {"stages": ["PLAN", "TRACK", "IMPLEMENT", "METRIC"], "at": 0, "label": "smooth", "tone": "good"}


def wall(**card):
    """A one-card wall with the given card fields."""
    return {"type": "cards", "items": [{"title": "Mission Control", **card}]}


def test_span_is_one_or_two():
    assert check_blocks([wall(span=2)]) == []
    assert check_blocks([wall(span=1)]) == []
    for bad in (0, 3, "2", True, 1.5):
        assert check_blocks([wall(span=bad)]) == ["0.items.0.span: span must be 1 or 2"]


def test_span_two_is_ignored_when_the_wall_is_not_two_up():
    # clips: 1, 3 columns and no columns at all — a span of 2 is only meaningful 2-up, never an error.
    for columns in (None, 1, 3):
        block = {"type": "cards", "items": [{"title": "Hero", "span": 2}, {"title": "Rest"}]}
        if columns is not None:
            block["columns"] = columns
        assert check_blocks([block]) == []


def test_ring_size_is_sm_or_md():
    assert check_blocks([wall(ring={**RING, "size": "sm"})]) == []
    assert check_blocks([wall(ring={**RING, "size": "md"})]) == []
    assert check_blocks([wall(ring={**RING, "size": " SM "})]) == []
    for bad in ("xs", "small", 2, True):
        assert check_blocks([wall(ring={**RING, "size": bad})]) == ["0.items.0.ring.size: ring.size must be sm or md"]


def test_tags_are_at_most_three():
    assert check_blocks([wall(tags=[])]) == []
    assert check_blocks([wall(tags=["blocked", "no evidence", "2 overdue"])]) == []
    assert check_blocks([wall(tags=["a", "b", "c", "d"])]) == ["0.items.0.tags: tags must be 0-3 labels"]
    for bad in ("blocked", {"t": "x"}):
        assert check_blocks([wall(tags=bad)]) == ["0.items.0.tags: tags must be 0-3 labels"]
    assert check_blocks([wall(tags=[1, 2])]) == ["0.items.0.tags: each tag must be a short text label"]


def test_a_tag_is_at_most_24_characters():
    assert check_blocks([wall(tags=["x" * 24])]) == []
    assert check_blocks([wall(tags=["x" * 25])]) == ["0.items.0.tags: each tag must be at most 24 characters"]
    assert check_blocks([wall(tags=["  "])]) == []


def test_stale_is_a_boolean():
    assert check_blocks([wall(stale=True)]) == []
    assert check_blocks([wall(stale=False)]) == []
    for bad in ("true", 1, 0, "yes"):
        assert check_blocks([wall(stale=bad)]) == ["0.items.0.stale: stale must be true or false"]


def test_secondary_has_the_same_guards_as_the_action():
    assert check_blocks([wall(secondary={"label": "Browser", "url": "https://x.org/p"})]) == []
    assert check_blocks([wall(secondary={"label": "Open chat", "run": "Open the project chat"})]) == []
    assert check_blocks([wall(secondary={"run": "no label"})]) == ["0.items.0.secondary: secondary needs a label"]
    for run in ("/reset", "@file:notes.txt", "!ls"):
        assert check_blocks([wall(secondary={"label": "Go", "run": run})]) == [
            "0.items.0.secondary: a button's message can't start with / @ or ! or carry @-references"]


def test_a_link_is_https_anywhere_and_http_only_on_this_machine():
    # The consumer's documented browser action is plain http on loopback: it must pass, not be refused.
    loopback = "http://127.0.0.1:8765/#/project/PJ-20261023-001"
    assert check_blocks([wall(secondary={"label": "Browser", "url": loopback})]) == []
    assert check_blocks([wall(action={"label": "Browser", "url": loopback})]) == []
    for host in ("http://127.0.0.1/p", "http://localhost:8765/p", "http://[::1]:8765/p"):
        assert check_blocks([wall(secondary={"label": "Browser", "url": host})]) == []
    # Plain http anywhere else, every other scheme, and a look-alike loopback host are refused with their own path.
    bad = "url must be https, or http on this machine (127.0.0.1, localhost, [::1])"
    for url in ("http://x.org/p", "http://127.0.0.1.example.org/p", "http://localhost.example.org/p",
                "javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://127.0.0.1/p", 42):
        assert check_blocks([wall(secondary={"label": "Browser", "url": url})]) == [
            f"0.items.0.secondary.url: {bad}"]
        assert check_blocks([wall(action={"label": "Browser", "url": url})]) == [f"0.items.0.action.url: {bad}"]


def test_a_metric_trend_follows_the_kpis_rule():
    metric = {"label": "velocity", "value": "0.75/wk"}
    assert check_blocks([wall(metrics=[{**metric, "trend": [0.4, 0.5, 0.75]}])]) == []
    assert check_blocks([wall(metrics=[{**metric, "trend": list(range(60))}])]) == []
    for bad in ([0.4], list(range(61)), [1, "2"], [1, None]):
        assert check_blocks([wall(metrics=[{**metric, "trend": bad}])]) == [
            "0.items.0.metrics.0.trend: trend must be a list of 2-60 numbers"]


def test_columns_goes_up_to_three():
    for good in (1, 2, 3):
        assert check_blocks([{"type": "cards", "columns": good, "items": [{"title": "X"}]}]) == []
    for bad in (0, 4, "3", True):
        assert check_blocks([{"type": "cards", "columns": bad, "items": [{"title": "X"}]}]) == [
            "0: columns must be 1, 2 or 3"]


def test_items_and_shelves_are_mutually_exclusive():
    block = {"type": "cards", "items": [{"title": "X"}], "shelves": [{"label": "Needs you", "items": [{"title": "Y"}]}]}
    assert check_blocks([block]) == ["0: cards takes items or shelves, not both"]
    # An empty items list beside shelves is the same clash: the model said both.
    assert check_blocks([{**block, "items": []}]) == ["0: cards takes items or shelves, not both"]


def test_a_shelf_needs_a_label_and_cards():
    good = {"type": "cards", "shelves": [
        {"label": "Needs you · 1", "items": [{"title": "A", "needs": {"text": "2 plans await your yes"}}]},
        {"label": "Active · 1", "items": [{"title": "B", "status": "active"}]},
    ]}
    assert check_blocks([good]) == []
    assert check_blocks([{"type": "cards", "shelves": []}]) == ["0.shelves: shelves must be 1-6 shelves"]
    assert check_blocks([{"type": "cards", "shelves": "needs you"}]) == ["0.shelves: shelves must be 1-6 shelves"]
    assert check_blocks([{"type": "cards", "shelves": [{"items": [{"title": "X"}]}]}]) == [
        "0.shelves.0: shelf needs a label and items"]
    assert check_blocks([{"type": "cards", "shelves": [{"label": "Empty", "items": []}]}]) == [
        "0.shelves.0: shelf needs 1-14 items"]
    # The cards inside a shelf are checked exactly like the ones in a plain items list.
    assert check_blocks([{"type": "cards", "shelves": [{"label": "S", "items": [{"title": "X", "span": 7}]}]}]) == [
        "0.shelves.0.items.0.span: span must be 1 or 2"]


def test_the_whole_display_pack_on_one_card_passes():
    block = {"type": "cards", "columns": 2, "items": [
        {"title": "NEMO · GarzaOS management", "span": 2, "status": "active",
         "needs": {"text": "4 plans await your yes", "tone": "warn"},
         "ring": {**RING, "size": "sm"}, "tags": ["blocked", "no evidence"],
         "metrics": [{"label": "velocity", "value": "unknown", "trend": [0.4, 0.5, 0.75]}],
         "stale": True, "freshness": "as of 16:52 UTC",
         "action": {"label": "Open chat", "run": "Open the project chat"},
         "secondary": {"label": "Browser", "url": "https://example.org/p"}},
        {"title": "Update Newspaper", "status": "active"},
    ]}
    assert check_blocks([block]) == []


def test_text_keeps_tags_stale_secondary_and_trend():
    block = wall(tags=["blocked", "no evidence"], stale=True, freshness="as of 16:52 UTC",
                 metrics=[{"label": "velocity", "value": "0.75/wk", "trend": [0.4, 0.5, 0.75]}],
                 action={"label": "Open chat", "run": "Open the project chat"},
                 secondary={"label": "Browser", "url": "https://example.org/p"})
    text = tf.blocks_as_text([block])
    assert "tags: blocked · no evidence" in text
    assert "velocity 0.75/wk (trend 0.4 → 0.5 → 0.75)" in text
    assert "as of 16:52 UTC · stale" in text
    assert "[Open chat]" in text
    assert "also: [Browser](https://example.org/p)" in text


def test_text_keeps_a_secondary_with_no_url_as_its_label():
    text = tf.blocks_as_text([wall(secondary={"label": "Notes", "run": "Open the notes"})])
    assert "also: [Notes]" in text


def test_text_keeps_the_loopback_link_and_drops_a_link_the_policy_refuses():
    loopback = "http://127.0.0.1:8765/#/project/PJ-20261023-001"
    text = tf.blocks_as_text([wall(secondary={"label": "Browser", "url": loopback})])
    assert f"also: [Browser]({loopback})" in text
    # A remote http URL is not printed as a link (the label alone survives), so no clickable address is invented.
    remote = tf.blocks_as_text([wall(secondary={"label": "Browser", "url": "http://x.org/p"})])
    assert "also: [Browser]" in remote and "x.org" not in remote


def test_text_keeps_shelf_headings_and_their_cards():
    block = {"type": "cards", "shelves": [
        {"label": "Needs you · 1", "items": [{"title": "NEMO", "needs": {"text": "4 plans await your yes"}}]},
        {"label": "Parked · 1", "items": [{"title": "Old site", "status": "parked"}]},
    ]}
    text = tf.blocks_as_text([block])
    assert "**Needs you · 1**" in text
    assert "**Parked · 1**" in text
    assert "**NEMO**" in text and "needs you: 4 plans await your yes" in text
    assert "**Old site** — parked" in text


def test_text_never_calls_an_unknown_clear_and_keeps_the_new_fields_honest():
    block = wall(metrics=[{"label": "velocity", "value": "unknown", "trend": [1, 2]}], tags=["no evidence"], stale=True)
    text = tf.blocks_as_text([block])
    assert "unknown" in text
    assert "clear" not in text
    assert "tags: no evidence" in text


def test_text_keeps_a_trend_gap_as_a_gap() -> None:
    """A trend the checker accepts ([1, None, 2]) must render, not raise: the gap keeps its slot as "…"."""
    block = wall(metrics=[{"label": "velocity", "value": "0.75/wk", "trend": [1, None, 2]}])
    assert check_blocks([block]) == []
    text = tf.blocks_as_text([block])
    assert "velocity 0.75/wk (trend 1 → … → 2)" in text


def test_text_links_a_primary_action_the_policy_keeps() -> None:
    """The primary action is a link when it has a url the reader would open (the same rule as the secondary)."""
    loopback = "http://127.0.0.1:8765/#/project/PJ-20261023-001"
    assert f"[Browser]({loopback})" in tf.blocks_as_text([wall(action={"label": "Browser", "url": loopback})])
    assert "[Browser](https://example.org/p)" in tf.blocks_as_text(
        [wall(action={"label": "Browser", "url": "https://example.org/p"})])
    # A run action stays a label, and a refused link is never printed as one.
    assert "[Open chat]" in tf.blocks_as_text([wall(action={"label": "Open chat", "run": "Open it"})])
    refused = tf.blocks_as_text([wall(action={"label": "Browser", "url": "http://x.org/p"})])
    assert "[Browser]" in refused and "x.org" not in refused

def test_text_names_the_wall_layout():
    """columns, a spanning card and a small ring are drawing words, but a text reader must not get a
    different board: they ride as the wall's quiet last line."""
    block = {"type": "cards", "columns": 3, "items": [
        {"title": "Hero", "span": 2, "ring": {**RING, "size": "sm"}},
        {"title": "Rest"}]}
    text = tf.blocks_as_text([block])
    assert "3 columns" in text and "1 card spans 2" in text and "small ring" in text
    # A plain wall says none of it.
    plain = tf.blocks_as_text([{"type": "cards", "items": [{"title": "Quiet"}]}])
    assert "wall:" not in plain
