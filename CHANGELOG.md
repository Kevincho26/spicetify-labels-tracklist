# Changelog

All versions of this fork. Upstream history (0.1.0 and earlier) is in the git log of [duffey/spicetify-playlist-labels](https://github.com/duffey/spicetify-playlist-labels).

## 0.3.2 — 2026-10-30

- Readable tooltip with a solid background, replacing Spicetify's Tippy tooltip (unstyled on Spotify 1.3).
- Hovering a label dims the other labels in the row.

## 0.3.1 — 2026-10-30

- Label size is 80% of the track's own cover (32px in regular rows), configurable with `cover-scale`; no drop shadow.

## 0.3.0 — 2026-10-30

- "Labels" column header.
- Tidy column widths: columns recognised by content and resized around the title (date added, plays, Tagify 112px, duration fixed; album and "added by" narrower). Can be turned off.
- `+N` button lists the playlists that don't fit.
- Right-click menu with "Open" and "Remove from …", keyboard support.
- Labels are buttons with accessible names; reduced motion respected.
- Reload when playlists are created, deleted or renamed.

## 0.2.0 — 2026-10-30

- Works on Spotify 1.3: rows found by ARIA roles, track URIs from React fiber props.
- Labels in their own column, always before Tagify's.
- Column width from the track list's real width (right panel, artist pages).
- Plain DOM rendering; esbuild build.
- IndexedDB cache made optional and smaller; errors logged with their real cause.
- `PlaylistLabels.debug()` for troubleshooting.
