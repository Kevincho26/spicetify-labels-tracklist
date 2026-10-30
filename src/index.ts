import css from './style.css';
import { removeTrackFromPlaylist } from './api';
import { CELL_CLASS, HEADER_CLASS, WIDTH_VAR, RowLayout, ensureTemplate, getNativeTemplate, getRowLayout, getRowUri, getRows, getTracklists, insertCell, isHeaderRow, setTemplate } from './dom';
import { ColumnKind, Track, buildTemplate, classifyColumns, parseTemplate } from './layout';
import { clearCache, getTrackUriToPlaylistData, updateLikedTracks, updatePlaylistData } from './playlist';

const VERSION = '0.3.0';
const PREFIX = 'spicetify-playlist-labels:';
const SIZE_VAR = '--spicetify-playlist-labels-size';
const GAP = 6;
const MORE_WIDTH = 24 + GAP;
const LIKED_SONGS_PATH = '/collection/tracks';
const LABEL_CLASS = 'spicetify-playlist-labels-label';
const MENU_CLASS = 'spicetify-playlist-labels-menu';

function readSetting<T>(key: string, fallback: T): T {
    try {
        const value = localStorage.getItem(PREFIX + key);
        return value == null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function writeSetting(key: string, value: unknown) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (error) {
        console.warn('[playlist-labels] could not save setting', key, error);
    }
}

const settings = {
    showAllPlaylists: readSetting('show-all', false),
    showOnArtistPages: readSetting('show-on-artist-pages', true),
    // Rebalance Spotify's column widths around the title (see layout.ts).
    tidyColumns: readSetting('tidy-columns', true),
    // Share of the track list width the label column may take. Keeps the
    // title readable when the right panel is open or on artist pages.
    maxWidthRatio: readSetting('max-width-ratio', 0.2),
    maxLabels: readSetting('max-labels', 20),
    // Width given to Tagify's rating column while tidying (Tagify uses 150px).
    tagifyWidth: readSetting('tagify-width', 112),
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
    // Resets whenever the page, the data or a setting changes.
    key: string;
    // Most labels any row of this list has needed so far; only grows while
    // scrolling so the column doesn't jump around.
    maxCount: number;
    visibleCount: number;
    columns: { template: string; tracks: Track[]; kinds: ColumnKind[] } | null;
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

function openPlaylist(playlistData: PlaylistData, trackUri: string) {
    const path = playlistPath(playlistData);
    highlight = { trackUri, path, until: Date.now() + 10_000 };
    Spicetify.Platform.History.push({ pathname: path, search: `?uid=${playlistData.trackUid}` });
}

function refresh() {
    dataVersion++;
    schedule();
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

        const stateKey = `${path}|${dataVersion}|${settings.showAllPlaylists}|${settings.tidyColumns}`;
        let state = gridStates.get(grid);
        if (!state || state.key !== stateKey) {
            state = { key: stateKey, maxCount: 0, visibleCount: 0, columns: null };
            gridStates.set(grid, state);
        }

        const rows = tracks.map(({ row, uri }) => {
            const labels = hidden ? [] : getLabels(uri, path);
            state!.maxCount = Math.max(state!.maxCount, labels.length);
            return { row, uri, labels };
        });

        updateWidth(grid, state, tracks[0].row);
        for (const { row, uri, labels } of rows) {
            const cell = ensureCell(row, state, createRowCell);
            if (cell) renderCell(cell, uri, labels, state.visibleCount, stateKey);
            if (highlight && highlight.trackUri === uri && highlight.path === path) {
                highlight = null;
                row.scrollIntoView({ block: 'center' });
                row.click();
            }
        }
        // After the rows, which tell which column is which.
        if (header) ensureCell(header, state, createHeaderCell);
    }

    if (highlight && Date.now() > highlight.until) highlight = null;
}

/**
 * Sizes the label column from the space the track list actually has, so it
 * adapts to the right panel, artist pages and collaborative playlists.
 */
function updateWidth(grid: HTMLElement, state: GridState, sampleRow: HTMLElement) {
    // Match the track's own cover art (40px in a regular 56px row).
    const rowHeight = sampleRow.getBoundingClientRect().height || 56;
    const size = Math.round(Math.min(40, Math.max(16, rowHeight - 16)));
    const available = grid.getBoundingClientRect().width * settings.maxWidthRatio;
    const fit = Math.max(1, Math.floor((available - MORE_WIDTH + GAP) / (size + GAP)));
    const count = Math.min(state.maxCount, fit, settings.maxLabels);
    const overflow = state.maxCount > count;
    const width = count === 0 ? 0 : count * size + (count - 1) * GAP + (overflow ? MORE_WIDTH : 0);

    state.visibleCount = count;
    setStyle(grid, WIDTH_VAR, `${width}px`);
    setStyle(grid, SIZE_VAR, `${size}px`);
}

function setStyle(element: HTMLElement, property: string, value: string) {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
}

function ensureCell(row: HTMLElement, state: GridState, create: () => HTMLElement): HTMLElement | null {
    const layout = getRowLayout(row);
    if (!layout) return null;
    const className = isHeaderRow(row) ? HEADER_CLASS : CELL_CLASS;
    let cell = Array.from(row.getElementsByClassName(className) as HTMLCollectionOf<HTMLElement>)
        .find((candidate) => candidate.closest('[role="row"]') === row) ?? null;
    if (cell && cell.parentElement !== layout.container) {
        destroyTooltips(cell);
        cell.remove();
        cell = null;
    }
    if (!cell) {
        cell = create();
        insertCell(layout, cell);
    }
    applyTemplate(layout, state, isHeaderRow(row));
    return cell;
}

function applyTemplate(layout: RowLayout, state: GridState, isHeader: boolean) {
    const native = getNativeTemplate(layout.container);
    // Column kinds are read from a track row; the header reuses them.
    if (!state.columns || state.columns.template !== native) {
        const tracks = parseTemplate(native);
        state.columns = tracks && !isHeader && tracks.length === layout.nativeCells.length
            ? { template: native, tracks, kinds: classifyColumns(tracks, layout.nativeCells) }
            : state.columns;
    }

    const columns = state.columns;
    if (!columns || columns.tracks.length !== layout.nativeCells.length) {
        ensureTemplate(layout);
        return;
    }
    setTemplate(layout.container, buildTemplate(columns.tracks, columns.kinds, {
        tidy: settings.tidyColumns,
        tagify: layout.tagify != null,
        tagifyWidth: settings.tagifyWidth,
    }));
}

function createHeaderCell() {
    const cell = document.createElement('div');
    cell.className = HEADER_CLASS;
    cell.setAttribute('role', 'columnheader');
    const text = document.createElement('span');
    text.textContent = 'Labels';
    cell.append(text);
    return cell;
}

function createRowCell() {
    const cell = document.createElement('div');
    cell.className = CELL_CLASS;
    cell.setAttribute('role', 'gridcell');
    // Keep clicks on labels from selecting or playing the row.
    for (const type of ['dblclick', 'mousedown']) {
        cell.addEventListener(type, (event) => {
            if ((event.target as HTMLElement).closest('button')) event.stopPropagation();
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
    for (const playlistData of labels.slice(0, visibleCount)) {
        container.append(createLabel(playlistData, trackUri));
    }
    const hiddenLabels = labels.slice(visibleCount);
    if (visibleCount > 0 && hiddenLabels.length > 0) container.append(createMoreButton(hiddenLabels, trackUri));

    destroyTooltips(cell);
    cell.replaceChildren(container);
}

function createLabel(playlistData: PlaylistData, trackUri: string) {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = LABEL_CLASS;
    label.setAttribute('aria-label', playlistData.name);
    if (playlistData.isLikedTracks) label.classList.add('spicetify-playlist-labels-liked');
    label.append(createCover(playlistData));

    addTooltip(label, playlistData.name);
    label.addEventListener('click', (event) => {
        event.stopPropagation();
        openPlaylist(playlistData, trackUri);
    });
    label.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showMenu(menuPosition(event, label), playlistMenuItems(playlistData, trackUri));
    });
    return label;
}

function createCover(playlistData: PlaylistData) {
    const cover = document.createElement('span');
    cover.className = 'spicetify-playlist-labels-cover';
    if (playlistData.isLikedTracks) cover.classList.add('spicetify-playlist-labels-liked');
    if (playlistData.image) {
        const image = document.createElement('img');
        image.src = playlistData.image;
        image.alt = '';
        image.loading = 'lazy';
        image.draggable = false;
        image.addEventListener('error', () => image.remove());
        cover.append(image);
    }
    return cover;
}

function createMoreButton(hiddenLabels: PlaylistData[], trackUri: string) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spicetify-playlist-labels-more';
    button.textContent = `+${hiddenLabels.length}`;
    const description = `${hiddenLabels.length} more playlist${hiddenLabels.length === 1 ? '' : 's'}`;
    button.setAttribute('aria-label', description);
    addTooltip(button, description);
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        showMenu(menuPosition(event, button), hiddenLabels.map((playlistData) => ({
            label: playlistData.name,
            cover: playlistData,
            onClick: () => openPlaylist(playlistData, trackUri),
        })));
    });
    return button;
}

function playlistMenuItems(playlistData: PlaylistData, trackUri: string): MenuItem[] {
    const items: MenuItem[] = [{ label: `Open ${playlistData.name}`, onClick: () => openPlaylist(playlistData, trackUri) }];
    if (!playlistData.isLikedTracks) {
        items.push({
            label: `Remove from ${playlistData.name}`,
            onClick: () => removeFromPlaylist(playlistData, trackUri),
        });
    }
    return items;
}

async function removeFromPlaylist(playlistData: PlaylistData, trackUri: string) {
    try {
        await removeTrackFromPlaylist(playlistData.uri, trackUri, playlistData.trackUid);
        trackUriToPlaylistData[trackUri] = (trackUriToPlaylistData[trackUri] ?? [])
            .filter((other) => other.uri !== playlistData.uri);
        refresh();
        Spicetify.showNotification(`Removed from ${playlistData.name}`);
    } catch (error) {
        console.error('[playlist-labels] remove failed', error);
        Spicetify.showNotification(`Could not remove from ${playlistData.name}`, true);
    }
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

function destroyTooltips(root: HTMLElement) {
    root.querySelectorAll('button').forEach((element) => (element as any)._tippy?.destroy());
}

interface MenuItem {
    label: string;
    cover?: PlaylistData;
    onClick: () => void;
}

// Keyboard-opened context menus report (0, 0); anchor those to the element.
function menuPosition(event: MouseEvent, element: HTMLElement) {
    if (event.clientX || event.clientY) return { x: event.clientX, y: event.clientY };
    const rect = element.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 4 };
}

function showMenu(position: { x: number; y: number }, items: MenuItem[]) {
    document.querySelector(`.${MENU_CLASS}`)?.remove();

    const menu = document.createElement('div');
    menu.className = MENU_CLASS;
    menu.setAttribute('role', 'menu');
    menu.style.left = `${position.x}px`;
    menu.style.top = `${position.y}px`;

    const close = () => {
        menu.remove();
        document.removeEventListener('mousedown', onOutside, true);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('blur', close);
        window.removeEventListener('resize', close);
    };
    const onOutside = (event: Event) => {
        if (!(event.target instanceof Node && menu.contains(event.target))) close();
    };
    const buttons = items.map((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        if (item.cover) button.append(createCover(item.cover));
        const text = document.createElement('span');
        text.textContent = item.label;
        button.append(text);
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            close();
            item.onClick();
        });
        menu.append(button);
        return button;
    });
    const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const step = event.key === 'ArrowDown' ? 1 : -1;
            buttons[(index + step + buttons.length) % buttons.length]?.focus();
        }
    };

    document.body.append(menu);
    // Keep the menu on screen.
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    buttons[0]?.focus({ preventScroll: true });

    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
}

// IndexedDB rejects with Events; log the DOMException they carry instead.
function describeError(error: any) {
    return error instanceof Event ? (error.target as any)?.error ?? error.type : error;
}

function queueUpdate(load: () => Promise<Record<string, PlaylistData[]>>) {
    const promise = updatePromise.catch(() => undefined).then(load);
    updatePromise = promise;
    promise.then((data) => {
        trackUriToPlaylistData = data;
        refresh();
    }).catch((error) => console.error('[playlist-labels] could not update playlist data', describeError(error)));
    return promise;
}

function addListener(api: any, event: string, listener: (event: any) => void) {
    try {
        api.getEvents().addListener(event, listener);
    } catch (error) {
        console.warn(`[playlist-labels] could not listen to ${event}`, error);
    }
}

function debounce(callback: () => void, delay: number) {
    let timer = 0;
    return () => {
        clearTimeout(timer);
        timer = window.setTimeout(callback, delay);
    };
}

function registerMenu() {
    let showAllItem: any = null;
    const toggleShowAll = () => {
        settings.showAllPlaylists = !settings.showAllPlaylists;
        writeSetting('show-all', settings.showAllPlaylists);
        if (playbarButton) playbarButton.active = settings.showAllPlaylists;
        if (showAllItem) showAllItem.isEnabled = settings.showAllPlaylists;
        refresh();
    };
    const playbarButton = Spicetify.Playbar?.Button
        ? new Spicetify.Playbar.Button(
            'Show All Saved Playlists',
            `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons?.spotify ?? ''}</svg>`,
            toggleShowAll,
            false,
            settings.showAllPlaylists,
        )
        : null;

    if (!Spicetify.Menu?.SubMenu) return;
    const toggle = (label: string, key: string, setting: 'showOnArtistPages' | 'tidyColumns') =>
        new Spicetify.Menu.Item(label, settings[setting], (item) => {
            settings[setting] = item.isEnabled = !settings[setting];
            writeSetting(key, settings[setting]);
            refresh();
        });
    showAllItem = new Spicetify.Menu.Item('Show all saved playlists', settings.showAllPlaylists, toggleShowAll);
    const rebuildItem = new Spicetify.Menu.Item('Rebuild cache', false, async () => {
        Spicetify.showNotification('Playlist Labels: rebuilding cache…');
        await clearCache();
        queueUpdate(getTrackUriToPlaylistData)
            .then(() => Spicetify.showNotification('Playlist Labels: cache rebuilt'))
            .catch(() => Spicetify.showNotification('Playlist Labels: could not rebuild cache', true));
    });
    new Spicetify.Menu.SubMenu('Playlist Labels', [
        showAllItem,
        toggle('Show on artist pages', 'show-on-artist-pages', 'showOnArtistPages'),
        toggle('Tidy column widths', 'tidy-columns', 'tidyColumns'),
        rebuildItem,
    ]).register();
}

// Run `PlaylistLabels.debug()` in DevTools when labels don't show up.
function debug() {
    return {
        version: VERSION,
        spotify: Spicetify.Platform?.version,
        settings,
        tracksWithData: Object.keys(trackUriToPlaylistData).length,
        grids: getTracklists().map((grid) => {
            const rows = getRows(grid);
            const sample = rows.find((row) => !isHeaderRow(row) && getRowUri(row));
            const layout = sample ? getRowLayout(sample) : null;
            return {
                rows: rows.length,
                trackRows: rows.filter((row) => getRowUri(row)).length,
                hasHeader: rows.some(isHeaderRow),
                width: grid.style.getPropertyValue(WIDTH_VAR),
                columns: gridStates.get(grid)?.columns?.kinds ?? null,
                sampleUri: sample ? getRowUri(sample) : null,
                sampleLabels: sample ? getLabels(getRowUri(sample)!, currentPath()).map((label) => label.name) : null,
                nativeTemplate: layout ? getNativeTemplate(layout.container) : null,
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

    (window as any).PlaylistLabels = { version: VERSION, debug };
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
    // New, deleted, renamed or moved playlists. Unchanged playlists come from the cache.
    addListener(Spicetify.Platform.RootlistAPI, 'update', debounce(() => queueUpdate(getTrackUriToPlaylistData), 2000));

    queueUpdate(getTrackUriToPlaylistData).catch((error) => {
        Spicetify.showNotification('Playlist Labels: could not load your playlists (see DevTools console)', true);
        console.error('[playlist-labels] could not load playlists', describeError(error));
    });
    console.info(`[playlist-labels] v${VERSION} loaded`);
}

main();
