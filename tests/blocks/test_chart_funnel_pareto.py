"""chart funnel / pareto: ordered drop-off and the vital few."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")


def test_funnel_and_pareto_pass():
    funnel = {"type": "chart", "kind": "funnel", "x": ["Visits", "Signups", "Paid"],
              "series": [{"data": [1000, 200, 40]}]}
    pareto = {"type": "chart", "kind": "pareto", "x": ["Defect A", "Defect B", "Defect C"],
              "series": [{"data": [50, 30, 20]}]}
    assert check_blocks([funnel, pareto]) == []


def test_funnel_takes_one_series():
    blk = {"type": "chart", "kind": "funnel", "x": ["A", "B"], "series": [{"data": [1, 2]}, {"data": [1, 2]}]}
    assert check_blocks([blk]) == ["0: a funnel chart takes 1 series"]


def test_funnel_and_pareto_read_as_text():
    funnel = {"type": "chart", "kind": "funnel", "title": "Signup", "x": ["Visits", "Signups", "Paid"],
              "series": [{"data": [1000, 200, 40]}]}
    text = tf.blocks_as_text([funnel])
    assert "Visits 1,000" in text and "Paid 40" in text
    pareto = {"type": "chart", "kind": "pareto", "title": "Defects", "x": ["A", "B"], "series": [{"data": [50, 30]}]}
    ptext = tf.blocks_as_text([pareto])
    assert "A 50" in ptext and "B 30" in ptext
