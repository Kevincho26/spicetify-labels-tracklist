# Development history

How this fork came about, step by step, so the reasoning can be reviewed later. All work happened on 2026-10-30 in one Claude Code session with the maintainer testing each build in their own Spotify. Commits are on the `spotify-1.3` branch.

## Starting point

- **Setup:** Spotify for Windows 1.3.6.1921, Spicetify 2.46.4, Marketplace 1.0.12, [Tagify](https://github.com/alexk218/tagify) (star ratings column) and the archived [duffey/spicetify-playlist-labels](https://github.com/duffey/spicetify-playlist-labels) (last commit 2024-08-20) installed from the Marketplace.
- **Symptom:** after a laptop reset and reinstall, Playlist Labels was installed but showed no labels. It had worked before.
- **Goal:** make it work again and respect the current columns (Tagify's rating column; different column sets on artist pages and collaborative playlists; less room when the right panel is open).

## Diagnosis

Reading upstream's source showed three Spotify-version dependencies:

1. It found rows only through `.main-trackList-indexable`, `.main-trackList-trackListRow` and `.main-trackList-rowSectionEnd`.
2. It read track URIs through a fixed React props path.
3. It sized the layout with CSS hard-coded for 4, 5 or 6 columns (`aria-colcount`).

Tagify's source (read, not copied) states that Spotify 1.3.3 can omit the legacy classes, and it finds rows by ARIA roles instead. A check in the maintainer's DevTools confirmed it:

```js
[Spicetify.Platform.version, document.querySelectorAll('.main-trackList-indexable').length, document.querySelectorAll('[role="row"]').length]
// ['1.3.6.1921', 0, 55]
```

**Snippets or fork?** Marketplace snippets are CSS only and cannot fix row detection, and Tagify writes `grid-template-columns` inline with `!important`, which no stylesheet overrides. A fork was the only real fix.

## Iterations

| Version | Commit | Change | Feedback from the maintainer |
| --- | --- | --- | --- |
| 0.2.0 | [`54c2bc8`](https://github.com/Kevincho26/spicetify-labels-tracklist/commit/54c2bc8) | ARIA-based rows, fiber URI walk, own column before Tagify, width from the list's real width, plain DOM rendering, esbuild build. | Console: `[playlist-labels] could not load playlists Event` (and three update failures). No labels. |
| 0.2.0 | [`a0fdf2b`](https://github.com/Kevincho26/spicetify-labels-tracklist/commit/a0fdf2b) | The `Event` was an IndexedDB error. Made the cache optional (recreate once, then skip), cache plain fields only, log the real `DOMException`. | "Now it works." |
| 0.3.0 | [`03b56f5`](https://github.com/Kevincho26/spicetify-labels-tracklist/commit/03b56f5) | "Labels" header, covers the size of the track cover, tidy column widths (title / date added / labels / Tagify / duration; "added by" on collaborative playlists; plays on artist pages), `+N` button, Open/Remove menu, accessible buttons, reload on playlist changes. | Much better, but covers now looked bigger than the track's cover. |
| 0.3.1 | [`9dadd73`](https://github.com/Kevincho26/spicetify-labels-tracklist/commit/9dadd73) | Size from the measured track cover at 80%, no shadow. | "Perfect." |
| 0.3.2 | [`b9abe53`](https://github.com/Kevincho26/spicetify-labels-tracklist/commit/b9abe53) | Tippy's tooltip had no background on 1.3 and the name was lost over the covers. Replaced with a solid, delegated custom tooltip; other labels dim on hover. | "Perfect." |
| — | this commit | Documentation (this folder, `AGENTS.md`, changelog) and the mock test as a repeatable check. | — |

## Not yet observed in Spotify

Covered only by the mock test or by design (see [decisions.md](decisions.md)): removing a track through the right-click menu, keyboard navigation, the `RootlistAPI` update event, compact row mode, "Show all saved playlists", "Rebuild cache", light themes, macOS/Linux clients.

## Repositories

- Fork: [`Kevincho26/spicetify-labels-tracklist`](https://github.com/Kevincho26/spicetify-labels-tracklist), branch `spotify-1.3` (default branch `master` still equals upstream).
- Upstream: [`duffey/spicetify-playlist-labels`](https://github.com/duffey/spicetify-playlist-labels), archived; author Scott Duffey.
