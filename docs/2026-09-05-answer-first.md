# Answer-first page (v2)

Date: 2026-09-05. Status: decided, implementing. Supersedes the implicit v1 design that grew through review rounds.

## Pain

A Free Mobile subscriber about to travel wants one answer: **does my plan work there, what is included, what would it cost, and would Free Max change that?** v1 shows a correct map but makes the reader hunt for the answer with a mouse: the search only moves the camera, the answer lives in a hover tooltip nobody can copy or reach by keyboard, and the state that costs money (non inclus) is the least visible colour on the map. Critique 2026-09-05: 20/40, two P0s.

Whose pain: the owner and friends on the 20 € plan; occasionally someone deciding whether Free Max is worth it for a trip.

## Decisions

1. **The answer is a panel, not a tooltip.** One `#answer` region under the search, `aria-live="polite"`, filled by the same content function for three entry points: search, clicking a country or dot, clicking a name in the lists. It persists until the next selection and is encoded in the URL hash (`#JE`) so an answer can be shared and restored on load. The hover tooltip stays but shrinks to name plus one status line per plan; the panel carries tariffs, allowance, networks, sub-regions and the upgrade line.
2. **Both plans stay on one map**, because the owner wants to see at a glance where an upgrade would change things. Max-only is a **solid** third colour (blue), not a hatch; the hatch read as "uncertain". Legend text carries the meaning; the panel says explicitly "Free Max : internet illimité ici" or "Free Max ne change rien ici".
3. **Non inclus must read as a state.** Ocean darkens, land stays white, so white land is a figure on a ground. Ink colours are separate tokens from fill colours so status text meets 4.5:1 in both schemes.
4. **The map is presentational for assistive tech** (`aria-hidden`), because svgMap emits no names on paths. Parity comes from the lists: each destination is a button that opens the panel. The zoom controls get French labels and a reset button.
5. **Legend toggles recolour in place** rather than rebuilding the SVG, so zoom and pan survive. Theme change recolours in place too.
6. **Structure**: an `h1` with a one-sentence promise above the map; legend directly above the map; lists below, filtered by the search text.
7. **Failure is explicit.** If the data does not load, the page says so in plain French, links the official page, and hides the legend and lists. When data is older than three weeks, a banner says so above the map.

## What happens when

- Search "coree du nord" (not a Free destination): the panel says it is not included in either plan and the map zooms to it. Search "zzz": the panel says nothing matched and lists three closest names; the map does not move.
- Click Cyprus: the panel headline is Chypre; Chypre du Nord appears as its own block because its status differs; networks are listed per block.
- Click the USA: one block, "Même statut : Alaska, Hawaï", plus "réseaux partenaires différents" because their operators differ.
- Uncheck "Tout inclus": France and every red country turn white in place; the current zoom is kept; the panel is untouched.
- Load `#MO`: the panel shows Macao and the map zooms to its dot.
- Switch to dark mode while zoomed: fills update in place, zoom kept.
- Data older than 21 days: banner above the map; colours unchanged.
- No data: message with the official link; no legend, no lists, no map.
- Touch: tapping a country opens the panel, not a tooltip. Zoom buttons are 44 px.

## Out of scope

A plan selector that hides the other plan (the owner prefers both visible). Native-app affordances. Any framework or build step.

## Addendum, same day

8. **The controls live in a floating dock at the bottom**, in the style of firsty.app: search first, then Translate and appearance, on a pill that is 82 % background colour with a saturating blur and a fade beneath it. Bottom placement puts the primary control in the thumb zone on phones. Readability is the constraint, so the surface is mostly opaque and falls back to fully opaque without `backdrop-filter`.
9. **The map is full width until a selection exists**; the card then opens beside it (below it under 900 px) and closes with ✕ or Escape, returning focus to whatever opened it.
10. **Flags.** The card headline and the tooltip carry the country's emoji flag from its ISO code; sub-regions show their parent's.
11. **A missing status is "none".** Countries Free does not list at all must never be painted; the layer test is positive (`freeMax` is `full` or `data`), never "not none".
12. **Hidden layers paint a neutral grey**, never the "non inclus" white.
13. **Maritime networks**, which have no territory, are listed in a note under the lists rather than dropped.
