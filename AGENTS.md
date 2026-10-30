# AGENTS.md

Instructions for agents (Claude Code, Codex, others) working on this repository: a Spicetify extension that shows, in a "Labels" column of Spotify's track lists, the covers of the playlists each track is in. Fork of the archived [duffey/spicetify-playlist-labels](https://github.com/duffey/spicetify-playlist-labels), updated for Spotify 1.3.

## Read first

1. [`docs/architecture.md`](docs/architecture.md): modules, update loop, column layout, Spotify internals this depends on.
2. [`docs/decisions.md`](docs/decisions.md): what was decided and how far it was verified.
3. [`docs/testing.md`](docs/testing.md): how to check a change.
4. [`docs/history.md`](docs/history.md): how the fork got here.

## Commands

```bash
npm install          # esbuild and TypeScript only
npm run build        # dist/spicetify-playlist-labels.js
npx tsc --noEmit     # type check
npm run test:mock    # mock Spotify 1.3 DOM in headless Chromium (needs Playwright, see docs/testing.md)
```

Run all three checks after every change, and commit the rebuilt `dist/` file with the source: Spicetify and the Marketplace load it straight from the repository.

## Rules

- **Spotify's DOM is not stable.** Detect by ARIA roles, `aria-colindex`, named grid lines and content, never by hashed class names. Keep legacy `main-trackList-*` selectors only as fallbacks.
- **Keep `update()` idempotent.** A second run must not change the DOM, or the MutationObserver will loop. Write templates through `setTemplate()` and styles only when they changed.
- **Stay compatible with Tagify.** Our cell goes before `.tagify-info`/`.tagify-header` and our track before `[tagify]`. Don't copy Tagify code: it is GPL-3.0/BSL-1.1 and this project is MIT.
- **No React rendering.** Plain DOM keeps the extension independent of Spotify's React version.
- **Every Spotify API call can fail.** Wrap it, log with the `[playlist-labels]` prefix, and keep the labels working without it where possible.
- **Settings** go in `localStorage` under `spicetify-playlist-labels:` and must be documented in the README.
- **Record evidence honestly.** When a change is verified only by the mock test, say so in `docs/decisions.md`; `VERIFIED` means seen in a real Spotify.
- **Update the docs with the code:** `CHANGELOG.md` and the `VERSION` constant in `src/index.ts` plus `package.json` for user-visible changes; `docs/decisions.md` for decisions; `docs/architecture.md` when the structure or a Spotify dependency changes.
- **Publishing gates.** Pushing to the default branch, publishing to the Marketplace, or changing licence or authorship needs the maintainer's explicit approval. See [`docs/publishing.md`](docs/publishing.md).
