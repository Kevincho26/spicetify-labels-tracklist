import css from './style.css';
import { removeTrackFromPlaylist } from './api';
import { CELL_CLASS, HEADER_CLASS, WIDTH_VAR, ensureTemplate, getRowLayout, getRowUri, getRows, getTracklists, insertCell, isHeaderRow } from './dom';
import { clearCache, getTrackUriToPlaylistData, updateLikedTracks, updatePlaylistData } from './playlist';

const PREFIX = 'spicetify-playlist-labels:';
const SIZE_VAR = '--spicetify-playlist-labels-size';
const GAP = 6;
const OVERFLOW_WIDTH = 14 + GAP;
const LIKED_SONGS_PATH = '/collection/tracks';

function readSetting<T>(key: string, fallback: T): T {
    try {
        const value = localStorage.getItem(PREFIX + key);
        return value == null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function writeSetting(key: string, value: unknown) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

const settings = {
    showAllPlaylists: readSetting('show-all', false),
    showOnArtistPages: readSetting('show-on-artist-pages', true),
    // Share of the track list width the label column may take. Keeps the
    // title/album columns readable when the right panel is open.
    maxWidthRatio: readSetting('max-width-ratio', 0.2),
    maxLabels: readSetting('max-labels', 20),
};

interface PlaylistData {
    uri: string | null;
    name: string;
    trackUid: string;
    image: string;
    isOwnPlaylist: boolean;
    isLikedTracks: boolean;
}

interface GridState {
    // Resets whenever the page or the data changes.
    key: string;
    // Most labels any row of this list has needed so far; only grows while
    // scrolling so the column doesn't jump around.
    maxCount: number;
    visibleCount: number;
}

let trackUriToPlaylistData: Record<string, PlaylistData[]> = {};
let dataVersion = 0;
let updatePromise: Promise<unknown> = Promise.resolve();
let highlight: { trackUri: string; path: string; until: number } | null = null;
let scheduledFrame = 0;
const gridStates = new WeakMap<HTMLElement, GridState>();

function currentPath(): string {
    return Spicetify.Platform.History.location.pathname;
}

function playlistPath(playlistData: PlaylistData) {
    if (playlistData.isLikedTracks) return LIKED_SONGS_PATH;
    return `/playlist/${playlistData.uri!.split(':').pop()}`;
}

function getLabels(trackUri: string, path: string): PlaylistData[] {
    return (trackUriToPlaylistData[trackUri] ?? []).filter((playlistData) =>
        (settings.showAllPlaylists || playlistData.isOwnPlaylist) && playlistPath(playlistData) !== path);
}

function schedule() {
    if (scheduledFrame) return;
    scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = 0;
        try {
            update();
        } catch (error) {
            console.error('[playlist-labels] update failed', error);
        }
    });
}

function update() {
    const path = currentPath();
    const hidden = !settings.showOnArtistPages && path.startsWith('/artist/');

    for (const grid of getTracklists()) {
        let header: HTMLElement | null = null;
        const tracks: { row: HTMLElement; uri: string }[] = [];
        for (const row of getRows(grid)) {
            if (isHeaderRow(row)) {
                header = row;
                continue;
            }
            const uri = getRowUri(row);
            if (uri) tracks.push({ row, uri });
        }
        // Card shelves and other grids have no track rows.
        if (tracks.length === 0) continue;

        const stateKey = `${path}|${dataVersion}|${settings.showAllPlaylists}`;
        let state = gridStates.get(grid);
        if (!state || state.key !== stateKey) {
            state = { key: stateKey, maxCount: 0, visibleCount: 0 };
            gridStates.set(grid, state);
        }

        const rows = tracks.map(({ row, uri }) => {
            const labels = hidden ? [] : getLabels(uri, path);
            state!.maxCount = Math.max(state!.maxCount, labels.length);
            return { row, uri, labels };
        });

        updateWidth(grid, state, tracks[0].row);
        if (header) ensureCell(header, createHeaderCell);
        for (const { row, uri, labels } of rows) {
            const cell = ensureCell(row, createRowCell);
            if (cell) renderCell(cell, uri, labels, state.visibleCount, stateKey);
            if (highlight && highlight.trackUri === uri && highlight.path === path) {
                highlight = null;
                row.scrollIntoView({ block: 'center' });
                row.click();
            }
        }
    }

    if (highlight && Date.now() > highlight.until) highlight = null;
}

/**
 * Sizes the label column from the space the track list actually has, so it
 * adapts to the right panel, artist pages, collaborative playlists ("Added
 * by" column) and other extensions' columns without hard-coded layouts.
 */
function updateWidth(grid: HTMLElement, state: GridState, sampleRow: HTMLElement) {
    const rowHeight = sampleRow.getBoundingClientRect().height || 56;
    const size = Math.round(Math.min(32, Math.max(16, rowHeight * 0.5)));
    const available = grid.getBoundingClientRect().width * settings.maxWidthRatio;
    const fit = Math.max(1, Math.floor((available - OVERFLOW_WIDTH + GAP) / (size + GAP)));
    const count = Math.min(state.maxCount, fit, settings.maxLabels);
    const overflow = state.maxCount > count;
    const width = count === 0 ? 0 : count * size + (count - 1) * GAP + (overflow ? OVERFLOW_WIDTH : 0);

    state.visibleCount = count;
    setStyle(grid, WIDTH_VAR, `${width}px`);
    setStyle(grid, SIZE_VAR, `${size}px`);
}

function setStyle(element: HTMLElement, property: string, value: string) {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
}

function ensureCell(row: HTMLElement, create: () => HTMLElement): HTMLElement | null {
    const layout = getRowLayout(row);
    if (!layout) return null;
    const className = isHeaderRow(row) ? HEADER_CLASS : CELL_CLASS;
    let cell = Array.from(row.getElementsByClassName(className) as HTMLCollectionOf<HTMLElement>)
        .find((candidate) => candidate.closest('[role="row"]') === row) ?? null;
    if (cell && cell.parentElement !== layout.container) {
        cell.remove();
        cell = null;
    }
    if (!cell) {
        cell = create();
        insertCell(layout, cell);
    }
    ensureTemplate(layout);
    return cell;
}

function createHeaderCell() {
    const cell = document.createElement('div');
    cell.className = HEADER_CLASS;
    cell.setAttribute('role', 'columnheader');
    cell.title = 'Playlists';
    const icon = Spicetify.SVGIcons?.playlist;
    if (icon) cell.innerHTML = `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${icon}</svg>`;
    return cell;
}

function createRowCell() {
    const cell = document.createElement('div');
    cell.className = CELL_CLASS;
    cell.setAttribute('role', 'gridcell');
    // Keep clicks on labels from selecting or playing the row.
    for (const type of ['dblclick', 'mousedown']) {
        cell.addEventListener(type, (event) => {
            if ((event.target as HTMLElement).closest('.spicetify-playlist-labels-label')) event.stopPropagation();
        });
    }
    return cell;
}

function renderCell(cell: HTMLElement, trackUri: string, labels: PlaylistData[], visibleCount: number, stateKey: string) {
    const renderKey = `${trackUri}|${visibleCount}|${stateKey}`;
    if (cell.dataset.renderKey === renderKey) return;
    cell.dataset.renderKey = renderKey;

    const container = document.createElement('div');
    container.className = 'spicetify-playlist-labels-labels';
    if (labels.length > visibleCount) container.classList.add('spicetify-playlist-labels-overflow');
    for (const playlistData of labels.slice(0, visibleCount)) {
        container.append(createLabel(playlistData, trackUri));
    }
    cell.replaceChildren(container);
}

function createLabel(playlistData: PlaylistData, trackUri: string) {
    const label = document.createElement('div');
    label.className = 'spicetify-playlist-labels-label';
    if (playlistData.isLikedTracks) label.classList.add('spicetify-playlist-labels-liked');

    if (playlistData.image) {
        const image = document.createElement('img');
        image.src = playlistData.image;
        image.alt = '';
        image.loading = 'lazy';
        image.draggable = false;
        image.addEventListener('error', () => image.remove());
        label.append(image);
    }

    addTooltip(label, playlistData.name);

    label.addEventListener('click', (event) => {
        event.stopPropagation();
        const path = playlistPath(playlistData);
        highlight = { trackUri, path, until: Date.now() + 10_000 };
        Spicetify.Platform.History.push({ pathname: path, search: `?uid=${playlistData.trackUid}` });
    });

    if (!playlistData.isLikedTracks) {
        label.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            showRemoveMenu(event, playlistData, trackUri);
        });
    }

    return label;
}

function addTooltip(element: HTMLElement, text: string) {
    if (typeof Spicetify.Tippy === 'function') {
        try {
            Spicetify.Tippy(element, { ...Spicetify.TippyProps, content: text, delay: [200, 0] });
            return;
        } catch {
            // Fall through to the native tooltip.
        }
    }
    element.title = text;
}

function showRemoveMenu(event: MouseEvent, playlistData: PlaylistData, trackUri: string) {
    document.querySelector('.spicetify-playlist-labels-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'spicetify-playlist-labels-menu';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const button = document.createElement('button');
    button.textContent = `Remove from ${playlistData.name}`;
    button.addEventListener('click', async (clickEvent) => {
        clickEvent.stopPropagation();
        menu.remove();
        try {
            await removeTrackFromPlaylist(playlistData.uri, trackUri, playlistData.trackUid);
            trackUriToPlaylistData[trackUri] = (trackUriToPlaylistData[trackUri] ?? [])
                .filter((other) => other.uri !== playlistData.uri);
            dataVersion++;
            schedule();
            Spicetify.showNotification(`Removed from ${playlistData.name}`);
        } catch (error) {
            console.error('[playlist-labels] remove failed', error);
            Spicetify.showNotification(`Could not remove from ${playlistData.name}`, true);
        }
    });
    menu.append(button);
    document.body.append(menu);

    // Keep the menu on screen.
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;

    const close = (closeEvent: Event) => {
        if (closeEvent instanceof KeyboardEvent && closeEvent.key !== 'Escape') return;
        if (closeEvent.target instanceof Node && menu.contains(closeEvent.target)) return;
        menu.remove();
        document.removeEventListener('mousedown', close, true);
        document.removeEventListener('keydown', close, true);
        window.removeEventListener('blur', close);
    };
    document.addEventListener('mousedown', close, true);
    document.addEventListener('keydown', close, true);
    window.addEventListener('blur', close);
}

function queueUpdate(load: () => Promise<Record<string, PlaylistData[]>>) {
    const promise = updatePromise.catch(() => undefined).then(load);
    updatePromise = promise;
    setData(promise);
    return promise;
}

// IndexedDB rejects with Events; log the DOMException they carry instead.
function describeError(error: any) {
    return error instanceof Event ? (error.target as any)?.error ?? error.type : error;
}

function setData(promise: Promise<Record<string, PlaylistData[]>>) {
    promise.then((data) => {
        trackUriToPlaylistData = data;
        dataVersion++;
        schedule();
    }).catch((error) => console.error('[playlist-labels] could not update playlist data', describeError(error)));
}

function addListener(api: any, event: string, listener: (event: any) => void) {
    try {
        api.getEvents().addListener(event, listener);
    } catch (error) {
        console.warn(`[playlist-labels] could not listen to ${event}`, error);
    }
}

function registerMenu() {
    let showAllItem: any = null;
    const playbarButton = Spicetify.Playbar?.Button
        ? new Spicetify.Playbar.Button(
            'Show All Saved Playlists',
            `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons?.spotify ?? ''}</svg>`,
            (button) => toggleShowAll(button),
            false,
            settings.showAllPlaylists,
        )
        : null;

    const toggleShowAll = (button = playbarButton) => {
        settings.showAllPlaylists = !settings.showAllPlaylists;
        writeSetting('show-all', settings.showAllPlaylists);
        if (button) button.active = settings.showAllPlaylists;
        if (showAllItem) showAllItem.isEnabled = settings.showAllPlaylists;
        schedule();
    };

    if (!Spicetify.Menu?.SubMenu) return;
    showAllItem = new Spicetify.Menu.Item('Show all saved playlists', settings.showAllPlaylists, () => toggleShowAll());
    const artistItem = new Spicetify.Menu.Item('Show on artist pages', settings.showOnArtistPages, (item) => {
        settings.showOnArtistPages = item.isEnabled = !settings.showOnArtistPages;
        writeSetting('show-on-artist-pages', settings.showOnArtistPages);
        dataVersion++;
        schedule();
    });
    const rebuildItem = new Spicetify.Menu.Item('Rebuild cache', false, async () => {
        Spicetify.showNotification('Playlist Labels: rebuilding cache…');
        await clearCache();
        queueUpdate(getTrackUriToPlaylistData)
            .then(() => Spicetify.showNotification('Playlist Labels: cache rebuilt'))
            .catch(() => Spicetify.showNotification('Playlist Labels: could not rebuild cache', true));
    });
    new Spicetify.Menu.SubMenu('Playlist Labels', [showAllItem, artistItem, rebuildItem]).register();
}

// Run `PlaylistLabels.debug()` in DevTools when labels don't show up.
function debug() {
    const grids = getTracklists();
    return {
        spotify: Spicetify.Platform?.version,
        tracksWithData: Object.keys(trackUriToPlaylistData).length,
        grids: grids.map((grid) => {
            const rows = getRows(grid);
            const sample = rows.find((row) => !isHeaderRow(row) && getRowUri(row));
            const layout = sample ? getRowLayout(sample) : null;
            return {
                rows: rows.length,
                trackRows: rows.filter((row) => getRowUri(row)).length,
                hasHeader: rows.some(isHeaderRow),
                width: grid.style.getPropertyValue(WIDTH_VAR),
                sampleUri: sample ? getRowUri(sample) : null,
                sampleLabels: sample ? getLabels(getRowUri(sample)!, currentPath()).map((label) => label.name) : null,
                template: layout?.container.style.getPropertyValue('grid-template-columns') || null,
            };
        }),
    };
}

async function main() {
    while (!Spicetify?.Platform?.History || !Spicetify.showNotification) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const style = document.createElement('style');
    style.id = 'spicetify-playlist-labels-style';
    style.textContent = css;
    document.head.append(style);

    (window as any).PlaylistLabels = { debug };
    registerMenu();

    const mainView = document.querySelector('.Root__main-view') ?? document.body;
    new MutationObserver(schedule).observe(mainView, { childList: true, subtree: true });
    new ResizeObserver(schedule).observe(mainView);
    Spicetify.Platform.History.listen(schedule);

    addListener(Spicetify.Platform.LibraryAPI, 'update', () => queueUpdate(updateLikedTracks));
    addListener(Spicetify.Platform.PlaylistAPI, 'operation_complete', (event) => {
        const uri = event?.data?.uri;
        if (uri) queueUpdate(() => updatePlaylistData(uri));
    });

    queueUpdate(getTrackUriToPlaylistData).catch((error) => {
        console.error('[playlist-labels] could not load playlists', describeError(error));
        Spicetify.showNotification('Playlist Labels: could not load your playlists (see DevTools console)', true);
    });
}

main();
