# Decision register

Engineering decisions made while updating Playlist Labels for Spotify 1.3, with how far each one has been tested. The format follows the decision register of [Kevin AI Engineering](https://github.com/Kevincho26/KEVIN_AI_ENGINEERING).

**Evidence**

| Evidence | Meaning |
| --- | --- |
| `VERIFIED` | Observed working in the maintainer's Spotify (1.3.6.1921, Windows, Spicetify 2.46.4, Tagify installed); the parenthesis says how |
| `MOCK` | Covered by the automated mock test (`npm run test:mock`), not yet observed in Spotify |
| `CONCEPTUAL` | Chosen by design; not exercised |

**Status:** `ACTIVE` (in use), `OPEN` (not decided), `DEFERRED` (postponed until needed).

## 1. Compatibility with Spotify 1.3

| Decision | Status | Evidence | Rationale |
| --- | --- | --- | --- |
| Fork the archived upstream instead of fixing it with CSS snippets | ACTIVE | VERIFIED (labels render again) | The breakage was in JavaScript (row detection, URI reading); Marketplace snippets are CSS only. Tagify's inline `!important` templates also beat any stylesheet. The upstream README invites forks. |
| Find grids, rows and cells by ARIA roles and `aria-colindex`; legacy `main-trackList-*` classes only as fallback | ACTIVE | VERIFIED (Spotify 1.3.6 reported 0 `.main-trackList-indexable` and 55 `[role="row"]`; labels render) | Spotify 1.3 removed the legacy classes. |
| Read the row's track URI by walking up to 10 React fiber parents for `uri`/`item.uri`/`track.uri` | ACTIVE | VERIFIED | Survives tree reshuffles, unlike upstream's fixed `props.children[0]…` path. |
| Render with plain DOM instead of `ReactDOM.render` | ACTIVE | VERIFIED | No dependency on Spotify's React version (`ReactDOM.render` is gone in React 19). |
| Build with esbuild instead of spicetify-creator | ACTIVE | VERIFIED (build used in Spotify) | spicetify-creator is unmaintained; esbuild gives a single IIFE with the CSS inlined. |
| Use the `uid` of the track in the playlist when removing | ACTIVE | MOCK | Upstream passed `uid: ""`. Not yet tried in Spotify. |

## 2. Data and cache

| Decision | Status | Evidence | Rationale |
| --- | --- | --- | --- |
| IndexedDB cache is optional: recreate once on error, then run without it | ACTIVE | VERIFIED (v0.2.0 failed with a bare IndexedDB `Event`; after this change labels appeared) | The cache only speeds up startup. Errors now log the real `DOMException`. The exact cause on the maintainer's machine was not captured. |
| Cache only `uri`, `uid`, name, image, owner, dates and counts | ACTIVE | VERIFIED (same as above) | Spotify 1.3 objects may not be storable (structured clone) and full objects bloat the cache. |
| One IndexedDB connection reused | ACTIVE | MOCK | Upstream opened a new connection per call and never closed them. |
| Reload when the library's playlists change (`RootlistAPI` `update`, debounced 2 s) | ACTIVE | CONCEPTUAL | Whether Spotify 1.3.6 emits this event is unverified; if not, the listener is skipped with a console warning and "Rebuild cache" covers it. |
| Playlists in a folder named `Rated` (setting `rated-folder`) come first | ACTIVE | CONCEPTUAL | Kept from upstream for star-rating playlists; now also matches nested folders. The maintainer has no such folder. |

## 3. Layout

| Decision | Status | Evidence | Rationale |
| --- | --- | --- | --- |
| Labels in their own column with a "Labels" header | ACTIVE | VERIFIED (screenshots of a collaborative playlist and an artist page) | Upstream squeezed labels into the last column. |
| Our column always sits right before Tagify's | ACTIVE | VERIFIED (screenshots) and MOCK (both load orders) | Tagify inserts before the last cell; inserting before Tagify is the only order that is stable regardless of which extension runs first. |
| Recognise columns from a sample row's content and rebuild the template ("Tidy column widths", on by default) | ACTIVE | VERIFIED (playlist, collaborative playlist and artist page screenshots) | Works in any language and with any column set; replaces upstream's hard-coded `aria-colcount` 4/5/6 rules. |
| Tagify column 112px while tidying | ACTIVE | VERIFIED (screenshots; stars fit) | Tagify's 150px left a large gap. Configurable with `tagify-width`. |
| Label column width ≤ 20% of the list, measured live | ACTIVE | VERIFIED (right panel open/closed, artist page) | Adapts to the right panel and narrower artist pages without per-page rules. |
| Label size = 80% of the track's measured cover | ACTIVE | VERIFIED (maintainer: "Perfecto") | A fixed 40px with a shadow looked bigger than the track cover. Configurable with `cover-scale`. |
| `+N` button listing hidden playlists instead of `⋯` | ACTIVE | VERIFIED (artist page screenshot shows `+1`/`+2`); menu MOCK | Hidden playlists stay reachable. |

## 4. Interaction and accessibility

| Decision | Status | Evidence | Rationale |
| --- | --- | --- | --- |
| Custom tooltip instead of Spicetify's Tippy | ACTIVE | VERIFIED (maintainer accepted v0.3.2) and MOCK | Tippy rendered without its theme on 1.3, so names were unreadable over the covers. |
| Dim the other labels of the row on hover | ACTIVE | VERIFIED (accepted with v0.3.2) | Makes clear which cover the tooltip belongs to. |
| Labels are `<button>`s with `aria-label`; menus support arrows and Escape; reduced motion respected | ACTIVE | MOCK (mouse paths); keyboard CONCEPTUAL | Keyboard and screen-reader access. |
| Right-click menu: "Open" and "Remove from …" | ACTIVE | MOCK | Removing in Spotify not yet tried. |

## 5. Project and process

| Decision | Status | Evidence | Rationale |
| --- | --- | --- | --- |
| Work on branch `spotify-1.3` of the fork; merge to `master` after use in daily listening | ACTIVE | — | Marketplace reads the default branch (unless `branch` is set in `manifest.json`). |
| Mock-DOM test in headless Chromium (`npm run test:mock`); Playwright not a project dependency | ACTIVE | VERIFIED (28 checks pass) | The only deterministic check available without Spotify. Keeps `npm install` small. |
| No Tagify code copied | ACTIVE | — | Tagify is GPL-3.0 with a BSL-1.1 notice; this project is MIT. Only the general technique (ARIA roles, fiber walk) is shared. |
| Publish to the Spicetify Marketplace | OPEN | — | See [publishing.md](publishing.md) for the checklist (licence file, name, preview, default branch). |
| Option to hide the Album column | DEFERRED | — | Suggested, not requested yet. |
