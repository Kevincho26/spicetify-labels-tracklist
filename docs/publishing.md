# Publishing to the Spicetify Marketplace

Status: **not published.** This is the checklist for when the maintainer decides to publish. Requirements are from the Marketplace wiki page [Publishing to Marketplace](https://github.com/spicetify/marketplace/wiki/Publishing-to-Marketplace) (edited 2026-07-24), read on 2026-10-30. Re-read it before publishing.

## How the Marketplace finds extensions

- The repository must be **public** and have the GitHub topic **`spicetify-extensions`**.
- It must have a valid **`manifest.json` in the repository root**.
- It is read from the **default branch**, unless the manifest sets `"branch"`.
- Required fields for an extension: `name`, `description`, `preview` (image path), `main` (the `.js` file), `readme`. Optional: `branch`, `authors` (defaults to the repo owner), `tags`. Paths are relative to the repository root; http(s) URLs also work.

Because the Marketplace loads `main` straight from the branch, **every push to that branch reaches users**. Only merge builds that passed [testing.md](testing.md), and keep `dist/` committed.

## Checklist

1. **Licence.** Upstream declares MIT in `package.json` but ships no `LICENSE` file, and it is archived, so the author can't be asked through an issue. Add an MIT `LICENSE` that keeps Scott Duffey's copyright and adds the fork's, or decide otherwise, before publishing.
2. **Identity.** The original "Playlist Labels" may still be listed. Pick a distinct name (e.g. "Playlist Labels for Spotify 1.3") and description so users can tell them apart, and credit the original author in `authors`, e.g.:

   ```json
   {
     "name": "Playlist Labels for Spotify 1.3",
     "description": "Shows the covers of the playlists each track is in, in its own Labels column. Works with Tagify.",
     "preview": "preview.png",
     "main": "dist/spicetify-playlist-labels.js",
     "readme": "README.md",
     "authors": [
       { "name": "Scott Duffey", "url": "https://github.com/duffey" },
       { "name": "Kevin Andrés Choque Claros", "url": "https://github.com/Kevincho26" }
     ],
     "tags": ["playlist", "label", "tag", "tracklist", "tagify"]
   }
   ```
3. **Branch.** Merge `spotify-1.3` into `master` (the default branch), or set `"branch": "spotify-1.3"` in the manifest.
4. **Images.** `preview.png` and `screenshot.png` still show the 2024 layout. Replace them with a current screenshot (Labels column, tooltip). The wiki gives no size rule for extension previews.
5. **Topic.** Add `spicetify-extensions` to the repository topics.
6. **README.** Install instructions for Marketplace users (the current ones describe a manual install) and a note that the original extension should be uninstalled first.
7. **Verify.** After publishing, install from the Marketplace on a clean Spicetify setup and run the manual check.
