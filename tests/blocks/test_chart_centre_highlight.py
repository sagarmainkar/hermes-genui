"""chart, a donut's centre words and its highlighted slice — the two display-only fields a lifecycle wheel needs.
Both belong to pie and donut only: every other kind ignores them without an error."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")

DONUT = {
    "type": "chart", "kind": "donut", "x": ["PLAN", "TRACK", "IMPLEMENT", "METRIC"],
    "series": [{"name": "Lifecycle", "data": [4, 2, 3, 5]}],
}


def test_a_donut_takes_centre_words():
    assert check_blocks([{**DONUT, "center": {"label": "PLAN", "value": "smooth"}}]) == []
    assert check_blocks([{**DONUT, "kind": "pie", "center": {"label": "PLAN", "value": "smooth"}}]) == []
    assert check_blocks([{**DONUT, "center": {"label": "PLAN"}}]) == ["0.center: center needs a label and a value"]
    assert check_blocks([{**DONUT, "center": {"value": "smooth"}}]) == ["0.center: center needs a label and a value"]
    assert check_blocks([{**DONUT, "center": "PLAN"}]) == ["0.center: center needs a label and a value"]


def test_a_donut_highlight_is_an_index_into_x():
    assert check_blocks([{**DONUT, "highlight": 0}]) == []
    assert check_blocks([{**DONUT, "highlight": 3}]) == []
    for bad in (4, -1, "1", True, 1.5):
        assert check_blocks([{**DONUT, "highlight": bad}]) == ["0.highlight: highlight must be an index into x"]


def test_other_kinds_ignore_the_centre_words_and_the_highlight():
    bar = {"type": "chart", "kind": "bar", "x": ["Q1", "Q2"], "series": [{"data": [1, 2]}]}
    assert check_blocks([{**bar, "center": "not even an object", "highlight": 99}]) == []
    line = {"type": "chart", "kind": "line", "x": ["Q1", "Q2"], "series": [{"data": [1, 2]}]}
    assert check_blocks([{**line, "center": {"label": "PLAN", "value": "smooth"}, "highlight": 7}]) == []


def test_text_says_the_centre_words_and_the_highlighted_slice():
    """The words the wheel draws are words the text fallback says too — never silent fields."""
    block = {**DONUT, "kind": "donut", "title": "Lifecycle", "center": {"label": "PLAN", "value": "smooth"},
             "highlight": 1}
    text = tf.blocks_as_text([block])
    assert " · centre PLAN smooth · highlighted TRACK" in text
    # The highlight alone, and the centre alone, each stand on their own too.
    only_centre = tf.blocks_as_text([{**DONUT, "center": {"label": "PLAN", "value": "smooth"}}])
    assert "centre PLAN smooth" in only_centre and "highlighted" not in only_centre
    only_highlight = tf.blocks_as_text([{**DONUT, "highlight": 2}])
    assert "highlighted IMPLEMENT" in only_highlight and "centre" not in only_highlight
