"""cards: a compact wall of project cards — one block for a whole portfolio. Checked strictly; a list off Desktop."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")

WALL = {"type": "cards", "columns": 2, "items": [
    {"title": "GarzaOS Mission Control", "id": "PJ-20261023-001", "status": "active",
     "ring": {"stages": ["PLAN", "TRACK", "IMPLEMENT", "METRIC"], "at": 0, "label": "smooth", "tone": "good"},
     "metrics": [{"label": "velocity", "value": "0.75/wk"}, {"label": "delivery", "value": "100%"},
                 {"label": "health", "value": "smooth", "tone": "good"}],
     "needs": {"text": "2 plans await your yes", "tone": "warn"}, "freshness": "as of 16:52 UTC",
     "action": {"label": "Open project chat", "run": "Open the project chat for PJ-20261023-001"}},
    # The honest-unknown card: every value unknown, no needs → must read "unknown", never "clear".
    {"title": "Librarian", "status": "active",
     "metrics": [{"label": "velocity", "value": "unknown"}, {"label": "delivery", "value": "unknown"},
                 {"label": "health", "value": "unknown"}]},
]}


def test_a_good_wall_passes():
    assert check_blocks([WALL]) == []
    assert check_blocks([{"type": "cards", "items": [{"title": "Solo"}]}]) == []


def test_the_wall_needs_1_to_14_cards():
    assert check_blocks([{"type": "cards", "items": []}]) == ["0: cards needs 1-14 items"]
    assert check_blocks([{"type": "cards"}]) == ["0: cards needs 1-14 items"]
    many = {"type": "cards", "items": [{"title": f"P{i}"} for i in range(15)]}
    assert check_blocks([many]) == ["0: cards needs 1-14 items"]


def test_a_card_needs_a_title():
    block = {"type": "cards", "items": [{"title": "Fine"}, {"subtitle": "no title"}]}
    assert check_blocks([block]) == ["0.items.1: card needs a title"]


def test_status_must_be_in_the_enum():
    block = {"type": "cards", "items": [{"title": "X", "status": "blocked"}]}
    assert check_blocks([block]) == ["0.items.0.status: status must be active, parked, done or archived"]


def test_ring_stages_must_be_exactly_four():
    for stages in (["A", "B", "C"], ["A", "B", "C", "D", "E"]):
        problems = check_blocks([{"type": "cards", "items": [{"title": "X", "ring": {"stages": stages}}]}])
        assert problems == ["0.items.0.ring.stages: ring.stages must be exactly 4 non-empty labels"]


def test_ring_at_must_be_an_integer_0_to_3():
    for at in (4, -1, "2"):
        stages = ["A", "B", "C", "D"]
        problems = check_blocks([{"type": "cards", "items": [{"title": "X", "ring": {"stages": stages, "at": at}}]}])
        assert problems == ["0.items.0.ring.at: ring.at must be an integer 0-3"]


def test_metrics_cap_at_three():
    four = [{"label": f"m{i}", "value": "v"} for i in range(4)]
    block = {"type": "cards", "items": [{"title": "X", "metrics": four}]}
    assert check_blocks([block]) == ["0.items.0.metrics: metrics must be 0-3 items"]


def test_action_run_is_guarded_before_the_model():
    for run in ("/reset", "@file:notes.txt", "!ls"):
        block = {"type": "cards", "items": [{"title": "X", "action": {"label": "Go", "run": run}}]}
        assert check_blocks([block]) == [
            "0.items.0.action: a button's message can't start with / @ or ! or carry @-references"]


def test_unknown_is_a_legal_value_not_a_problem():
    block = {"type": "cards", "items": [{"title": "Librarian", "metrics": [{"label": "velocity", "value": "unknown"}]}]}
    assert check_blocks([block]) == []


def test_text_reads_the_wall_and_never_calls_unknown_clear():
    text = tf.blocks_as_text([WALL])
    assert "**GarzaOS Mission Control** — active" in text
    assert "PLAN · TRACK · IMPLEMENT · METRIC (now: PLAN) · smooth" in text
    assert "velocity 0.75/wk · delivery 100% · health smooth" in text
    assert "needs you: 2 plans await your yes · as of 16:52 UTC" in text
    assert "[Open project chat]" in text
    # The all-unknown card reads "unknown", and the wall never says "clear" for it.
    assert "**Librarian** — active" in text
    assert "unknown" in text
    assert "clear" not in text
