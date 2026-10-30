# Architecture

How Playlist Labels works on Spotify 1.3.x. For why things are built this way, see [decisions.md](decisions.md); for how it got here, see [history.md](history.md).

## What it does

For every track row in a Spotify track list (playlists, Liked Songs, albums, artist pages, queue), it adds a **Labels** column with the cover art of every playlist in your library that contains that track. Clicking a cover opens that playlist at the track; right-clicking offers "Open" and "Remove from …".

## Modules

| File | Responsibility |
| --- | --- |
| [`src/index.ts`](../src/index.ts) | Entry point: settings, the update loop, rendering of cells, the "+N" and right-click menus, profile-menu settings, data refresh events, `PlaylistLabels.debug()`. |
| [`src/dom.ts`](../src/dom.ts) | Reading Spotify's track list DOM: finding grids and rows by ARIA roles, reading a row's track URI from React fiber props, inserting our cell, writing row templates. |
| [`src/layout.ts`](../src/layout.ts) | Column widths: parsing Spotify's named grid template, recognising each column from a sample row, building the tidied template with our column and Tagify's. |
| [`src/tooltip.ts`](../src/tooltip.ts) | One shared tooltip for labels, driven by event delegation. |
| [`src/playlist.ts`](../src/playlist.ts) | Data layer (from upstream, adapted): builds `track URI → playlists` from your library, cached in IndexedDB. |
| [`src/api.ts`](../src/api.ts) | Thin wrappers over `Spicetify.Platform` APIs and image URL handling. |
| [`src/style.css`](../src/style.css) | All styles, bundled as text and injected at startup. |
| [`build.mjs`](../build.mjs) | esbuild bundle into `dist/spicetify-playlist-labels.js`, the file Spicetify loads. |

## Data flow

```
startup ─► getTrackUriToPlaylistData()            (playlist.ts)
             ├─ RootlistAPI.getContents            all playlists and folders
             ├─ PlaylistAPI.getContents(uri)        only playlists whose track count changed
             ├─ LibraryAPI.getTracks                Liked Songs, when the count changed
             └─ IndexedDB cache                     uri/uid/name/image only; optional
           ─► trackUriToPlaylistData: { "spotify:track:…": [PlaylistData, …] }

events  ─► LibraryAPI "update"            → updateLikedTracks()
           PlaylistAPI "operation_complete" → updatePlaylistData(uri)
           RootlistAPI "update" (2 s debounce) → getTrackUriToPlaylistData()

DOM     ─► MutationObserver(main view) / ResizeObserver / History.listen
           → schedule() → one update() per animation frame
```

Data updates are queued one after another (`queueUpdate`), so a slow or failed load never overlaps or blocks the next one.

## The update loop

`update()` is idempotent: running it twice in a row changes nothing the second time, which is what keeps the MutationObserver from looping on our own changes.

For each track list (`role="grid"` inside the main view):

1. **Rows.** Header row = has `role="columnheader"` cells. Track rows = rows whose React props contain a `spotify:track:`/`spotify:local:`/`spotify:episode:` URI. Grids without track rows (card shelves) are skipped.
2. **Labels per row.** Playlists containing the track, minus the playlist you're on, minus playlists you don't own unless "Show all saved playlists" is on.
3. **Width.** See below. Stored as CSS variables on the grid, so a resize only updates two variables.
4. **Cells.** Each row gets one cell, inserted before Tagify's cell if present, otherwise before the last cell, and the row's `grid-template-columns` is rewritten (see Columns). A cell is only re-rendered when its render key (track, visible count, page, data version, settings) changes, so recycled rows of Spotify's virtualised list are picked up and unchanged rows cost nothing.
5. **Header.** Processed after the rows, because the rows tell which column is which.

## Columns

Spotify 1.3 lays out each row as a CSS grid whose template lives in a `--grid-template-columns` variable with named lines, e.g.:

```
[index] 16px [first] minmax(120px, 4fr) [var1] minmax(120px, 2fr) [var2] minmax(120px, 2fr) [last] minmax(120px, 1fr)
```

`layout.ts` parses that into tracks, recognises every `var*` column from a sample row's content, and rebuilds the template:

| Column | Recognised by | Tidy width |
| --- | --- | --- |
| `index` / `first` (title) / `last` (duration) | line name | Spotify's / `minmax(200px, 4fr)` / `minmax(120px, 0.5fr)` |
| Album | link to `/album/` | `minmax(120px, 2fr)` |
| Added by (collaborative playlists) | link to `/user/` | `minmax(110px, 1.25fr)` |
| Plays (artist pages) | digits and separators only | `124px` |
| Date added | other plain text | `124px` |
| Labels (ours) | `[plabels]` | `var(--spicetify-playlist-labels-width)` |
| Tagify | `[tagify]` | `112px` (Tagify itself uses 150px) |

Content-based detection works in any Spotify language. With **Tidy column widths** off, Spotify's widths are kept and only our column (and Tagify's 150px) is added. If a template can't be parsed, `ensureTemplate()` falls back to inserting our track before `[tagify]`/`[last]` in whatever template the row has.

### Tagify

[Tagify](https://github.com/alexk218/tagify) inserts its cell right before the last cell and replaces `[last]` with `[tagify] 150px [last]` in the row's inline template. We always insert **before** Tagify's cell and line, so the order is `… | Labels | Tagify | duration` whichever extension processes a row first, and Tagify's edit keeps our track. Rows are rewritten on the next frame when Tagify changes them. No Tagify code is used (it is GPL-3.0/BSL-1.1; this project is MIT).

## Label width and size

- **Size:** 80% (`cover-scale`) of the track's own cover image in that row, clamped to 16–48px; rows without covers (compact mode) use the row height.
- **Column width:** at most `max-width-ratio` (20%) of the track list width, and at most `max-labels` (20) covers. The visible count is the most labels any rendered row of that list needs, so the column doesn't jump while scrolling; it resets on navigation or data change. Covers that don't fit go behind a `+N` button.

Because the width is measured from the list itself, it adapts to the right panel, narrower artist pages and window size without per-page rules.

## Tooltip

Spicetify's Tippy tooltips render without their theme on Spotify 1.3, so `tooltip.ts` provides one tooltip element shared by all labels: delegated `pointerover`/`focusin` listeners on `document`, 350ms delay (none when moving between labels within 500ms), placed above (or below) and clamped to the viewport, hidden on click, scroll, wheel, Escape and window blur. Labels only carry a `data-` attribute, so re-rendering needs no cleanup.

## Spotify internals this depends on

These are the parts most likely to break when Spotify updates. Check them first (`PlaylistLabels.debug()` reports most of them):

| Dependency | Used for | If it breaks |
| --- | --- | --- |
| `role="grid"`, `role="row"`, `role="gridcell"`/`columnheader`, `aria-colindex` | finding rows and cells | no labels at all; `debug()` shows 0 grids or rows |
| `__reactFiber$…` → `memoizedProps.uri` / `.item.uri` / `.track.uri` within 10 parents | track URI of a row | `debug()` shows `trackRows: 0` |
| `--grid-template-columns` with `[last]` named line | column layout | fallback layout, `columns: null` in `debug()` |
| `Platform.RootlistAPI.getContents({ decorateImagesAndOwner: true })` | playlists, folders, images, owner | "could not load your playlists" notification |
| `Platform.PlaylistAPI.getContents`, `.remove`, `.getEvents()` | playlist tracks, removing, change events | |
| `Platform.LibraryAPI.getTracks`, `.getEvents()` | Liked Songs | |
| `Platform.History` (`location`, `listen`, `push`) | current page, navigation | |
| `Spicetify.Menu.SubMenu`, `Spicetify.Playbar.Button` | settings UI | settings menu missing; labels still work |

## Settings storage

Settings live in `localStorage` under `spicetify-playlist-labels:*` (documented in the [README](../README.md#settings)). The playlist cache is the IndexedDB database `spicetify-playlist-labels` (stores `playlists` and `playlistItems`, key `uri`). If it can't be opened it is deleted and recreated once; if that fails too, the extension runs without a cache.
