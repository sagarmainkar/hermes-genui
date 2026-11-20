# Placement: `align` per block, `text_align` for the words

This adds one capability: the model can say **where a block sits** across the reply column (`align`:
`left | center | right`), and **how its words read** inside the blocks whose draw is words (`text_align`, the
same three words). Nothing else changes about how blocks are checked, stored or drawn.

## What the model sees

`show_blocks` grows two optional parameters beside `blocks`:

```json
{ "blocks": [ { "type": "heading", "text": "Q3 results", "align": "center", "text_align": "center" },
              { "type": "chart", "kind": "bar", "…": "…", "align": "center" } ],
  "align": "left", "text_align": "left" }
```

- `align` on a block asks for that block's place; `align` on the call is the default for every block that
  didn't ask. Same for `text_align`. The cascade is **block → board → left**, and left is the only default.
- Junk words are ignored exactly like every other model word (nothing is refused for them; a wrong word
  reads as left where it is drawn).
- The words are stated once in the catalog `about` line and in the menu's "How" line — not repeated in all
  39 per-block field lists — and in the two parameter descriptions, so `describe()` grows by one sentence
  and `menu.txt` by one clause.

## How it is stored

When the board itself says a word, the board is stored as an envelope `{"align": …, "text_align": …,
"blocks": […]}`; otherwise it is stored as the plain list it has always been. Every reader of a stored
board now goes through `core/store.py::blocks_of` (the tool's includes, the REST route, the text fallback,
`board_page` keeping a chat board into a page), so old boards, plain lists and envelopes all read the same.
An included board lends its **blocks**; its own words stay with the board it was saved for. The text-only
half (Telegram, CLI) ignores both words: the same boards read the same.

## How it is drawn

`readBlocks.ts` reads the envelope's words (gated on the object not having a `type`, so a section that
merely spells its children `blocks` is not mistaken for an envelope) and attaches each block's own ask in
`readOne` — no per-type reader was touched. `Blocks.tsx` resolves the cascade per block, top level or nested
(containers draw their children through the same `Placed` path, so a child's word lands inside its cell and
the cell keeps the layout it owns), and wraps only what is asked for:

- asked off left → `<div class="hb-place hb-place-center" data-align="center">…</div>`;
- words asked other than left, on heading/text/stat/callout only → the same wrapper grows `hb-ta-center`
  and `data-text-align`;
- nothing asked → **no wrapper at all**: an unasked board's DOM is byte-identical to before this change
  (`web/src/styles/widths.test.tsx` passes untouched).

## The CSS, and why the selectors compound

```css
.hb-place { display: flow-root; }
.hb-place.hb-place-center > * { margin-inline: auto; }
.hb-place.hb-place-right > * { margin-inline-start: auto; margin-inline-end: 0; }
```

The wrapper fills the column or cell exactly as the block did unwrapped, and the auto margin shares out only
the space the block left over: a capped card keeps its 720px cap centered, a fit-content table keeps hugging
(moved, not fattened), a full-width line shifts by nothing, and nothing in a flex column shrinks (pinned by
placed-vs-unplaced Chrome twins in cells and row cells).

**Two classes, on purpose:** `.hb-chart { margin: 0 }` (chart.css — it silences the host's figure margin)
and the host reset `.hb-blocks figure { margin: 0 }` tie a single placement class on specificity, and block
css is joined after tokens — so a plain `.hb-place-center > *` ask loses on load order alone. Measured
without the compounding: a centered capped chart sits flush left (0/380 on the 1100px column) while a
calculator centers fine. Compounded, the ask (0,2,0) outranks every block root reset; the centered chart
measures **190/190**, symmetric, in real Chrome. This is the chart-cascade fix proven on our fork line
(card t_64a23a22, reviewed PASS) brought upstream in its corrected form.

The four top-level width caps (`.hb-blocks > .hb-chart/.hb-calc/.hb-form/.hb-sim`) are duplicated through the
wrapper in each block's own css, so a placed card keeps the cap it had unplaced.

## Tests

| suite | base | candidate |
|---|---|---|
| pytest (`tests/pytest.ini`) | 1105 passed, 1 skipped | **1141 passed, 1 skipped** (+14 python, +21 Chrome) |
| vitest | 559 passed / 79 files | **594 passed / 80 files** (`core/placement.test.tsx`, reader + host tests) |
| `tsc --noEmit`, `ruff` | clean | clean |

`tests/test_layout_alignment.py` is a self-contained real-Chrome witness (stdlib + pytest; skips only when no
Chrome binary exists): it feeds headless Chrome the repo's own stylesheets and the DOM the renderer grows, and
asserts measured rects — symmetric centered margins for a capped card **and a capped chart**, right-edge
hugging, cell twins, row stretch through the wrapper, the voice moving words (Range rects, not computed style)
and no boxes, and three negative controls that keep the fixed defect shapes permanently measurable (an
inline-style margin clear, a scoped not-shipped hug, an attribute without its class). Run it with
`pytest tests/test_layout_alignment.py -v`; every placement number in this document comes from that probe.

## Before / after

`captures/` (workspace, byte-reproducible across runs; one markup — the jsdom dump of this renderer drawing
the asked hero — and only the stylesheet's tree differs):

- `hero-before-left-aligned.png` (sha256
  `102f6eef55cb21fefcd3cafb56b0e3b4f1ff8b019806a09d7db6c2f4d418184f`) — upstream main `af8a4f6` with the asked
  DOM: the words are unknown, every block sits left, the chart fills the column.
- `hero-after-centered.png` (sha256
  `98f2d547608e2d7a93f8bfbacae19cffd8798439fe744635d2d08fc2b877c1d4`) — this candidate: the heading reads
  centered, the chart centers at 190/190, the callout's words center. Captions draw the margins Chrome
  measured in that render.
  Disclosed: `*{animation:none;transition:none}` is injected for a deterministic settle (the appear fades are
  one-shot, default fill-mode, so the settled style equals the no-animation style).

## Reconciliation with the open PRs (#30–#41)

No open PR adds or touches a placement/alignment **concept**: none stores an `align`/`text_align` word on a
board or block, and none grows a placement wrapper or class. (PR #40 adds compact phase tracking to the
checklist; PR #41 adds
a `columns[].align` word **inside the table's own fields** — how a numeric column sits in its cell. That is a
different object level: a #41 table asked `align: center` as a block would center the whole card while its
columns keep their cell alignment. The two compose without conflict.)

File-level overlap, for merge order:

| PR | shares with this branch | hunk overlap |
|---|---|---|
| #30–#36, #38, #40, #41 | `tests/hooks/test_text_fallback.py` (both append at EOF), `desktop/plugin.js` | none in code; trivial append/bundle conflicts |
| #33 | `web/src/styles/tokens.css` (adds `--hb-bad` tokens at the top; this appends at the bottom) | none |
| #34, #35, #36 | `web/src/blocks/chart/chart.css` (they add kind-specific rules after line 45; this edits lines 1–8) | none |
| #36 | `blocks/common.py` (it edits `out_of` at ~line 203; this adds `align_word` at ~line 40) | none |

Every PR rebuilds `desktop/plugin.js`, so whichever merges last regenerates the bundle — same as before this
change.

## What this change deliberately does not do

- No reader-facing alignment controls (the app's own override) — the model's cascade is the whole rule.
- No per-block text voice outside heading/text/stat/callout, no voice for layout drawings.
- Nothing for boards that say nothing: same JSON shape, same DOM, same pixels.
