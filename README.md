# Spicetify Playlist Labels

Adds playlist labels to your tracklist indicating the playlists in which a track is included. Clicking a label jumps to the playlist.

![Screenshot](screenshot.png)

## About this fork

The original project is archived. This fork updates it for **Spotify 1.3.x** (tested layout-wise against 1.3.6), where the legacy `main-trackList-*` class names are gone:

- Track rows are found through ARIA roles (`role="grid"`, `role="row"`, `aria-colindex`), and track URIs are read by walking the row's React fiber parents instead of a fixed props path.
- Labels live in their **own column** with a header. The column is added to each row's existing `grid-template-columns`, so it works with any number of columns (artist pages, "Added by" on collaborative playlists, columns added by other extensions).
- **Tagify compatible**: the label column always sits right before Tagify's rating column, whichever extension loads first.
- The column width comes from the real width of the track list (by default at most 20% of it), so it adapts when the right panel opens or closes. Labels that don't fit collapse into `⋯`.
- No React rendering (plain DOM), so it doesn't depend on Spotify's React version.

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
- **Rebuild cache**: reloads every playlist from scratch.

Advanced settings, set from DevTools (`spicetify enable-devtools`) and applied after a reload (Ctrl+Shift+R):

```js
localStorage.setItem('spicetify-playlist-labels:max-width-ratio', '0.25') // largest share of the track list width the column may take (default 0.2)
localStorage.setItem('spicetify-playlist-labels:max-labels', '10')        // maximum number of labels per row (default 20)
localStorage.setItem('spicetify-playlist-labels:rated-folder', 'Rated')   // labels for playlists in this folder sit closest to the rating column
```

## Troubleshooting

Run `PlaylistLabels.debug()` in DevTools. It shows how many track lists and rows were detected, the URI read from a sample row, its labels and the grid template in use.

## Build

```bash
npm install
npm run build
```

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
