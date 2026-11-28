"""cards' five plain facts (owner, milestone, trend, budget, ARR) and the honest-unknown rule, on both halves.

The Desktop card draws the facts (web/src/blocks/cards/Cards.tsx, Facts); the text fallback is what a chat app
that can't draw gets, so it has to keep them — and an "unknown" must stay the word, never a blank or a zero.
"""

import importlib


from conftest import load_plugin_package

load_plugin_package()
check_blocks = importlib.import_module("hermes_genui.core.check").check_blocks
tf = importlib.import_module("hermes_genui.hooks.text_fallback")


def test_a_card_carrying_all_five_facts_passes():
    assert check_blocks([{"type": "cards", "items": [{
        "title": "Mission Control", "status": "active",
        "owner": "Leo", "milestone": "M3", "trend": "+12%", "budget": "$40k", "arr": "$1.2M"}]}]) == []


def test_an_unknown_metric_reads_as_the_word_not_a_blank_or_zero():
    text = tf.blocks_as_text([{"type": "cards", "items": [
        {"title": "Librarian", "metrics": [{"label": "velocity", "value": "unknown"}]}]}])
    assert "velocity unknown" in text
    assert "unknown" in text
    assert "clear" not in text and " 0" not in text


def test_a_card_with_nothing_pending_reads_clear():
    text = tf.blocks_as_text([{"type": "cards", "items": [
        {"title": "Quiet", "metrics": [{"label": "velocity", "value": "0.75/wk"}]}]}])
    assert "clear" in text


def test_the_five_facts_survive_the_text_fallback():
    text = tf.blocks_as_text([{"type": "cards", "items": [
        {"title": "P", "owner": "Leo", "milestone": "M3", "trend": "+12%", "budget": "$40k", "arr": "$1.2M"}]}])
    for needle in ("Leo", "M3", "+12%", "$40k", "$1.2M"):
        assert needle in text


def test_a_cards_id_survives_the_text_fallback():
    # The card draws its id (Cards.tsx, .hb-card-id); a chat that can't draw must keep the same identifier.
    text = tf.blocks_as_text([{"type": "cards", "items": [
        {"title": "Mission Control", "id": "MC-12", "status": "active"}]}])
    assert "MC-12" in text


def test_a_metric_value_the_reader_cannot_show_is_refused():
    # The Desktop reader keeps a metric only when its value is text or a number, so the checker refuses the rest
    # (an object value used to pass here and then vanish from the drawing).
    assert check_blocks([{"type": "cards", "items": [
        {"title": "P", "metrics": [{"label": "velocity", "value": {}}]}]}]) == [
        "0.items.0.metrics.0: metric needs a label and a value"]
