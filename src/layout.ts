// Column widths for track lists.
//
// Spotify describes each row with a named grid template such as
// `[index] 16px [first] minmax(120px, 4fr) [var1] … [last] minmax(120px, 1fr)`.
// The `var*` columns change per page (album, date added, added by, plays), so
// they are identified from a sample row's content, which works in any
// language, and then given widths that leave the title most of the room.

import { COLUMN_NAME, TAGIFY_COLUMN_NAME, WIDTH_VAR } from './dom';

export type ColumnKind = 'index' | 'title' | 'album' | 'addedBy' | 'date' | 'plays' | 'other' | 'last';

export interface Track {
    names: string[];
    size: string;
}

// `null` keeps Spotify's own width.
const TIDY_SIZES: Record<ColumnKind, string | null> = {
    index: null,
    title: 'minmax(200px, 4fr)',
    album: 'minmax(120px, 2fr)',
    addedBy: 'minmax(110px, 1.25fr)',
    date: '124px',
    plays: '124px',
    other: null,
    last: 'minmax(120px, 0.5fr)',
};

const TAGIFY_DEFAULT_WIDTH = '150px';
const INJECTED_COLUMNS = [COLUMN_NAME, TAGIFY_COLUMN_NAME];

/**
 * Splits a `grid-template-columns` value into tracks and their line names,
 * keeping functions like `minmax(120px, var(--col1, 4fr))` in one piece.
 */
export function parseTemplate(template: string): Track[] | null {
    const tokens: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of template.trim()) {
        if (char === '(' || char === '[') depth++;
        if (char === ')' || char === ']') depth--;
        if (/\s/.test(char) && depth === 0) {
            if (current) tokens.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    if (current) tokens.push(current);

    const tracks: Track[] = [];
    let names: string[] = [];
    for (const token of tokens) {
        if (token.startsWith('[')) {
            names.push(...token.slice(1, -1).split(/\s+/).filter(Boolean));
        } else {
            if (token.startsWith('repeat(')) return null;
            tracks.push({ names, size: token });
            names = [];
        }
    }
    // Drop columns added by us or other extensions to get Spotify's own layout.
    const native = tracks.filter((track) => !track.names.some((name) => INJECTED_COLUMNS.includes(name)));
    return native.at(-1)?.names.includes('last') ? native : null;
}

function classifyCell(cell: Element | undefined): ColumnKind {
    if (!cell) return 'other';
    if (cell.querySelector('a[href*="/album/"], a[href^="spotify:album:"]')) return 'album';
    if (cell.querySelector('a[href*="/user/"], a[href^="spotify:user:"]')) return 'addedBy';
    const text = cell.textContent?.trim() ?? '';
    if (/^[\d.,\s  ]+$/.test(text)) return 'plays';
    if (text && !cell.querySelector('a, button, input')) return 'date';
    return 'other';
}

export function classifyColumns(tracks: Track[], cells: Element[]): ColumnKind[] {
    return tracks.map((track, index) => {
        if (track.names.includes('index')) return 'index';
        if (track.names.includes('first')) return 'title';
        if (track.names.includes('last')) return 'last';
        return classifyCell(cells[index]);
    });
}

/**
 * Builds the row template: Spotify's columns (tidied up when `tidy` is on),
 * then ours, then Tagify's when the row has it, then the last column.
 */
export function buildTemplate(tracks: Track[], kinds: ColumnKind[], options: { tidy: boolean; tagify: boolean; tagifyWidth: number | null }) {
    return tracks.map((track, index) => {
        const size = (options.tidy && TIDY_SIZES[kinds[index]]) || track.size;
        const column = `${track.names.length ? `[${track.names.join(' ')}] ` : ''}${size}`;
        if (kinds[index] !== 'last') return column;

        const tagifyWidth = options.tidy && options.tagifyWidth ? `${options.tagifyWidth}px` : TAGIFY_DEFAULT_WIDTH;
        const tagify = options.tagify ? ` [${TAGIFY_COLUMN_NAME}] ${tagifyWidth}` : '';
        return `[${COLUMN_NAME}] var(${WIDTH_VAR}, 0px)${tagify} ${column}`;
    }).join(' ');
}
