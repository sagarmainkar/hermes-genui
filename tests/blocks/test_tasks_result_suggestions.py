"""tasks / result / suggestions: the work-order, delivered-result and proposal cards, checked and read as text.

Same shape as the chart tests: a valid block checks clean, a malformed one is refused with the path of the
mistake, and every message a button would send is refused when Hermes itself would act on it (/ @ !), because
a tap must go to the model, never to the shell.
"""

import importlib

from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")

NO_SEND = "a button's message can't start with / @ or ! or carry @-references"


# --- tasks -----------------------------------------------------------------------------------------------

def test_tasks_pass_with_an_owner_due_status_and_priority():
    assert check_blocks([{"type": "tasks", "title": "This week", "items": [
        {"title": "Fix the roof leak", "owner": "Leo", "due": "Fri", "status": "doing", "priority": "high"},
        {"title": "Order shingles", "owner": "Sam", "due": "Thu", "status": "todo", "priority": "med"}]}]) == []


def test_tasks_need_one_to_forty_items_with_a_title():
    assert check_blocks([{"type": "tasks", "items": []}]) == ["0: tasks needs 1-40 items"]
    assert check_blocks([{"type": "tasks", "items": [{"owner": "Leo"}]}]) == ["0.items.0: task needs a title"]
    forty = [{"title": f"t{i}"} for i in range(40)]
    assert check_blocks([{"type": "tasks", "items": forty}]) == []
    assert check_blocks([{"type": "tasks", "items": forty + [{"title": "one too many"}]}]) == [
        "0: tasks needs 1-40 items"]


def test_tasks_keep_status_and_priority_on_their_lists():
    assert check_blocks([{"type": "tasks", "items": [{"title": "X", "status": "started"}]}]) == [
        "0.items.0.status: status must be todo, doing, blocked or done"]
    assert check_blocks([{"type": "tasks", "items": [{"title": "X", "priority": "urgent"}]}]) == [
        "0.items.0.priority: priority must be low, med or high"]


def test_a_task_run_that_hermes_would_act_on_is_refused():
    for run in ("/reset", "@file:notes.txt", "!ls"):
        assert check_blocks([{"type": "tasks", "items": [{"title": "X", "run": run}]}]) == [
            f"0.items.0: {NO_SEND}"]
    assert check_blocks([{"type": "tasks", "items": [{"title": "X", "run": "Email name@example.com"}]}]) == []


def test_tasks_read_as_a_ticked_list_with_their_meta():
    text = tf.blocks_as_text([{"type": "tasks", "items": [
        {"title": "Fix the roof leak", "owner": "Leo", "due": "Fri", "status": "doing", "priority": "high"},
        {"title": "Order shingles", "status": "done"}]}])
    assert "- [~] Fix the roof leak — Leo, Fri, !high" in text
    assert "- [x] Order shingles" in text


# --- result ----------------------------------------------------------------------------------------------

def test_a_result_passes_with_sources():
    assert check_blocks([{"type": "result", "title": "Draft reply", "body": "Here is the reply I would send…",
                          "sources": [{"label": "IRS Notice 2026-1"}, {"label": "Bank statement",
                                                                      "url": "https://example.com/statement"}],
                          "model": "Hermes"}]) == []


def test_a_result_needs_body_text():
    assert check_blocks([{"type": "result", "title": "no body"}]) == ["0: result needs body text"]
    assert check_blocks([{"type": "result", "body": "   "}]) == ["0: result needs body text"]


def test_a_result_takes_at_most_six_sources_each_with_a_label():
    seven = {"type": "result", "body": "b", "sources": [{"label": f"s{i}"} for i in range(7)]}
    assert check_blocks([seven]) == ["0.sources: sources must be at most 6"]
    unlabeled = {"type": "result", "body": "b", "sources": [{"url": "https://example.com"}]}
    assert check_blocks([unlabeled]) == ["0.sources.0: source needs a label"]


def test_a_result_reads_as_its_body_then_its_sources():
    text = tf.blocks_as_text([{"type": "result", "title": "Draft reply", "body": "Here is the reply.",
                               "sources": [{"label": "IRS Notice 2026-1"}]}])
    assert "**Draft reply**" in text and "Here is the reply." in text and "- IRS Notice 2026-1" in text


# --- suggestions -----------------------------------------------------------------------------------------

def test_suggestions_pass_with_a_reason_and_both_taps():
    assert check_blocks([{"type": "suggestions", "title": "Suggested", "items": [
        {"text": "Move the deadline to Friday", "reason": "two plans slipped",
         "accept": "Accept: move the deadline to Friday", "skip": "Skip that"}]}]) == []


def test_suggestions_need_one_to_twenty_items_with_text():
    assert check_blocks([{"type": "suggestions", "items": []}]) == ["0: suggestions needs 1-20 items"]
    assert check_blocks([{"type": "suggestions", "items": [{"reason": "r"}]}]) == [
        "0.items.0: suggestion needs text"]


def test_an_accept_or_skip_message_hermes_would_act_on_is_refused():
    for run in ("/reset", "@file:notes.txt", "!ls"):
        assert check_blocks([{"type": "suggestions", "items": [{"text": "t", "accept": run}]}]) == [
            f"0.items.0: {NO_SEND}"]
        assert check_blocks([{"type": "suggestions", "items": [{"text": "t", "skip": run}]}]) == [
            f"0.items.0: {NO_SEND}"]
    assert check_blocks([{"type": "suggestions", "items": [
        {"text": "t", "accept": "Email name@example.com"}]}]) == []


def test_suggestions_read_as_their_text_and_reason():
    text = tf.blocks_as_text([{"type": "suggestions", "items": [
        {"text": "Move the deadline", "reason": "two plans slipped"}]}])
    assert "- Move the deadline — two plans slipped" in text


# --- together --------------------------------------------------------------------------------------------

def test_the_four_new_blocks_sit_on_one_board():
    board = [
        {"type": "cards", "items": [{"title": "Mission Control", "status": "active",
                                     "owner": "Leo", "milestone": "M3", "trend": "+12%",
                                     "budget": "$40k", "arr": "$1.2M"}]},
        {"type": "tasks", "items": [{"title": "Fix the roof", "status": "doing"}]},
        {"type": "result", "title": "Draft", "body": "Here is the reply."},
        {"type": "suggestions", "items": [{"text": "Move the deadline", "reason": "slipped"}]},
    ]
    assert check_blocks(board) == []
    text = tf.blocks_as_text(board)
    for needle in ("Mission Control", "Fix the roof", "Draft", "Move the deadline"):
        assert needle in text
