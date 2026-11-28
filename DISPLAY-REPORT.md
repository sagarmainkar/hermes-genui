# Display pack — what GenUI now draws

Branch `feat/cards-display` (from `b5523c0`, the `feat/cards-block` tip) — **round 2**: the review's two
functional fixes (a two-up hero wall; the one link policy that keeps the consumer's loopback URL) and fresh
evidence. Local only: no push, no PR,
no install, no change to the live plugin. Display capability only — no data connectors, no renderer
rewrite, no host change, no scheduling. Spec: `GENUI-DISPLAY-REQUESTS.md` (Flywheel / Mission Control).

The consumer derives every number read-only and hands GenUI a JSON board; GenUI draws it. Nothing
here reads a source, keeps state, or refreshes anything.

---

## 1. `cards[].span` — one card takes the row (P0)

```json
{"type":"cards","columns":2,"items":[
  {"title":"NEMO · GarzaOS management","span":2,"status":"active","needs":{"text":"4 plans await your yes","tone":"warn"}},
  {"title":"Update Newspaper","status":"active"}]}
```

* Rule: integer `1` or `2`. `2` fills the row on a two-up wall — stated `columns: 2`, or no `columns` at
  all (the wall's default is two). On `columns: 1|3` it is **ignored, never an error** (Python accepts it,
  the drawing leaves the card in its track).
* Render: `grid-column: 1 / -1` (`.hb-card-wide`) and a slightly larger title (17px/22px vs 15.5px/20px).
  A wall carrying a hero is measured against its own width and states **exactly two tracks** for the
  ordinary cards (`.hb-cards-2.hb-cards-hero` / `.hb-cards-auto.hb-cards-hero` → `repeat(2, minmax(0,1fr))`),
  collapsing to one track below ~620px. Without a hero the wall keeps the shipped auto-fit byte for byte.
  Same anatomy — ring, metrics, tags, needs, footer all unchanged.
* Measured (real Chrome, the real host `BlockTag` in a 1440×900 window; wall = the chat's 1100px reading cap):
  hero **1100px** = the wall's own width, then **2 × 545px** per row, **7 complete cards** in the first
  900px, **0** scrolling elements. Explicit `columns: 2` at a 984px wall → hero 984 + 2 × 487; at 584px →
  1 track. Unstated `columns` at 984 → `.hb-cards-auto.hb-cards-hero`, hero 984 + 2 × 487. `columns: 1` →
  no wide card; `columns: 3` at a 1100px wall → 3 × 360 and the span ignored.

## 2. `cards[].ring.size` — a legible ring on a narrow card (P0)

```json
"ring": {"stages":["PLAN","TRACK","IMPLEMENT","METRIC"],"at":0,"label":"smooth","tone":"good","size":"sm"}
```

* Rule: `"sm" | "md"` (default `md`), caseless and trimmed. Anything else is ignored (the ring draws `md`).
* Render: the same drawing at **28px** instead of 40px (same viewBox, so the marker geometry is identical).
  The 12px the ring gives up stays in the band as a `margin-right`, so **the metrics column does not move**.
* Measured (`40px ring` / `28px ring` cards, same metrics): ring boxes `[40,40]` vs `[28,28]`,
  `metricsLeft` **71 and 71** — the same x. Centre word: `getComputedTextLength` 27 (md) / 34 (sm) in
  a 40-unit viewBox, i.e. both are drawn at 7px and neither is clipped.
* The centre word keeps the ring's full word (`smooth`, `unknown`, …) — no ellipsis — and the ring keeps
  its `aria-label` (`"Lifecycle PLAN to TRACK to IMPLEMENT to METRIC, now PLAN, health smooth"`).

## 3. `cards[].tags` — up to three tiny chips (P0)

```json
"tags": ["blocked", "no evidence"]
```

* Rule: 0–3 strings, each ≤ 24 characters (Python refuses a fourth tag or a 25-character tag; the reader
  cuts over-long text to 24 and takes the first three).
* Render: a `<ul class="hb-card-tags">` beside the status chip in the head. Muted (`--hb-muted` on a
  `--hb-well` pill with a `--hb-line` border) and deliberately **not** tone-classed, so it can never take
  the colour of `needs`. `white-space: nowrap` + ellipsis: it truncates rather than wrapping, and the whole
  row is absent from the DOM when a card has none.

## 4. `cards[].stale` — old figures, said out loud (P1)

```json
"stale": true
```

* Rule: boolean (Python refuses `"true"`, `1`, `"yes"`).
* Render: the freshness line dims (`.hb-card-fresh-dim`, opacity .65) and a plain word `stale` appears in a
  muted chip beside it. Presentation only: metric values, the ring and the tone of `needs` are untouched
  (asserted in a test: a `warn` needs line stays `warn`, an `unknown` value stays `unknown`).
* Not colour-only: the chip is the literal word, and the word also joins the card's `aria-label`, so a
  screen reader hears it on the group.
* The footer draws for a stale card even when it has no freshness line.

## 5. A second action per card (P1)

```json
"action":    {"label":"Open chat","run":"Open the project chat for PJ-…"},
"secondary": {"label":"Browser","url":"https://…"}
```

* Rule: the same guards as `action` — a label is required, and a `run` that Hermes would act on before the
  model (`/`, `@`, `!`, `@file:`) drops the card, in Python and in the reader alike.
* **One link policy, both halves** (`core/fields.ts → safeLink`, `blocks/common.py → is_safe_link`):
  `https://` anywhere; `http://` **only on this machine** — `127.0.0.1`, `localhost`, `[::1]`, any port and
  path. Everything else (`javascript:`, `data:`, `ftp:`, `http://` to a remote host, and look-alike hosts
  such as `127.0.0.1.example.org` or `localhost.example.org`) is refused. The consumer's documented
  `http://127.0.0.1:8765/#/project/PJ-…` therefore survives; the Python checker refuses a bad URL with
  `<path>.url: url must be https, or http on this machine (127.0.0.1, localhost, [::1])`. Every other block
  keeps the strict `https()` guard — widening the whole product was not this card's business.
* Render: the primary keeps its bordered button; the secondary is a quiet text link (no border, no fill,
  muted, underlined) on the same line, right of the primary. A `run` secondary is a button in that style;
  a `url` secondary is an `<a rel="noreferrer">`; a URL the policy refuses draws no link at all.
* The text fallback prints the loopback link (`also: [Browser](http://127.0.0.1:8765/#/project/PJ-…)`) and
  prints only the label for a URL it refuses, so no clickable address is invented.

## 6. `cards[].metrics[].trend` — a sparkline where a number has a shape (P1)

```json
{"label":"velocity","value":"0.75/wk","trend":[0.4,0.5,0.75]}
```

* Rule: optional, 2–60 finite numbers — the **same rule as `kpis`**: the checker reuses `blocks/kpis.py`'s
  rule (now a public `is_trend`), and the reader uses the same filter (finite only, last 60, ≥ 2).
* Render: a 64×20px line after the value, no axis, no labels, `aria-hidden` (the value already says the
  number); omitted silently when there is no trend. Measured: three sparklines on the four-card wall, the
  one metric without a trend draws none.

## 7. `columns: 3` (P1)

* Rule: `1 | 2 | 3`. `3` collapses to two and then one.
* Render: three tracks. The breakpoint is measured against **the wall's own width** (`.hb-cards-frame`,
  `container-type: inline-size`), not the window: the same board is drawn in a chat column, in the Mission
  Control pane (~380–700px) and in the webapp, so a narrow pane must collapse even in a wide window.
  Media queries are the fallback for engines without container queries.
* Measured: wall 1100px → **3 tracks of 360px**; wall 1000px → 2 of 495; wall 700px → 1 of 700. The
  1100px wall is the consumer's own target (three 360px cards, six on a screen).

## 8. `chart` donut/pie: `center` and `highlight` (P2)

```json
{"type":"chart","kind":"donut","center":{"label":"PLAN","value":"smooth"},"highlight":0,
 "x":["PLAN","TRACK","IMPLEMENT","METRIC"],"series":[{"name":"Projects","data":[5,2,3,4]}]}
```

* Rule: `center {label, value}` needs both words (Python refuses a half pair); `highlight` is an integer
  index into `x` (Python refuses an out-of-range index). **Both are ignored by every other kind**, without
  an error — checked on both sides.
* Render: the donut's hole shows `center.value` (big) and `center.label` (small) instead of the drawing's
  own total; the pie shows them above. `highlight` keeps that slice at full opacity and fades the rest
  (0.55) at rest, which a pointer or the arrow keys override exactly as before.
* The index is resolved **by name**, so it still means the right slice after `pieSlices` drops empty slices
  (measured: `x` index 2 with `data[1] = 0` still lights the second *drawn* slice).
* Measured: donut hole text `smooth` + `PLAN`, slice opacities `[1, 0.55, 0.55, 0.55]`.

## 9. `cards.shelves` — one block, three groups (P2)

```json
{"type":"cards","shelves":[
  {"label":"Needs you · 3","items":[…]},
  {"label":"Active · 4","items":[…]},
  {"label":"Parked · 7","items":[…]}]}
```

* Rule: `shelves` is an alternative to `items` — the two together are refused with
  `cards takes items or shelves, not both`. A shelf is `{label, items}`, 1–6 shelves, 1–14 cards each,
  1–14 cards in the block; the cards inside are checked exactly like a flat list (a bad `span` reports
  `0.shelves.0.items.0.span`).
* Render: a small uppercase heading and the **same wall** beneath it (same tracks, same card anatomy,
  same span rules), one group per shelf. The section is a labelled group (`aria-label` = the shelf label).
* A stored block that says both `items` and `shelves` draws `items` (the reader notes the shelves as
  ignored) rather than drawing either twice.

---

## Hard constraints

* **Honesty intact.** `unknown` is still drawn as the literal muted word, and none of the new fields can
  change, hide, recolour or zero it. Tests assert it per field, and once more with every new field at once.
  The text fallback never says `clear` for a card whose values are unknown.
* **Text fallback keeps everything.** `hooks/text_fallback.py` reads, per card: `tags: blocked · no evidence`,
  a metric's trend as its latest numbers (`velocity 0.75/wk (trend 0.4 → 0.5 → 0.75)`), `· stale` on the
  needs line, `also: [Browser](https://…)` for the secondary, and `**Needs you · 1**` headings for shelves.
* **Both surfaces.** One component (`registry.tsx → Cards`), one stylesheet, one bundle: Desktop chat, the
  Mission Control pane (through `MessageTextContent`) and the webapp all draw the same `Cards` from the same
  `readBlocks`. The rebuilt `desktop/plugin.js` is the bytes all three ship
  (`c70e903d9978b21c042bb80f50b619e700240849d4f384bea0b91613b7d76fad`). The drawing was exercised through
  the host's own `BlockTag` — the component the Desktop transcript's `hermes-genui-tag` contribution renders
  and the one a `::blocks{id}` tag resolves to inside the Mission Control pane. What the actual app surfaces
  require is stated in deviation 8.
* **Theme + a11y.** Colours are tokens only (`--hb-muted`, `--hb-line`, `--hb-well`, `--hb-accent-ink`,
  `--hb-ink-2`) — no hex in `cards.css`. Light and dark were both captured; the card is a labelled group
  (`<article aria-label>`), the ring keeps its lifecycle `aria-label`, tags are real text, `stale` is a
  real word in the chip and in the card's label.

## Tests

| Suite | Base `b5523c0` | Round 1 | Round 2 (now) |
|---|---|---|---|
| Python `pytest blocks core hooks` | 424 passed | 443 passed | **445 passed** (+2) |
| Web `vitest run` | 977 in 92 files | 1014 in 95 files | **1021 in 95 files** (+7) |
| `tsc --noEmit` | clean | clean | clean |

Round 2's new cases: `safeLink` accepts https anywhere and http only on `127.0.0.1` / `localhost` / `[::1]`,
and refuses remote http, look-alike hosts, `javascript:`, `data:`, `ftp:` and non-strings (web
`core/fields.test.ts` + cards reader, Python `test_a_link_is_https_anywhere_and_http_only_on_this_machine`,
both action and secondary); the text fallback keeps the loopback link and drops a refused one (Python); the
hero wall states two tracks with an explicit *and* an unstated `columns`, ignores the span on 1/3 columns,
keeps a hero-less board exactly as shipped, and gives a shelf's hero its two tracks (web
`Cards.display.test.tsx`).

New files (round 1; round 2 adds cases to the first, third and fourth): `tests/blocks/test_cards_display.py`,
`tests/blocks/test_chart_centre_highlight.py`, `web/src/blocks/cards/read.test.ts`,
`web/src/blocks/cards/Cards.display.test.tsx`, `web/src/blocks/chart/wheel.test.tsx`, plus two `safeLink`
cases in `web/src/core/fields.test.ts`.

Python cases: bad `span` (0, 3, `"2"`, `true`, 1.5), `span` 2 with columns 1/3/none (accepted),
bad `ring.size`, > 3 tags, a tag of 25 characters, a non-string tag, non-boolean `stale`, a metric trend
with 1 / 61 / non-numeric / null points, `items` + `shelves`, a shelf with no label or no cards, a bad card
inside a shelf, `columns` 0/4/`"3"`/`true`, a secondary with a `/ @ !` run — each with its exact
`<path>: <reason>`.

Web cases: the readers for every field, and render-smoke through the real `readBlocks → Blocks` path for
span, `ring.size: "sm"`, tags, stale, the secondary action (link and button), the sparkline, columns 3,
donut `center`/`highlight` and shelves.

**RED evidence** (the new tests against the unwritten feature, `git checkout` of the sources only):
Python `17 failed, 2 passed`; Web `26 failed, 10 passed` (round 1). Round 2, with only the six changed source
files reverted: Web `8 failed, 40 passed` (`cards/*` + `core/fields.test.ts`), Python `2 failed, 16 passed`
(`test_cards_display.py`) — the two link tests and the hero/columns assertions really do depend on the fix.

`tests/test_library_host_integration.py`'s bundle pin was updated to the rebuilt bytes. That suite cannot
run in this card's venv (`uvicorn` is not installed), so the pin is verified by hash, not by that test:
`shasum -a 256 desktop/plugin.js` = `c70e903d9978b21c042bb80f50b619e700240849d4f384bea0b91613b7d76fad`,
identical over two builds.

## Evidence

Real Chrome (headless, `--force-prefers-reduced-motion`), the plugin's own stylesheet and the shipped
`readBlocks` path. Driver: `evidence/probe2.tsx` (bundled with the repo's `esbuild`, `--loader:.css=text`) in
this card's workspace — not in the repo. Two kinds of scene: **host** scenes mount the real `BlockTag` with a
stub `load` (what `::blocks{id=…}` becomes in the Desktop transcript, and what the Mission Control pane's
`MessageTextContent` resolves the same tag to), inside a `.hb-blocks` chat column; **layout** scenes mount
`Blocks` directly at a chosen wall width. Everything is measured from `getBoundingClientRect` and
`getComputedStyle`, not from a picture; `evidence/report2.json` is the machine-readable dump.

The 14-card consumer mix: 10 cards with `unknown` velocity/delivery and `dark` health, 3 with a `needs`
line, 1 parked with no evidence, the first card the hero (`span: 2`), plus the consumer's
`http://127.0.0.1:8765/#/project/PJ-…` secondary on the hero.

| Scene (host tag unless noted) | Wall | Tracks | Complete cards in 900px | Result |
|---|---|---|---|---|
| 14 cards, chat column, 1440×900 | 1100 | **2 × 545** | **7** | hero **1100** (full row), rest 2-up; 0 inner scroll |
| the same, dark | 1100 | 2 × 545 | 7 | identical geometry |
| 14 cards, Mission Control pane ~700 | 684 | 2 × 337 | 7 | stays 2-up at pane width |
| 14 cards, pane ~380 | 364 | **1 × 364** | 4 | collapses to one track |
| hero, `columns: 2` (layout) | 984 | 2 × 487 | 4 | hero 984 = full row |
| hero, `columns: 2`, narrow | 584 | 1 × 584 | 4 | one track below ~620 |
| hero, **no** `columns` | 984 | 2 × 487 | 4 | `.hb-cards-auto.hb-cards-hero` |
| hero, `columns: 1` | 984 | 1 × 984 | 4 | span ignored, no wide card |
| hero, `columns: 3` | 1100 | 3 × 360 | 4 | span ignored, three-up |
| ring 40 vs 28 (layout) | 704 | 2 × 347 | — | ring 40/28, `metricsLeft` **71 both** |
| shelves, hero in shelf 1 (layout) | 984 | 2 × 487 | 7 | 8 cards, hero 984 + 487/487 |
| donut `center`/`highlight` (layout) | 640 | — | — | hole reads `smooth` / `PLAN`, slices `[1, .55, .55, .55]` |

Also measured in the host scenes: 30 `unknown` words drawn literally (never a zero, never blank), the `stale`
chip once, tags `blocked · 2 overdue · no evidence`, 2 sparklines, and the hero's secondary as a real
`<a href="http://127.0.0.1:8765/#/project/PJ-20261023-001">`.

Images (card workspace `evidence/`): `r2-tag-wall14-chat.png`, `r2-tag-wall14-chat-dark.png`,
`r2-hero-2up-1000.png`, `r2-hero-auto-1000.png`, `r2-hero-col3-1100.png`, `r2-shelves-1000.png`,
`r2-ring-compare-720.png`; `dom2.html` is the DOM the measurements came from.

**The actual app surfaces (Desktop chat / Mission Control pane / webapp).** Attempted, not produced, and the
reason is a host limit, not this pack: the card forbids installing the rebuilt plugin into the live app or
changing the live plugin, and the two real surfaces on this machine both load the *installed* bundle. An
isolated Hermes home was built instead (`~/hermes-sandboxes-t_f29e8090`, its own gateway on 127.0.0.1:9131,
the candidate `plugin.js` in `desktop-plugins/hermes-genui` with the pin's exact bytes, a seeded session
carrying `::blocks{id="5e0b1a2c"}` and the 14-card board in the store). Result: the real **webapp**
(v0.23.4+1076) signed in and drew the session, but its renderer never ran the disk-plugin loader — its own
bridge listed the folder (`desktopPluginsRoot` → `…/desktop-plugins`, `hermes-genui` present), yet no
`hermes-genui-css` style element and no `[plugins]` console line appeared, so the tag stayed the literal
text `::blocks{id="5e0b1a2c"}`. The packaged Desktop app refuses a second instance driven over CDP
(`sandbox_extension_issue_file … Operation not permitted`, no `HERMES_DESKTOP_CDP_PORT` listener), and the
Mission Control pane needs the installed Desktop host to mount `MessageTextContent` at all.

So the surfaces were exercised at the seam the drawing lives on — the host's own `BlockTag` with the real
stylesheet, the real reader and the real bundle — in light and dark at 1440×900, and the one step that
remains is a host install: put `c70e903d…` in the live `desktop-plugins/hermes-genui/plugin.js` (or run a
Desktop build that loads disk plugins) and reload. That step is explicitly out of this card's authority.

## Deviations and limitations (with reasons)

1. **`sm` "drops the segment labels" had nothing to drop.** The ring never drew per-segment labels — only
   the centre word and the four arcs — so `sm` keeps the marker and the centre word and adds nothing. It
   is not a skipped item; the visible difference is 40px → 28px and the reserved band width.
2. **The 3-column breakpoint is 1099px, and it measures the wall, not the window.** `.hb-blocks` stops at a
   1100px reading width in chat (`tokens.css`), so a literal `max-width: 1100px` would collapse exactly the
   board the consumer asked for (three 360px cards). Measuring the wall instead of the window is what makes
   the same board behave in the ~380–700px Mission Control pane; the media queries remain as a fallback.
3. **The link policy is new and card-only (round 2).** `safeLink` / `is_safe_link` accept `https://`
   anywhere and `http://` only on `127.0.0.1` / `localhost` / `[::1]`, so the consumer's documented
   `http://127.0.0.1:8765/…` survives on `action` and `secondary`. Every other block keeps the old strict
   `https()` guard: widening the whole product would change boards outside this pack, which this card may
   not do. A note for whoever *does* widen it: the rule is one line in `core/fields.ts` and its mirror in
   `blocks/common.py`.
4. **A hero wall is exactly two tracks; a hero-less `columns: 2` keeps the shipped auto-fit.** With a
   `span: 2` card the wall states `repeat(2, minmax(0,1fr))` (hero full row, the rest 2-up, one track below
   ~620px) — that is the contract the review asked for. Without a hero, `columns: 2` still auto-fits
   (`minmax(300px, 1fr)`), so a *non-hero* shelf can draw three across at a wide wall, exactly as boards
   shipped before this pack do; tightening it would relayout every live board, so it is reported, not done.
   `columns: 3` is exact (3 → 2 below 1099px of wall → 1 below 720).
5. **A long trend in the text fallback is the latest 12 points**, not all 60: a sparkline cannot be drawn as
   text, and 60 numbers would swamp the paragraph. The rule that decides whether it is drawn is the same
   (2–60 finite), so nothing is silently accepted that would not be drawn.
6. **`.hb-card-tags` is capped at 45% of the head** so three tags can never starve the title; longer tags
   truncate with an ellipsis (the full text stays in the DOM for assistive tech and in `aria-label` terms).
7. **Untracked leftovers in the working tree, not touched.** `web/src/blocks/wallBlocks.test.tsx` and
   `web/src/blocks/chart/kinds.test.tsx` (from the previous card's test pack), `CARD-MENU.md`,
   `IDEAS-BOARD.md`, `PR-BLOCK-PACK.md` and the `web/node_modules` symlink were already untracked at
   `b5523c0`. None of them is in this branch's commits; the two test files are, however, counted in the
   "before/after" vitest numbers above (the suite runs whatever is in the tree).
8. **A board that never said `columns` now carries `.hb-cards-auto` instead of `.hb-cards-2`.** The tracks
   are the same auto-fit rule (both classes share it), so the drawing is unchanged; the class had to be
   distinguishable so a hero could force exactly two tracks only where the wall means two-up. Anything that
   *queried* `.hb-cards-2` on an unstated board would need `.hb-cards-2, .hb-cards-auto` — the repo's own
   tests were updated.
9. **The real host surfaces could not be exercised with the candidate bundle** — see the Evidence section:
   the live Desktop app and the live webapp load the *installed* bundle, installing the rebuilt one is
   outside this card's authority, the webapp build does not run its disk-plugin loader, and a second
   packaged Desktop instance cannot be driven over CDP. The host seam itself (`BlockTag`, the component the
   transcript and the Mission Control pane mount) was exercised instead, with the bundle's own bytes pinned.

## How to verify

```
cd web && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run && node build.mjs
cd tests && <venv>/bin/python -m pytest -q blocks core hooks
shasum -a 256 desktop/plugin.js   # c70e903d9978b21c042bb80f50b619e700240849d4f384bea0b91613b7d76fad
```

The evidence harness (this card's workspace, not the repo):

```
cd evidence
<repo>/web/node_modules/.bin/esbuild probe2.tsx --bundle --outfile=probe2.js \
  --jsx=automatic --loader:.css=text --format=esm
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --force-prefers-reduced-motion --window-size=1440,900 --virtual-time-budget=8000 \
  --dump-dom "file://$PWD/probe2.html" > dom2.html
```

`?only=<scene id>` draws a single scene for a `--screenshot` run.

`node build.mjs` leaves `git status` clean (a second build is byte-identical).
