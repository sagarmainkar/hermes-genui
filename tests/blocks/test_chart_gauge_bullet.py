"""chart gauge / bullet: value-against-target kinds, checked and rendered to text."""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")


def test_a_gauge_passes():
    assert check_blocks([{"type": "chart", "kind": "gauge", "series": [{"data": [68]}],
                          "min": 0, "max": 100, "target": 75}]) == []
    assert check_blocks([{"type": "chart", "kind": "gauge", "series": [{"data": [42]}]}]) == []


def test_a_gauge_needs_one_number_and_one_series():
    assert check_blocks([{"type": "chart", "kind": "gauge", "series": [{"data": ["x"]}]}]) == [
        "0.series.0: a gauge needs one number"]
    assert check_blocks([{"type": "chart", "kind": "gauge", "series": [{"data": [1]}, {"data": [2]}]}]) == [
        "0: a gauge takes one series"]


def test_a_gauge_refuses_a_second_reading():
    """Only data[0] is drawn, so a second reading is refused rather than silently dropped."""
    assert check_blocks([{"type": "chart", "kind": "gauge", "series": [{"data": [68, 90]}]}]) == [
        "0.series.0: a gauge needs one number"]
    assert check_blocks([{"type": "chart", "kind": "gauge", "series": [{"data": []}]}]) == [
        "0.series.0: a gauge needs one number"]


def test_a_gauge_max_is_above_its_min():
    assert check_blocks([{"type": "chart", "kind": "gauge", "series": [{"data": [5]}],
                          "min": 10, "max": 5}]) == ["0: max must be greater than min"]


def test_a_bullet_passes_and_caps_at_two_series():
    good = {"type": "chart", "kind": "bullet", "x": ["CPU", "RAM"],
            "series": [{"data": [68, 40]}, {"data": [80, 80]}]}
    assert check_blocks([good]) == []
    three = {"type": "chart", "kind": "bullet", "x": ["A"],
             "series": [{"data": [1]}, {"data": [2]}, {"data": [3]}]}
    assert check_blocks([three]) == ["0: a bullet chart takes 1-2 series"]


def test_gauge_and_bullet_read_as_text():
    gauge = tf.blocks_as_text([{"type": "chart", "kind": "gauge", "title": "Uptime", "unit": "%",
                                "series": [{"data": [68]}], "min": 0, "max": 100, "target": 75}])
    assert "Uptime" in gauge and "68" in gauge and "0-100" in gauge and "target 75" in gauge
    bullet = tf.blocks_as_text([{"type": "chart", "kind": "bullet", "title": "Load", "x": ["CPU", "RAM"],
                                 "series": [{"data": [68, 40]}, {"data": [80, 80]}]}])
    assert "CPU 68/80" in bullet and "RAM 40/80" in bullet
