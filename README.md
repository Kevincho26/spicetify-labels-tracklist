# Spicetify Playlist Labels

Adds playlist labels to your tracklist indicating the playlists in which a track is included. Clicking a label jumps to the playlist.

![Screenshot](screenshot.png)

## Documentation

- [Architecture](docs/architecture.md): how it works and which Spotify internals it depends on.
- [Decisions](docs/decisions.md): what was decided and how far it was verified.
- [Testing](docs/testing.md): mock test and manual checks.
- [History](docs/history.md): how this fork was made.
- [Publishing](docs/publishing.md): Marketplace checklist.
- [Changelog](CHANGELOG.md) · [Agent instructions](AGENTS.md)

## About this fork

The original project is archived. This fork updates it for **Spotify 1.3.x** (used daily on 1.3.6), where the legacy `main-trackList-*` class names are gone:

- Track rows are found through ARIA roles (`role="grid"`, `role="row"`, `aria-colindex`), and track URIs are read by walking the row's React fiber parents instead of a fixed props path.
- Labels live in their own **Labels** column, with covers sized from the track's own cover art (80% of it by default).
- **Tidy column widths**: Spotify's columns are recognised by their content (album link, "added by" user link, play count, date), so it works in any language, and resized so the title keeps most of the room: date added, play count, Tagify and duration get fixed widths, album and "added by" shrink.
- **Tagify compatible**: the order is always `… | Date added | Labels | Tagify | duration`, whichever extension loads first.
- The label column takes at most 20% of the track list width, so it adapts when the right panel opens and on narrower artist pages. Playlists that don't fit go behind a `+N` button that lists them.
- Hovering a label shows the playlist name in a solid, readable tooltip and dims the other labels in the row.
- Right-click a label to open the playlist or remove the track from it. Labels are keyboard accessible buttons.
- Labels update when tracks are added or removed and when playlists are created, deleted or renamed.
- The IndexedDB cache is optional: if it breaks, it is recreated, or skipped.
- Plain DOM rendering, so it doesn't depend on Spotify's React version.

## Install

1. Uninstall "Playlist Labels" from the Marketplace if it is installed.
2. Copy `dist/spicetify-playlist-labels.js` into the Spicetify `Extensions` folder (`spicetify path userdata` shows where it is; on Windows it's `%appdata%\spicetify\Extensions`).
3. Run:

```bash
spicetify config extensions spicetify-playlist-labels.js
spicetify apply
```

## Settings

From the profile menu, **Playlist Labels**:

- **Show all saved playlists**: also show playlists you follow but don't own (the playbar button does the same).
- **Show on artist pages**
- **Tidy column widths**: turn off to keep Spotify's own column widths and only add the Labels column.
- **Rebuild cache**: reloads every playlist from scratch.

Advanced settings, set from DevTools (`spicetify enable-devtools`) and applied after a reload (Ctrl+Shift+R):

```js
localStorage.setItem('spicetify-playlist-labels:max-width-ratio', '0.25') // largest share of the track list width the column may take (default 0.2)
localStorage.setItem('spicetify-playlist-labels:max-labels', '10')        // maximum number of labels per row (default 20)
localStorage.setItem('spicetify-playlist-labels:cover-scale', '0.8')      // label size relative to the track's cover art (default 0.8)
localStorage.setItem('spicetify-playlist-labels:tagify-width', '112')     // Tagify column width in px while tidying (default 112, Tagify's own is 150)
localStorage.setItem('spicetify-playlist-labels:rated-folder', 'Rated')   // labels for playlists in this folder come first
```

## Troubleshooting

Run `PlaylistLabels.debug()` in DevTools. It shows how many track lists and rows were detected, the URI read from a sample row, its labels and the grid template in use.

## Build and test

```bash
npm install
npm run build
npx tsc --noEmit
npm run test:mock
```

See [docs/testing.md](docs/testing.md) for what the mock test covers and how to check a build in Spotify.

## Credits

Original extension by [Scott Duffey](https://github.com/duffey) ([duffey/spicetify-playlist-labels](https://github.com/duffey/spicetify-playlist-labels)). Spotify 1.3 update and maintenance of this fork by [Kevin Andrés Choque Claros](https://github.com/Kevincho26).

## Star Rating Playlist Images

Thanks to [WildGenius](https://github.com/WildGenius) and [brimell](https://github.com/brimell) who made these awesome playlist images for people who wish to rate their tracks using a star rating system!

<p float="left">
<img src="images/1-star.png" width="100px">
<img src="images/2-stars.png" width="100px">
<img src="images/3-stars.png" width="100px">
<img src="images/4-stars.png" width="100px">
<img src="images/5-stars.png" width="100px">
<img src="images/unrated.png" width="100px">
<br />
<img src="images/0.5-stars.jpg" width="100px">
<img src="images/1-star.jpg" width="100px">
<img src="images/1.5-stars.jpg" width="100px">
<img src="images/2-stars.jpg" width="100px">
<img src="images/2.5-stars.jpg" width="100px">
<img src="images/3-stars.jpg" width="100px">
<img src="images/3.5-stars.jpg" width="100px">
<img src="images/4-stars.jpg" width="100px">
<img src="images/4.5-stars.jpg" width="100px">
<img src="images/5-stars.jpg" width="100px">
</p>
