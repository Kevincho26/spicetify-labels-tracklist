import { getContents, getImageUrl, getLikedTracks, getLikedTracksCount, getPlaylistItems } from "./api";

// Labels for playlists inside a folder with this name come first (e.g. star rating playlists).
const RATED_FOLDER_NAME = localStorage.getItem('spicetify-playlist-labels:rated-folder') || 'Rated';

function getPlaylistsFromContents(contents) {
    let playlists = [];
    let ratedPlaylists = [];

    function traverse(item, isRated) {
        if (item.type === 'playlist') {
            if (isRated)
                ratedPlaylists.push(item);
            else
                playlists.push(item);
        } else if (item.type === 'folder' && item.items) {
            item.items.forEach(i => traverse(i, isRated || item.name == RATED_FOLDER_NAME));
        }
    }

    traverse(contents, false);

    return [playlists, ratedPlaylists];
}

async function getPlaylistsExtra() {
    const contents = await getContents();

    const [playlists, ratedPlaylists] = getPlaylistsFromContents(contents);

    let allPlaylists = [...playlists, ...ratedPlaylists];
    // Keep plain fields only: Spotify's objects aren't always storable in IndexedDB.
    allPlaylists = allPlaylists.map((playlist) => ({
        uri: playlist.uri,
        name: playlist.name,
        images: (playlist.images ?? []).map(({ url, width, height }) => ({ url, width, height })),
        isOwnedBySelf: playlist.isOwnedBySelf,
        owner: { username: playlist.owner?.username },
        addedAt: playlist.addedAt instanceof Date ? playlist.addedAt.toISOString() : playlist.addedAt,
        totalLength: playlist.totalLength,
        isRatedPlaylist: ratedPlaylists.some((ratedPlaylist) => ratedPlaylist.uri === playlist.uri)
    }));

    return allPlaylists;
}

const DB_NAME = 'spicetify-playlist-labels';
const STORES = ['playlists', 'playlistItems'];

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
            for (const store of STORES) {
                if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'uri' });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            if (STORES.every((store) => db.objectStoreNames.contains(store))) {
                resolve(db);
            } else {
                db.close();
                reject(new Error('IndexedDB cache is missing object stores'));
            }
        };
    });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

// The cache only makes startup faster. If it can't be opened, recreate it
// once; if that fails too, keep working without it.
function getDb(): Promise<IDBDatabase | null> {
    dbPromise ??= openDb()
        .catch(async (error) => {
            console.warn('[playlist-labels] could not open cache, recreating it', error);
            await requestResult(indexedDB.deleteDatabase(DB_NAME)).catch(() => undefined);
            return openDb();
        })
        .catch((error) => {
            console.warn('[playlist-labels] cache disabled, playlists will be loaded on every start', error);
            return null;
        });
    return dbPromise;
}

async function readCache(db: IDBDatabase | null, store: string): Promise<any[]> {
    if (!db) return [];
    try {
        return await requestResult(db.transaction(store).objectStore(store).getAll());
    } catch (error) {
        console.warn(`[playlist-labels] could not read ${store} cache`, error);
        return [];
    }
}

async function writeCache(db: IDBDatabase | null, store: string, records: any[], clear = false): Promise<void> {
    if (!db) return;
    try {
        const transaction = db.transaction(store, 'readwrite');
        const objectStore = transaction.objectStore(store);
        if (clear) objectStore.clear();
        records.forEach((record) => objectStore.put(record));
        await transactionDone(transaction);
    } catch (error) {
        console.warn(`[playlist-labels] could not write ${store} cache`, error);
    }
}

const getCachedPlaylists = (db: IDBDatabase | null) => readCache(db, 'playlists');
const getCachedPlaylistItems = (db: IDBDatabase | null) => readCache(db, 'playlistItems');

function cachePlaylists(db: IDBDatabase | null, playlists: any[], clear = false) {
    return writeCache(db, 'playlists', playlists, clear);
}

function cachePlaylistItems(db: IDBDatabase | null, uriToPlaylistItems, clear = false) {
    const records = Object.entries(uriToPlaylistItems).map(([uri, items]) => ({ uri, items }));
    return writeCache(db, 'playlistItems', records, clear);
}

function addPlaylists(trackUriToPlaylistData, playlists: any[], uriToPlaylistItems: any) {
    playlists.forEach((playlist) => {
        const playlistItems = uriToPlaylistItems[playlist.uri] ?? [];
        playlistItems.forEach((playlistItem) => {
            const trackUri = playlistItem.uri;
            if (!trackUriToPlaylistData[trackUri])
                trackUriToPlaylistData[trackUri] = [];
            if (!trackUriToPlaylistData[trackUri].some(obj => obj.uri === playlist.uri)) {
                trackUriToPlaylistData[trackUri].push({
                    uri: playlist.uri,
                    name: playlist.name,
                    trackUid: playlistItem.uid,
                    image: getImageUrl(playlist.images),
                    isOwnPlaylist: playlist.isOwnedBySelf ?? playlist.owner?.username === Spicetify.Platform.username,
                    isLikedTracks: false
                });
            }
        });
    });
}

function addLikedTracks(trackUriToPlaylistData, likedTracks) {
    (likedTracks ?? []).forEach((item) => {
        const trackUri = item.uri;
        if (!trackUriToPlaylistData[trackUri])
            trackUriToPlaylistData[trackUri] = [];
        if (!trackUriToPlaylistData[trackUri].some(obj => obj.isLikedTracks)) {
            trackUriToPlaylistData[trackUri].push({
                uri: null,
                name: 'Liked Songs',
                trackUid: item.uid,
                image: 'https://misc.scdn.co/liked-songs/liked-songs-300.png',
                isOwnPlaylist: true,
                isLikedTracks: true
            });
        }
    });
}

export async function updatePlaylistData(uri) {
    const db = await getDb();
    let playlists = await getPlaylistsExtra();
    const cachedPlaylistItems = await getCachedPlaylistItems(db);

    const cachedUriToPlaylistItems = [];
    cachedPlaylistItems.forEach((playlistItems) => {
        cachedUriToPlaylistItems[playlistItems.uri] = playlistItems.items;
    });

    const updatedPlaylistItems = await getPlaylistItems(uri);
    cachedUriToPlaylistItems[uri] = updatedPlaylistItems;

    const trackUriToPlaylistData = {};
    playlists = playlists.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    const ratedPlaylists = playlists.filter((playlist) => playlist.isRatedPlaylist);
    const nonRatedPlaylists = playlists.filter((playlist) => !playlist.isRatedPlaylist);
    const likedTracks = cachedUriToPlaylistItems['likedTracks'];

    const uriToPlaylistItems = {};
    uriToPlaylistItems[uri] = updatedPlaylistItems;
    await cachePlaylists(db, playlists);
    await cachePlaylistItems(db, uriToPlaylistItems);

    addPlaylists(trackUriToPlaylistData, ratedPlaylists, cachedUriToPlaylistItems);
    addLikedTracks(trackUriToPlaylistData, likedTracks);
    addPlaylists(trackUriToPlaylistData, nonRatedPlaylists, cachedUriToPlaylistItems);

    return trackUriToPlaylistData;
}

export async function updateLikedTracks() {
    const db = await getDb();
    const cachedPlaylists = await getCachedPlaylists(db);
    const cachedPlaylistItems = await getCachedPlaylistItems(db);

    const cachedUriToPlaylistItems = [];
    cachedPlaylistItems.forEach((playlistItems) => {
        cachedUriToPlaylistItems[playlistItems.uri] = playlistItems.items;
    });

    const trackUriToPlaylistData = {};
    const playlists = cachedPlaylists.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    const ratedPlaylists = playlists.filter((playlist) => playlist.isRatedPlaylist);
    const nonRatedPlaylists = playlists.filter((playlist) => !playlist.isRatedPlaylist);

    let likedTracks = await getLikedTracks();
    likedTracks = likedTracks.items;

    addPlaylists(trackUriToPlaylistData, ratedPlaylists, cachedUriToPlaylistItems);
    addLikedTracks(trackUriToPlaylistData, likedTracks);
    addPlaylists(trackUriToPlaylistData, nonRatedPlaylists, cachedUriToPlaylistItems);

    const uriToPlaylistItems = {};
    uriToPlaylistItems['likedTracks'] = likedTracks;
    await cachePlaylistItems(db, uriToPlaylistItems);

    localStorage.setItem('spicetify-playlist-labels:liked-tracks-count', `${likedTracks.length}`);

    return trackUriToPlaylistData;
}

export async function getTrackUriToPlaylistData() {
    const db = await getDb();
    const cachedPlaylists = await getCachedPlaylists(db);
    const cachedPlaylistItems = await getCachedPlaylistItems(db);

    let playlists = await getPlaylistsExtra();
    const updatedPlaylists = [];
    playlists.forEach((playlist) => {
        const cachedPlaylist = cachedPlaylists.find((cachedPlaylist) => cachedPlaylist.uri === playlist.uri);
        if (!cachedPlaylist || cachedPlaylist.totalLength !== playlist.totalLength) {
            updatedPlaylists.push(playlist);
        }
    });

    const cachedUriToPlaylistItems = [];
    cachedPlaylistItems.forEach((playlistItems) => {
        cachedUriToPlaylistItems[playlistItems.uri] = playlistItems.items;
    });

    const updatedPlaylistItems = await Promise.all(updatedPlaylists.map((playlist) => getPlaylistItems(playlist.uri)));
    const uriToUpdatedPlaylistItems = {}
    updatedPlaylistItems.forEach((playlistItems, index) => {
        const uri = updatedPlaylists[index].uri;
        uriToUpdatedPlaylistItems[uri] = playlistItems;
    });

    const uriToPlaylistItems = {};
    playlists.forEach((playlist) => {
        const uri = playlist.uri;
        if (uriToUpdatedPlaylistItems[uri])
            uriToPlaylistItems[uri] = uriToUpdatedPlaylistItems[uri];
        else
            uriToPlaylistItems[uri] = cachedUriToPlaylistItems[uri]
    });
    uriToPlaylistItems['likedTracks'] = cachedUriToPlaylistItems['likedTracks'];

    const cachedLikedTracksCount = JSON.parse(localStorage.getItem('spicetify-playlist-labels:liked-tracks-count') || '0');
    const likedTracksCount = await getLikedTracksCount();
    let likedTracks = uriToPlaylistItems['likedTracks'];
    if (!likedTracks || cachedLikedTracksCount != likedTracksCount) {
        likedTracks = await getLikedTracks();
        likedTracks = likedTracks.items;
        uriToPlaylistItems['likedTracks'] = likedTracks;
    }

    const trackUriToPlaylistData = {};
    playlists = playlists.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    const ratedPlaylists = playlists.filter((playlist) => playlist.isRatedPlaylist);
    const nonRatedPlaylists = playlists.filter((playlist) => !playlist.isRatedPlaylist);

    addPlaylists(trackUriToPlaylistData, ratedPlaylists, uriToPlaylistItems);
    addLikedTracks(trackUriToPlaylistData, likedTracks);
    addPlaylists(trackUriToPlaylistData, nonRatedPlaylists, uriToPlaylistItems);

    await cachePlaylists(db, playlists, true);
    await cachePlaylistItems(db, uriToPlaylistItems, true);
    localStorage.setItem('spicetify-playlist-labels:liked-tracks-count', `${likedTracksCount}`);

    return trackUriToPlaylistData;
}

export async function clearCache(): Promise<void> {
    localStorage.removeItem('spicetify-playlist-labels:liked-tracks-count');
    const db = await getDb();
    await writeCache(db, 'playlists', [], true);
    await writeCache(db, 'playlistItems', [], true);
}
