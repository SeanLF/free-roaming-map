# free-roaming-map

A world map of the destinations included in Free Mobile's **Forfait Free 5G+** and **Free Max**, in the style of the map Free used to publish before replacing it with a per-country search box. Red is internet plus calls, SMS and MMS; orange is internet only; blue is included only with Free Max; white is not included. Territories too small for the map's outlines (Jersey, Macao, Palau, ...) are dots. Click a country, a dot, or a name in the lists, or search it, and an answer panel shows both plans' status, the allowance before pay-per-use, tariffs, partner networks, sub-regions, and whether Free Max would change anything. The selection is in the URL hash, so an answer can be shared. Search, Translate and the appearance control live in a floating dock at the bottom, in the thumb zone. Design notes: `docs/2026-09-05-answer-first.md`.

Live: https://seanlf.github.io/free-roaming-map/

## How it stays current

A GitHub Actions workflow runs every Monday (and on demand). It:

1. Loads `mobile.free.fr/communications-a-l-etranger` and reads the destination list and plan data Free embeds in the page.
2. Calls Free's own `api/infos-voyage/country-info/<destination>` once per destination, sequentially and spaced out, because Free 503s and then blackholes bursty clients.
3. Classifies each destination per plan: `full` when internet, local calls, calls to France, received calls, SMS and MMS are all "inclus", `data` when only internet is, else `none`.
4. Maps Free's French names to ISO 3166-1 alpha-2 with `i18n-iso-countries`, plus a small override table for sub-national names (Açores, Baléares, Alaska, Tibet, Zanzibar, ...) that roll up to their sovereign state.
5. Commits `site/data.json` if it changed and redeploys GitHub Pages.

If fewer than 95% of destinations fetch, Free adds a name the mapping cannot resolve, or the result looks hollow (under 100 destinations, under 50 included or under 40 fully included per plan, which is what a renamed API field produces), the run fails and the previous dataset stays published. The page flags data older than three weeks.

The commit history of `site/data.json` is the change log of what Free added or removed.

## Development

```sh
npm ci
npm test          # name mapping, classification, roll-up
npm run fetch     # regenerate site/data.json (takes ~2 minutes)
npm run serve     # preview site/
```

Map rendering is [svgMap](https://github.com/StephanWagner/svgMap), loaded from jsDelivr with pinned versions and integrity hashes. The page is plain HTML with current CSS (`light-dark()`, nesting, `oklch`, `:has()`) and no build step, targeting current Safari, Chrome and Firefox.

Not affiliated with Free. Check the official page before travelling.
