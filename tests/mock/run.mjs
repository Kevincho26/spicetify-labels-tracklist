// Runs the built extension against a mock of Spotify 1.3's track list in
// headless Chromium and checks the behaviour documented in docs/testing.md.
//
//   npm run build && npm run test:mock
//
// Needs Playwright with a Chromium build (`npm i -g playwright` and
// `npx playwright install chromium`). It is not a project dependency so that
// `npm install` stays small.

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Looks for Playwright in the project first, then in the global npm folder.
function loadPlaywright() {
    const require = createRequire(import.meta.url);
    try {
        return require('playwright');
    } catch {
        const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
        return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
    }
}

let chromium;
try {
    ({ chromium } = loadPlaywright());
} catch {
    console.error('Playwright is not installed. Run: npm i -g playwright && npx playwright install chromium');
    process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const extension = readFileSync(path.join(here, '../../dist/spicetify-playlist-labels.js'), 'utf8');
const harness = pathToFileURL(path.join(here, 'harness.html')).href;

let failures = 0;
function check(name, condition, detail = '') {
    console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
    if (!condition) failures++;
}

// Installs the Spicetify stub and page helpers. Runs inside the page.
function setUpPage({ brokenIndexedDb }) {
    const color = (name) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${name}"/></svg>`);
    const colors = ['red', 'green', 'blue', 'orange', 'purple', 'teal', 'pink', 'yellow', 'cyan', 'gray', 'brown', 'lime'];
    // Playlist i holds tracks 0..i plus track 11; `play` is not cloneable, like Spotify's objects.
    const playlists = colors.map((name, i) => ({
        type: 'playlist', uri: `spotify:playlist:p${i}`, name: `PL ${name}`, isOwnedBySelf: i !== 3,
        addedAt: `2024-01-0${(i % 9) + 1}`, totalLength: 3, images: [{ url: color(name) }], play() {},
    }));
    const items = {};
    playlists.forEach((playlist, i) => {
        items[playlist.uri] = Array.from({ length: 12 }, (_, t) => t)
            .filter((t) => t <= i || t === 11)
            .map((t) => ({ uri: `spotify:track:t${t}`, uid: `u${i}_${t}`, fn() {} }));
    });

    if (brokenIndexedDb) {
        indexedDB.open = () => {
            const request = {};
            setTimeout(() => {
                request.error = new DOMException('Internal error opening backing store', 'UnknownError');
                request.onerror?.({ target: request });
            });
            return request;
        };
        indexedDB.deleteDatabase = indexedDB.open;
    }

    const historyListeners = [];
    const events = () => ({ addListener() {} });
    window.removed = [];
    window.Spicetify = {
        showNotification: () => {},
        SVGIcons: { spotify: '' },
        Platform: {
            version: 'mock', username: 'me',
            History: {
                location: { pathname: '/playlist/p0' },
                listen: (listener) => historyListeners.push(listener),
                push: ({ pathname }) => {
                    window.Spicetify.Platform.History.location = { pathname };
                    historyListeners.forEach((listener) => listener());
                },
            },
            RootlistAPI: {
                getContents: async () => ({ type: 'folder', items: [{ type: 'folder', name: 'Rated', items: [playlists[0]] }, ...playlists.slice(1)] }),
                getEvents: events,
            },
            PlaylistAPI: {
                getContents: async (uri) => ({ items: items[uri] }),
                remove: async (...args) => window.removed.push(args),
                getEvents: events,
            },
            LibraryAPI: {
                getTracks: async () => ({ totalLength: 2, items: [{ uri: 'spotify:track:t0', uid: 'l0' }, { uri: 'spotify:track:t5', uid: 'l5' }] }),
                getEvents: events,
            },
        },
    };

    const columnsByKind = {
        playlist: ['index', 'title', 'album', 'date', 'last'],
        collaborative: ['index', 'title', 'album', 'user', 'date', 'last'],
        artist: ['index', 'title', 'plays', 'last'],
    };
    const headers = { index: '#', title: 'Title', album: 'Album', user: 'Added by', date: 'Date added', plays: '', last: 'Time' };

    // `wrapped` puts the cells inside a role=presentation element, as some Spotify lists do.
    window.makeGrid = (id, kind, trackCount, { header = true, wrapped = false } = {}) => {
        const grid = document.createElement('div');
        grid.setAttribute('role', 'grid');
        grid.id = id;
        grid.classList.add(kind);
        const makeRow = (uri) => {
            const row = document.createElement('div');
            row.setAttribute('role', 'row');
            const container = wrapped ? document.createElement('div') : row;
            if (wrapped) {
                container.setAttribute('role', 'presentation');
                row.append(container);
            }
            container.classList.add('row-grid');
            columnsByKind[kind].forEach((column, index) => {
                const cell = document.createElement('div');
                cell.setAttribute('role', uri ? 'gridcell' : 'columnheader');
                cell.setAttribute('aria-colindex', String(index + 1));
                if (!uri) cell.textContent = headers[column];
                else if (column === 'index') cell.textContent = uri.slice(15);
                else if (column === 'title') cell.innerHTML = `<img class="cover" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="> Song ${uri.slice(15)}`;
                else if (column === 'album') cell.innerHTML = '<a href="/album/x">Album</a>';
                else if (column === 'user') cell.innerHTML = '<a href="/user/kevin">Kevin</a>';
                else if (column === 'date') cell.textContent = 'Apr 16, 2026';
                else if (column === 'plays') cell.textContent = '365,161,443';
                else cell.textContent = '3:11';
                container.append(cell);
            });
            if (uri) row.__reactFiber$mock = { memoizedProps: { className: 'row' }, return: { memoizedProps: { item: { uri } }, return: null } };
            return row;
        };
        if (header) grid.append(makeRow(null));
        for (let t = 0; t < trackCount; t++) grid.append(makeRow(`spotify:track:t${t}`));
        document.querySelector('main').append(grid);
        return grid;
    };

    // Simplified stand-in for Tagify: a cell right before the last one and
    // "[tagify] 150px" before "[last]" in the row's inline template.
    window.addTagifyColumn = () => {
        document.querySelectorAll('[role=row]').forEach((row) => {
            if (row.querySelector('.tagify-info, .tagify-header')) return;
            const isHeader = !!row.querySelector('[role=columnheader]');
            const cells = [...row.querySelectorAll('[aria-colindex]')];
            const last = cells.at(-1);
            const container = last.parentElement;
            const inline = container.style.getPropertyValue('grid-template-columns');
            const template = inline.includes('[last]') ? inline : getComputedStyle(container).getPropertyValue('--grid-template-columns');
            const cell = document.createElement('div');
            cell.setAttribute('role', isHeader ? 'columnheader' : 'gridcell');
            cell.className = isHeader ? 'tagify-header' : 'tagify-info';
            cell.textContent = isHeader ? 'Tagify' : '★★★★★';
            cell.setAttribute('aria-colindex', last.getAttribute('aria-colindex'));
            last.setAttribute('aria-colindex', String(Number(last.getAttribute('aria-colindex')) + 1));
            container.insertBefore(cell, last);
            container.style.setProperty('grid-template-columns', template.replace('[last]', '[tagify] 150px [last]'), 'important');
        });
    };

    // Column order of a row: LABELS, TAGIFY or the cell text.
    window.describeRow = (row) => [...row.querySelectorAll('[aria-colindex]')].map((cell) => {
        if (cell.matches('.spicetify-playlist-labels-cell, .spicetify-playlist-labels-header')) return 'LABELS';
        if (cell.matches('.tagify-info, .tagify-header')) return 'TAGIFY';
        return cell.textContent.trim().slice(0, 12);
    });
    window.trackSizes = (row) => getComputedStyle(row.querySelector('[aria-colindex]').parentElement).gridTemplateColumns
        .replace(/\[[^\]]*\]\s*/g, '').split(' ');
}

async function openPage(browser, options = {}) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('pageerror', (error) => check('no page errors', false, error.message));
    await page.goto(harness);
    await page.evaluate(setUpPage, { brokenIndexedDb: !!options.brokenIndexedDb });
    return page;
}

async function loadExtension(page) {
    await page.addScriptTag({ content: extension });
    await page.waitForFunction(() => document.querySelector('.spicetify-playlist-labels-label'));
    await page.waitForTimeout(100);
}

const browser = await chromium.launch();

for (const tagifyFirst of [false, true]) {
    const scenario = tagifyFirst ? 'Tagify loads first' : 'Tagify loads after';
    const page = await openPage(browser);
    await page.evaluate(() => makeGrid('playlist', 'playlist', 12));
    if (tagifyFirst) await page.evaluate(() => addTagifyColumn());
    await loadExtension(page);
    if (!tagifyFirst) {
        await page.evaluate(() => addTagifyColumn());
        await page.waitForTimeout(100);
    }

    const result = await page.evaluate(() => {
        const rows = document.querySelectorAll('#playlist [role=row]');
        const grid = document.querySelector('#playlist');
        return {
            header: describeRow(rows[0]),
            row: describeRow(rows[1]),
            sizes: trackSizes(rows[1]),
            headerSizes: trackSizes(rows[0]),
            headerText: rows[0].querySelector('.spicetify-playlist-labels-header').textContent,
            labelSize: grid.style.getPropertyValue('--spicetify-playlist-labels-size'),
            columns: PlaylistLabels.debug().grids[0].columns,
            more: document.querySelector('#playlist .spicetify-playlist-labels-more')?.textContent,
            currentPlaylistShown: [...document.querySelectorAll('#playlist .spicetify-playlist-labels-label')].some((label) => label.getAttribute('aria-label') === 'PL red'),
        };
    });
    check(`${scenario}: column order`, result.row.slice(-3).join() === 'LABELS,TAGIFY,3:11', result.row.join(' | '));
    check(`${scenario}: header order`, result.header.slice(-3).join() === 'LABELS,TAGIFY,Time', result.header.join(' | '));
    check(`${scenario}: header and rows share widths`, result.sizes.join() === result.headerSizes.join());
    check(`${scenario}: header text`, result.headerText === 'Labels');
    check(`${scenario}: columns detected`, result.columns?.join() === 'index,title,album,date,last', result.columns?.join());
    check(`${scenario}: date, Tagify and duration widths`, result.sizes[3] === '124px' && result.sizes[5] === '112px' && result.sizes[6] === '120px', result.sizes.join(' '));
    check(`${scenario}: label size is 80% of the 40px cover`, result.labelSize === '32px', result.labelSize);
    check(`${scenario}: "+N" button for labels that don't fit`, /^\+\d+$/.test(result.more ?? ''), result.more);
    check(`${scenario}: current playlist has no label`, !result.currentPlaylistShown);
    await page.close();
}

{
    const page = await openPage(browser);
    await page.evaluate(() => makeGrid('playlist', 'playlist', 12));
    await loadExtension(page);
    const wide = await page.evaluate(() => parseInt(document.querySelector('#playlist').style.getPropertyValue('--spicetify-playlist-labels-width')));
    await page.evaluate(() => document.documentElement.style.setProperty('--main-view-width', '1050px'));
    await page.waitForTimeout(200);
    const narrow = await page.evaluate(() => parseInt(document.querySelector('#playlist').style.getPropertyValue('--spicetify-playlist-labels-width')));
    check('label column narrows when the main view does (right panel)', narrow < wide, `${wide}px -> ${narrow}px`);

    // Tooltip: delayed, then immediate between neighbours, hidden on wheel.
    const labels = page.locator('#playlist [role=row]').nth(3).locator('.spicetify-playlist-labels-label');
    await labels.nth(1).hover();
    await page.waitForTimeout(150);
    check('tooltip waits before showing', await page.locator('.spicetify-playlist-labels-tooltip-visible').count() === 0);
    await page.waitForTimeout(400);
    const tooltipText = await page.locator('.spicetify-playlist-labels-tooltip').textContent();
    check('tooltip shows the playlist name', tooltipText === await labels.nth(1).getAttribute('aria-label'), tooltipText);
    await labels.nth(2).hover();
    await page.waitForTimeout(100);
    check('next label shows its tooltip at once', await page.locator('.spicetify-playlist-labels-tooltip-visible').count() === 1);
    await page.mouse.wheel(0, 10);
    await page.waitForTimeout(50);
    check('tooltip hides on scroll', await page.locator('.spicetify-playlist-labels-tooltip-visible').count() === 0);

    // Right-click menu removes the track using its UID in that playlist.
    await labels.nth(1).click({ button: 'right' });
    await page.locator('.spicetify-playlist-labels-menu button', { hasText: 'Remove from' }).click();
    await page.waitForTimeout(100);
    const removed = await page.evaluate(() => window.removed);
    check('remove passes the playlist URI and track UID', removed.length === 1 && /^u\d+_2$/.test(removed[0][1][0].uid), JSON.stringify(removed));

    // A recycled row (same element, new track) is re-rendered.
    const key = await page.evaluate(() => {
        const row = document.querySelectorAll('#playlist [role=row]')[1];
        row.__reactFiber$mock.return.memoizedProps.item.uri = 'spotify:track:t11';
        row.append(document.createComment('re-render'));
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(row.querySelector('.spicetify-playlist-labels-cell').dataset.renderKey))));
    });
    check('recycled rows re-render for the new track', key.startsWith('spotify:track:t11|'), key);
    await page.close();
}

{
    const page = await openPage(browser);
    await page.evaluate(() => {
        Spicetify.Platform.History.location = { pathname: '/artist/x' };
        makeGrid('artist', 'artist', 5, { header: false, wrapped: true });
        makeGrid('collaborative', 'collaborative', 12);
    });
    await loadExtension(page);
    const columns = await page.evaluate(() => PlaylistLabels.debug().grids.map((grid) => grid.columns?.join()));
    check('artist page: play count column detected (wrapped cells, no header)', columns[0] === 'index,title,plays,last', columns[0]);
    check('collaborative playlist: "added by" column detected', columns[1] === 'index,title,album,addedBy,date,last', columns[1]);
    await page.close();
}

{
    const page = await openPage(browser, { brokenIndexedDb: true });
    await page.evaluate(() => makeGrid('playlist', 'playlist', 12));
    await loadExtension(page);
    check('labels still render when IndexedDB is broken', await page.locator('.spicetify-playlist-labels-label').count() > 0);
    await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
