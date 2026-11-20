# UPSTREAM — Living Boards: chat boards become addressable, updatable, linkable objects

For the hermes-genui maintainer. One focused enhancement on top of `main` @ `af8a4f6` (0.4, the
per-block catalog): **a board's tag id is its address, and the board can be updated in place at that
address — history kept, edits preserved, other boards reachable by link.** Nothing upstream does this:
today "update the numbers" means a NEW board and a stale twin left in the chat.

Baseline: `af8a4f6` · Branch: `living-boards-upstream` · Built and independently reviewed first as a
local daily-use stack (7 review rounds, PASS WITH NOTES); this candidate is the same feature
**re-implemented for the current 0.4 architecture**, not a copy of the local bundle.

| Seam | File | What it adds |
|------|------|--------------|
| store | `core/store.py` | `update()` writes a NEW version at the SAME address; the version that was current is archived whole into a `<id>.versions.json` sidecar (cap 8 versions / 512 KB). Lenient readers `blocks_of / version_of / updated_at_of / links_of`. A board that was never updated keeps answering `load()` with exactly the bytes it always had. |
| words | `blocks/common.py` | `board_address` (the 8 hex chars of a tag id, `#`-and-case tolerant), `link_problems / link_words` (1-3 links, notes kept whole, duplicates collapsed). |
| tool | `tools/show_blocks.py` | Two optional parameters, `target` and `links`. `target` updates THAT board in place and answers the SAME tag; a wrong or unknown address is refused, never silently redrawn fresh. `links` records connections to stored boards. `describe()` and `catalog.json` are untouched — the words live in the parameter descriptions (both schema modes carry them). |
| REST | `dashboard/plugin_api.py` | `GET /blocks/{id}` answers the CURRENT version and speaks `version / updated_at / links` when the board has them; `?version=N` reaches an archived version in the SAME shape (retrieval, never a redraw); `GET /blocks/{id}/versions` lists the history. Unsaid boards answer exactly `{"blocks": [...]}` as before, byte for byte. |
| web | `web/src/core/living-identity.ts` (new), `boardRoster.ts` (new), `blockState.ts` (new), `LivingBoards.tsx` (new), `savedState.ts`, `readBlocks.ts`, `fields.ts`, `Blocks.tsx`, `host/BlockTag.tsx`, `blocks/{checklist,form,calculator,simulate,layout}` | One address, one live view: the first tag of an id owns the live view, later tags draw a pointer and POKES the owner, whose refetch updates the SAME mounted elements. An update CARRIES each block's identity (its own words, never its slot) so React reconciles survivors onto their mounted elements; interactive answers (ticks, sent records, sliders, drafts, tab picks) belong to the BOARD — filed on the state door at the edit itself, by position until the first update makes the board living, by identity after, and migrated across moves and headless updates from the STORED specs with a misfire guard that never lets a replaced block wear a dead one's bytes. The live row shows the address, version, date, reach-back buttons and link chips; a link opens the linked board fetched whole by its own address, and its state answers file against the LINKED board's id. |

## Invariants kept from the reviewed build

1. **The board's identity is its filename/address.** `update()` answers the same id; the tag the chat
   already quoted keeps drawing, now the current version.
2. **Update-in-place keeps the address and a bounded history.** The version that was current is
   archived whole beside the board and stays reachable via `?version=N` — within explicit caps: the
   newest `HISTORY_MAX` (8) archived versions under `HISTORY_LIMIT` (512 KiB), oldest dropped past
   them. The current version is never dropped; a reach-back past the cap honestly 404s.
3. **Links between boards.** A link is an address the store confirmed; opening one fetches that
   board, whole, and its interactive state stays keyed to its own address.
4. **Interactive state is board-held, not page-held.** Every wired answer reaches the state door at
   the edit itself (coalesced for transient kinds, immediate for persisted ones); releasing a view
   destroys nothing; a reopen — or a fresh browser — finds it.
5. **Unsaid bytes unchanged.** A board that was never updated is a plain list on disk, answers the
   REST exactly as before, draws the DOM it always drew (index keys, no live row, no wrapper).
   `tests/fixtures/describe.txt`, `catalog.json` and the create-path answer text are byte-stable —
   pinned by `test_describe_budget_untouched` and `test_create_answer_text_is_byte_stable`.

## Adaptation deltas vs the local stack this feature was built on

- The local envelope carried `align / text_align / as_of / live / follow_ups / density / palette /
  motion` words; upstream 0.4 has none of them, so the envelope here carries only
  `version / updated_at / links`, and the identity canonicalizer has no presentation words to skip.
- drawAll keeps upstream's index keys for plain lists (the local build had moved to content keys);
  carried/minted keys appear ONLY on a list an update actually replaced.
- `simulate`'s slider set and view pick are wired like `calculator`'s (same answer class);
  per-interaction view state that upstream keeps page-scoped today (hover, flip, flow lighting,
  section open/close, the sim scrub position and Play) is deliberately OUT of scope — the same
  boundary the reviewed build accepted.
- No Library/export/expand chrome exists upstream, so the live row and the link panel stand alone.

## Tests (all run on the frozen tree)

- pytest: full suite green (`evidence/final-pytest.log`), including the new
  `tests/core/test_store_versions.py`, `tests/tools/test_show_blocks_living.py`,
  `tests/dashboard/test_plugin_api_living.py` — written first, RED on the base (logs attached).
- vitest: 589 green, incl. `BlockTag.living.test.tsx` (10 cases), `living-identity.test.ts`,
  `readLiving.test.ts`. TDD: 8 of the 10 living cases fail on the pre-wiring tree (the two that pass
  are the unsaid-board byte-identity guards, which must hold in both trees) —
  `evidence/red-wiring-vitest.log`.
- **Real Chrome, real store door, no environment** — `python3 tests/living_boards_envfree_witness.py`
  (exit 0/1/3; a thin pytest wrapper runs the same script so CI and a reviewer execute
  byte-identical evidence). Six scenarios, each with the browser PROCESS DYING between the edit and
  the reopen: address create→tick→HEADLESS update-in-place→reopen keeps the tick, speaks `v2` and
  the address, reaches `v1` back through `?version=1`; links reach-back opens a board by address;
  calculator drag → headless first update → reopen shows 700/Half=350; form draft; tab pick by real
  pointer click; and the misfire guard (a replaced calculator draws its own spec, the old bytes stay
  inert, never erased, never worn by a stranger).

## Overlap with open PRs

`apoapostolov` #30–#41 add block-level fields (table columns, checklist item states, chart kinds,
KPI change, list bars, null semantics). Living Boards touches no block reader except to replace
`useState` with `useStoredValue` in checklist/form/calculator/tabs/simulate — textual conflicts are
plausible in `Checklist.tsx`/`Form.tsx` (their #32/#40 add fields; this changes the state hook),
semantically none: board state and block fields are different seams. #53 (recipes) touches `recipes/`
only. The store/REST seams here are untouched by every open PR.

## Evidence captures (durably attached to this card as chunked rows — reassembly in the ledger)

Produced through the **`genui_capture.py` workflow**: the real app (the shipped `BlockTag` renderer
bundled from each tree, served by a door answering the shapes each tree actually answers) drives the
scenario in headless Chrome — create → headless update-in-place → reach-back → link chip open — and
each SETTLED page's host DOM is dumped and handed to `genui_capture.render()` for the PNG. render()
assembles the page from the repo's own shipped CSS — the full stylesheet in the shipped order parsed
from `web/src/styles/index.ts`, which places the host `blockTag.css` at its shipped position exactly
as the tool's docstring prescribes for host chrome — plus the tool's app-approximated dark theme vars
(the fix for the round-1 captures: the custom page left those vars unresolved, so `--hb-ink` fell
back to its light-ink default on a dark background). Entrance animations are injected off
(`*{animation:none}`) for determinism — faithful here because every entrance on this surface is a
one-shot fade with default fill-mode (the settled style equals the no-animation style). The reach-back
phase waits for BOTH the row word and v1's own bytes, so the picture shows the completed retrieval,
not a mid-transition frame. Two driver runs produced byte-identical PNGs (the `capture-v2-run1/2`
logs in the evidence bundle). History shown is BOUNDED: the archive keeps the newest 8 versions
under 512 KiB (see invariant 2); the captures show retrieval inside that cap.

`before-duplicate-boards.png` (base main: two tags, two boards, the stale twin),
`after-update-in-place-pointer.png` (the same address updated headlessly: live row `v2 · date ·
#address · v1↩`, the later tag a pointer), `after-reach-back-v1.png` (v1 retrieved from the archive —
v1's own bytes on screen, row says `viewing v1`),
`before-unconnected-boards.png` / `after-link-opens-board.png` (the link chip opening the Q3 board
fetched by its own address).

## What adopting this does NOT change

`show_blocks` without `target`/`links` behaves exactly as before; `store.save/load/load_state/
save_state` keep their shapes; the state door protocol is unchanged (identity keys are just new keys
in the same object); old boards and old replies draw byte-identically. The only new files are one
sidecar per UPDATED board (`<id>.versions.json`) and four new web modules.
