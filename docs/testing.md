# Testing

There are two levels of checks. Run both before merging or publishing.

## 1. Automated: mock test

`tests/mock/` loads the built extension into headless Chromium on a mock of Spotify 1.3's track list ([`harness.html`](../tests/mock/harness.html)): no legacy classes, rows found by ARIA roles, row templates in `--grid-template-columns`, track URIs only in React fiber props, a stub `Spicetify` object and a simplified stand-in for Tagify's column.

```bash
npm install
npm run build
npx tsc --noEmit
npm run test:mock
```

`test:mock` needs Playwright with Chromium (`npm i -g playwright` and `npx playwright install chromium`); it is not a project dependency. It exits non-zero if any check fails.

What it checks:

- column order `… | Labels | Tagify | duration` in rows and header, whichever extension loads first;
- header text, column recognition, tidy widths (date 124px, Tagify 112px, duration 120px) and identical widths in header and rows;
- label size (80% of a 40px cover), `+N` button, no label for the current playlist;
- the label column narrows when the main view does (right panel);
- tooltip: delay, instant switch between neighbours, hidden on scroll;
- right-click "Remove" passes the playlist URI and the track's UID;
- recycled rows re-render for their new track;
- artist page (play count, cells wrapped in `role="presentation"`, no header) and collaborative playlist ("added by") detection;
- labels still render when IndexedDB cannot be opened.

What it cannot check: whether Spotify's real DOM and Platform APIs still look like the mock. That is what the manual check is for.

## 2. Manual: in Spotify

1. Build, copy `dist/spicetify-playlist-labels.js` into the Spicetify `Extensions` folder and run `spicetify apply`.
2. Open DevTools (`spicetify enable-devtools`, then Ctrl+Shift+I) and look for `[playlist-labels] vX.Y.Z loaded` and no `[playlist-labels]` errors.
3. Check visually:
   - a regular playlist, Liked Songs, a collaborative playlist ("Added by" column) and an artist page ("Popular");
   - with the right panel open and closed;
   - Labels column before Tagify's stars; covers slightly smaller than the track cover;
   - hover tooltip readable; `+N` lists the rest; clicking a cover opens the playlist at the track.
4. If anything is off, run `PlaylistLabels.debug()` on that page. It reports detected grids and rows, the URI and labels of a sample row, the recognised columns and the native and applied grid templates.

When Spotify updates, start with the "Spotify internals this depends on" table in [architecture.md](architecture.md).
