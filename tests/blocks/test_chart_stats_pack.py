"""chart waterfall / radar / control / bubble / box / treemap: the stats pack, checked and rendered to text.

Each kind is proven twice: a valid example checks clean (so it can be stored and drawn), a malformed one is
refused with the path of the mistake (so the model can fix it in the same turn), and the text fallback keeps
the numbers a chat app that can't draw still needs.
"""

import importlib


from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")


# --- waterfall -------------------------------------------------------------------------------------------

def test_a_waterfall_passes_with_signed_steps_and_totals():
    assert check_blocks([{"type": "chart", "kind": "waterfall", "title": "Cash", "unit": "$k",
                          "series": [{"points": [{"label": "Opening", "value": 2140, "total": True},
                                                 {"label": "Salary", "value": 3200},
                                                 {"label": "Rent", "value": -1450}]}]}]) == []


def test_a_waterfall_takes_one_series_of_points():
    assert check_blocks([{"type": "chart", "kind": "waterfall",
                          "series": [{"points": [{"label": "a", "value": 1}]},
                                     {"points": [{"label": "b", "value": 2}]}]}]) == [
        "0: a waterfall chart takes 1 series"]
    assert check_blocks([{"type": "chart", "kind": "waterfall", "x": ["a"], "series": [{"data": [1, 2]}]}]) == [
        "0: series needs a points list"]


def test_a_waterfall_reads_as_its_steps():
    text = tf.blocks_as_text([{"type": "chart", "kind": "waterfall", "title": "Cash",
                               "series": [{"points": [{"label": "Opening", "value": 2140, "total": True},
                                                      {"label": "Salary", "value": 3200},
                                                      {"label": "Rent", "value": -1450}]}]}])
    assert "Cash" in text and "Salary" in text and "-1,450" in text


# --- radar -----------------------------------------------------------------------------------------------

def test_a_radar_passes_with_up_to_three_series():
    one = {"type": "chart", "kind": "radar", "x": ["Speed", "Cost", "Quality"],
           "series": [{"name": "Now", "data": [6, 4, 8]}]}
    two = {"type": "chart", "kind": "radar", "x": ["Speed", "Cost", "Quality"],
           "series": [{"name": "Now", "data": [6, 4, 8]}, {"name": "Goal", "data": [9, 8, 9]}]}
    assert check_blocks([one]) == []
    assert check_blocks([two]) == []


def test_a_radar_refuses_a_fourth_series():
    four = {"type": "chart", "kind": "radar", "x": ["a"],
            "series": [{"data": [1]}, {"data": [1]}, {"data": [1]}, {"data": [1]}]}
    assert check_blocks([four]) == ["0: a radar chart takes 1-3 series"]


def test_a_radar_reads_each_series_by_name():
    text = tf.blocks_as_text([{"type": "chart", "kind": "radar", "title": "Skills", "x": ["a", "b"],
                               "series": [{"name": "Now", "data": [6, 4]}, {"name": "Goal", "data": [9, 8]}]}])
    assert "Skills" in text and "Now 6 / 4" in text and "Goal 9 / 8" in text


# --- control ---------------------------------------------------------------------------------------------

def test_a_control_passes_and_takes_one_series():
    assert check_blocks([{"type": "chart", "kind": "control", "title": "Latency", "unit": "ms",
                          "x": ["t1", "t2", "t3"], "series": [{"data": [100, 102, 99]}]}]) == []
    assert check_blocks([{"type": "chart", "kind": "control", "x": ["a"],
                          "series": [{"data": [1]}, {"data": [1]}]}]) == [
        "0: a control chart takes 1 series"]


def test_a_control_reads_as_its_mean_and_count():
    text = tf.blocks_as_text([{"type": "chart", "kind": "control", "title": "Latency",
                               "x": ["a", "b", "c"], "series": [{"data": [10, 20, 30]}]}])
    assert "Latency" in text and "mean 20" in text and "n 3" in text


# --- bubble ----------------------------------------------------------------------------------------------

def test_a_bubble_passes_with_a_size_series_and_caps_at_two():
    good = {"type": "chart", "kind": "bubble", "x": [10, 20, 30],
            "series": [{"name": "Growth", "data": [4, 7, 2]}, {"name": "Size", "data": [100, 400, 50]}]}
    assert check_blocks([good]) == []
    three = {"type": "chart", "kind": "bubble", "x": [1],
             "series": [{"data": [1]}, {"data": [1]}, {"data": [1]}]}
    assert check_blocks([three]) == ["0: a bubble chart takes 1-2 series"]


def test_a_bubble_takes_y_only_and_allows_labels_that_are_not_numbers():
    # x places the dots: a numeric x is a value, anything else is spaced evenly by the drawing side.
    assert check_blocks([{"type": "chart", "kind": "bubble", "x": ["North", "South", "East"],
                          "series": [{"data": [4, 7, 2]}]}]) == []


def test_a_bubble_reads_as_its_points_and_y_range():
    text = tf.blocks_as_text([{"type": "chart", "kind": "bubble", "title": "Markets", "x": [10, 20, 30],
                               "series": [{"name": "Growth", "data": [4, 7, 2]}]}])
    assert "Markets" in text and "3 points" in text and "y 2 → 7" in text


# --- box -------------------------------------------------------------------------------------------------

def test_a_box_passes_with_one_group_and_with_its_name_as_label():
    # No x at all is fine: each series is a group, and its label falls back to the series' name.
    assert check_blocks([{"type": "chart", "kind": "box",
                          "series": [{"name": "Alpha", "data": [1, 2, 3]}]}]) == []
    assert check_blocks([{"type": "chart", "kind": "box", "x": ["A", "B"],
                          "series": [{"name": "A", "data": [1, 2, 3, 4, 20]},
                                     {"name": "B", "data": [2, 3, 3, 4]}]}]) == []


def test_a_box_takes_one_to_eight_groups():
    nine = {"type": "chart", "kind": "box", "series": [{"data": [1]}] * 9}
    assert check_blocks([nine]) == ["0: a box plot takes 1-8 groups"]
    eight = {"type": "chart", "kind": "box", "series": [{"data": [1]}] * 8}
    assert check_blocks([eight]) == []


def test_a_box_refuses_an_empty_or_non_numeric_group():
    empty = {"type": "chart", "kind": "box", "series": [{"name": "A", "data": [1, 2]}, {"name": "B", "data": []}]}
    assert check_blocks([empty]) == ["0.series.1: group needs a data list"]
    words = {"type": "chart", "kind": "box", "series": [{"name": "A", "data": ["x", "y"]}]}
    assert check_blocks([words]) == ["0.series.0: group data must be numbers"]


def test_a_box_reads_as_each_groups_median():
    text = tf.blocks_as_text([{"type": "chart", "kind": "box", "title": "Spread", "x": ["A", "B"],
                               "series": [{"name": "Alpha", "data": [1, 2, 3, 4, 20]},
                                          {"name": "Beta", "data": [2, 3, 3, 4]}]}])
    assert "Spread" in text and "Alpha median 3" in text and "Beta median 3" in text


def test_a_box_text_names_its_groups_from_x_labels():
    # Two groups given only x labels read identically as "Group median 3 · Group median 3" today, so a chat
    # app that can't draw cannot tell them apart. Strict xfail: fixing the defect turns this red on purpose.
    text = tf.blocks_as_text([{"type": "chart", "kind": "box", "title": "Spread", "x": ["A", "B"],
                               "series": [{"data": [1, 2, 3]}, {"data": [2, 3, 4]}]}])
    assert "A median 2" in text and "B median 3" in text


# --- treemap ---------------------------------------------------------------------------------------------

def test_a_treemap_passes_and_needs_one_positive_value():
    assert check_blocks([{"type": "chart", "kind": "treemap", "title": "Spend", "unit": "$k",
                          "x": ["Rent", "Food", "Travel"],
                          "series": [{"data": [30000, 12000, 4000]}]}]) == []
    assert check_blocks([{"type": "chart", "kind": "treemap", "x": ["A", "B"],
                          "series": [{"data": [0, -5]}]}]) == [
        "0: a treemap needs at least one positive value"]
    assert check_blocks([{"type": "chart", "kind": "treemap", "series": [{"data": [1]}]}]) == [
        "0: chart needs x labels"]


def test_a_treemap_takes_one_series():
    assert check_blocks([{"type": "chart", "kind": "treemap", "x": ["A"],
                          "series": [{"data": [1]}, {"data": [1]}]}]) == [
        "0: a treemap chart takes 1 series"]


def test_a_treemap_drops_the_values_it_cannot_draw():
    # Non-positive values have no area: they are left out of the text too, and the shares are of what is left.
    text = tf.blocks_as_text([{"type": "chart", "kind": "treemap", "title": "Spend",
                               "x": ["Rent", "Empty", "Refund"],
                               "series": [{"data": [30, 0, -4]}]}])
    assert "Rent 30 (100%)" in text
    assert "Empty" not in text and "Refund" not in text
