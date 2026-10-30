// Helpers for Spotify's track list DOM.
//
// Spotify 1.3.x dropped most of the legacy `main-trackList-*` class names, so
// everything here relies on ARIA roles (`grid`, `row`, `gridcell`,
// `columnheader`, `aria-colindex`) and keeps the legacy classes only as a
// fallback for older clients.

export const COLUMN_NAME = 'plabels';
export const CELL_CLASS = 'spicetify-playlist-labels-cell';
export const HEADER_CLASS = 'spicetify-playlist-labels-header';
export const WIDTH_VAR = '--spicetify-playlist-labels-width';

// Columns injected by other extensions that should stay to the right of ours.
// Tagify always inserts its column right before the last one, so placing ours
// before it gives the same order no matter which extension runs first.
const RIGHT_NEIGHBOUR_CELLS = '.tagify-info, .tagify-header';
const RIGHT_NEIGHBOUR_LINES = ['[tagify]'];

const GRID_SELECTOR = [
    '.Root__main-view [role="grid"]',
    'main [role="grid"]',
    '.main-trackList-indexable',
].join(', ');

const CELL_SELECTOR = '[role="gridcell"][aria-colindex], [role="columnheader"][aria-colindex]';
const TRACK_URI = /^spotify:(track|local|episode):/;

export function getTracklists(): HTMLElement[] {
    const grids = Array.from(document.querySelectorAll<HTMLElement>(GRID_SELECTOR));
    // Nested matches (legacy class inside a role=grid) would be processed twice.
    return grids.filter((grid) => !grids.some((other) => other !== grid && other.contains(grid)));
}

export function getRows(grid: HTMLElement): HTMLElement[] {
    return Array.from(grid.querySelectorAll<HTMLElement>('[role="row"], .main-trackList-trackListRow'))
        .filter((row) => row.parentElement?.closest('[role="row"]') == null && closestGrid(row) === grid);
}

function closestGrid(element: Element) {
    return element.closest(GRID_SELECTOR);
}

export function isHeaderRow(row: HTMLElement) {
    return row.querySelector('[role="columnheader"]') != null;
}

/**
 * Reads the track URI from the React props of the row or one of its ancestors.
 * Walking the fiber parents by property name survives React tree reshuffles,
 * unlike a fixed `props.children[0].props...` path.
 */
export function getRowUri(row: HTMLElement, maxDepth = 10): string | null {
    const fiberKey = Object.keys(row).find((key) => key.startsWith('__reactFiber$'));
    let fiber = fiberKey ? (row as any)[fiberKey] : null;
    for (let depth = 0; fiber && depth <= maxDepth; depth++, fiber = fiber.return) {
        const props = fiber.memoizedProps;
        if (!props || typeof props !== 'object') continue;
        for (const value of [props.uri, props.item?.uri, props.track?.uri, props.value?.uri, props.trackUri]) {
            if (typeof value === 'string' && TRACK_URI.test(value)) return value;
        }
    }
    return null;
}

export interface RowLayout {
    // Element that owns `grid-template-columns` (the row or a presentation wrapper).
    container: HTMLElement;
    cells: HTMLElement[];
    // Cell our column is inserted before.
    anchor: HTMLElement;
}

export function getRowLayout(row: HTMLElement): RowLayout | null {
    const cells = Array.from(row.querySelectorAll<HTMLElement>(CELL_SELECTOR))
        .filter((cell) => cell.closest('[role="row"]') === row && !cell.classList.contains(CELL_CLASS) && !cell.classList.contains(HEADER_CLASS));
    const last = cells.find((cell) => cell.classList.contains('main-trackList-rowSectionEnd')) ?? cells.at(-1);
    if (!last || cells.length < 2) return null;
    const container = last.parentElement as HTMLElement;
    const siblings = cells.filter((cell) => cell.parentElement === container);
    const neighbour = Array.from(container.children).find((child) => child.matches(RIGHT_NEIGHBOUR_CELLS)) as HTMLElement | undefined;
    const anchor = neighbour ?? last;
    if (neighbour && !siblings.includes(neighbour)) siblings.splice(siblings.indexOf(last), 0, neighbour);
    return { container, cells: siblings, anchor };
}

export function insertCell(layout: RowLayout, cell: HTMLElement) {
    const { container, cells, anchor } = layout;
    const index = Number(anchor.getAttribute('aria-colindex')) || cells.indexOf(anchor) + 1;
    cell.setAttribute('aria-colindex', String(index));
    for (const other of cells.slice(cells.indexOf(anchor))) {
        const otherIndex = Number(other.getAttribute('aria-colindex'));
        if (otherIndex >= index) other.setAttribute('aria-colindex', String(otherIndex + 1));
    }
    container.insertBefore(cell, anchor);
}

/**
 * Makes sure the row's grid template has a track for our column. Returns
 * false when the template is already up to date.
 */
export function ensureTemplate(layout: RowLayout): boolean {
    const { container } = layout;
    const inline = container.style.getPropertyValue('grid-template-columns');
    if (inline.includes(`[${COLUMN_NAME}]`)) return false;

    const track = `[${COLUMN_NAME}] var(${WIDTH_VAR}, 0px)`;
    const native = inline.includes('[last]')
        ? inline
        : getComputedStyle(container).getPropertyValue('--grid-template-columns').trim();

    let template: string | null = null;
    if (native.includes('[last]')) {
        const neighbour = RIGHT_NEIGHBOUR_LINES.find((line) => native.includes(line)) ?? '[last]';
        template = native.replace(neighbour, `${track} ${neighbour}`);
    } else {
        template = buildTemplateFromComputed(layout, track);
    }
    if (!template) return false;

    container.style.setProperty('grid-template-columns', template, 'important');
    return true;
}

/**
 * Fallback for rows without a named template: turn the resolved pixel widths
 * into proportional `fr` tracks so the row stays responsive, then add ours.
 */
function buildTemplateFromComputed(layout: RowLayout, track: string): string | null {
    const { container, cells, anchor } = layout;
    const computed = getComputedStyle(container).getPropertyValue('grid-template-columns');
    const tokens = computed.match(/\[[^\]]*\]|[^\s\[]+/g) ?? [];
    const sizes = tokens.filter((token) => !token.startsWith('['));
    if (sizes.length !== cells.length) return null;

    const insertAt = cells.indexOf(anchor);
    const parts = sizes.map((size, index) => {
        const px = parseFloat(size);
        // Keep narrow fixed columns (index, duration) as they are.
        if (!Number.isFinite(px) || px <= 64) return size;
        return `minmax(0, ${Math.round(px)}fr)`;
    });
    parts.splice(insertAt, 0, track);
    return parts.join(' ');
}
