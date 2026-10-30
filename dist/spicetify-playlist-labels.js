// Playlist Labels for Spicetify - https://github.com/duffey/spicetify-playlist-labels (fork for Spotify 1.3)
(() => {
  // src/style.css
  var style_default = `.spicetify-playlist-labels-cell,
.spicetify-playlist-labels-header {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
}

.spicetify-playlist-labels-header > span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.spicetify-playlist-labels-labels {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    /* Room for the hover lift and the focus ring. */
    padding: 2px;
    margin: -2px;
}

/* Labels and the "+N" button reset Spotify's button styles. */
.spicetify-playlist-labels-label,
.spicetify-playlist-labels-more {
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
}

.spicetify-playlist-labels-cover {
    display: block;
    flex: 0 0 auto;
    width: var(--spicetify-playlist-labels-size, 40px);
    height: var(--spicetify-playlist-labels-size, 40px);
    border-radius: 4px;
    overflow: hidden;
    background-color: var(--background-tinted-base, rgba(255, 255, 255, 0.1));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.spicetify-playlist-labels-cover > img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.spicetify-playlist-labels-cover.spicetify-playlist-labels-liked {
    background: linear-gradient(135deg, #450af5, #c4efd9);
}

.spicetify-playlist-labels-label .spicetify-playlist-labels-cover {
    transition: transform 120ms ease, opacity 120ms ease;
}

.spicetify-playlist-labels-label:hover .spicetify-playlist-labels-cover {
    transform: translateY(-1px) scale(1.06);
}

.spicetify-playlist-labels-label:active .spicetify-playlist-labels-cover {
    transform: scale(0.96);
    opacity: 0.85;
}

.spicetify-playlist-labels-label:focus-visible,
.spicetify-playlist-labels-more:focus-visible,
.spicetify-playlist-labels-menu > button:focus-visible {
    outline: 2px solid var(--text-base, #fff);
    outline-offset: 2px;
    border-radius: 4px;
}

.spicetify-playlist-labels-more {
    min-width: 24px;
    height: 24px;
    padding: 0 4px;
    border-radius: 12px;
    color: var(--text-subdued, #b3b3b3);
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.spicetify-playlist-labels-more:hover {
    color: var(--text-base, #fff);
    background-color: var(--background-tinted-highlight, rgba(255, 255, 255, 0.1));
}

.spicetify-playlist-labels-menu {
    position: fixed;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    max-width: 340px;
    max-height: min(420px, calc(100vh - 16px));
    overflow-y: auto;
    padding: 4px;
    border-radius: 4px;
    background-color: var(--background-elevated-highlight, #3e3e3e);
    box-shadow: 0 16px 24px rgba(0, 0, 0, 0.3), 0 6px 8px rgba(0, 0, 0, 0.2);
    --spicetify-playlist-labels-size: 32px;
}

.spicetify-playlist-labels-menu > button {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    padding: 4px 12px 4px 8px;
    border: 0;
    border-radius: 2px;
    background: none;
    color: var(--text-base, #fff);
    font: inherit;
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
}

.spicetify-playlist-labels-menu > button > span:last-child {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.spicetify-playlist-labels-menu > button:hover,
.spicetify-playlist-labels-menu > button:focus-visible {
    background-color: var(--background-tinted-highlight, rgba(255, 255, 255, 0.1));
}

.spicetify-playlist-labels-menu .spicetify-playlist-labels-cover {
    box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
    .spicetify-playlist-labels-label .spicetify-playlist-labels-cover {
        transition: none;
    }
}
`;

  // src/api.ts
  async function getContents() {
    return await Spicetify.Platform.RootlistAPI.getContents({ decorateImagesAndOwner: true });
  }
  async function getLikedTracksCount() {
    return (await Spicetify.Platform.LibraryAPI.getTracks()).totalLength;
  }
  async function getPlaylistItems(uri) {
    const result = await Spicetify.Platform.PlaylistAPI.getContents(uri);
    return toTrackRefs(result.items);
  }
  async function removeTrackFromPlaylist(playlistUri, trackUri, trackUid) {
    await Spicetify.Platform.PlaylistAPI.remove(playlistUri, [{ uri: trackUri, uid: trackUid ?? "" }]);
  }
  async function getLikedTracks() {
    const result = await Spicetify.Platform.LibraryAPI.getTracks({ limit: Number.MAX_SAFE_INTEGER });
    return { ...result, items: toTrackRefs(result.items) };
  }
  function toTrackRefs(items) {
    return (items ?? []).map((item) => ({ uri: item.uri, uid: item.uid }));
  }
  function getImageUrl(images) {
    if (!images?.length) return "";
    const sized = images.filter((image2) => image2?.url && (image2.width ?? image2.size));
    const image = sized.sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((candidate) => (candidate.width ?? 0) >= 60) ?? images[0];
    const url = image?.url ?? "";
    if (url.startsWith("spotify:image:")) {
      return `https://i.scdn.co/image/${url.slice("spotify:image:".length)}`;
    }
    if (url.startsWith("spotify:mosaic:")) {
      return `https://mosaic.scdn.co/300/${url.slice("spotify:mosaic:".length).split(":").join("")}`;
    }
    return url;
  }

  // src/dom.ts
  var COLUMN_NAME = "plabels";
  var CELL_CLASS = "spicetify-playlist-labels-cell";
  var HEADER_CLASS = "spicetify-playlist-labels-header";
  var WIDTH_VAR = "--spicetify-playlist-labels-width";
  var TAGIFY_COLUMN_NAME = "tagify";
  var RIGHT_NEIGHBOUR_CELLS = ".tagify-info, .tagify-header";
  var RIGHT_NEIGHBOUR_LINES = [`[${TAGIFY_COLUMN_NAME}]`];
  var GRID_SELECTOR = [
    '.Root__main-view [role="grid"]',
    'main [role="grid"]',
    ".main-trackList-indexable"
  ].join(", ");
  var CELL_SELECTOR = '[role="gridcell"][aria-colindex], [role="columnheader"][aria-colindex]';
  var TRACK_URI = /^spotify:(track|local|episode):/;
  function getTracklists() {
    const grids = Array.from(document.querySelectorAll(GRID_SELECTOR));
    return grids.filter((grid) => !grids.some((other) => other !== grid && other.contains(grid)));
  }
  function getRows(grid) {
    return Array.from(grid.querySelectorAll('[role="row"], .main-trackList-trackListRow')).filter((row) => row.parentElement?.closest('[role="row"]') == null && closestGrid(row) === grid);
  }
  function closestGrid(element) {
    return element.closest(GRID_SELECTOR);
  }
  function isHeaderRow(row) {
    return row.querySelector('[role="columnheader"]') != null;
  }
  function getRowUri(row, maxDepth = 10) {
    const fiberKey = Object.keys(row).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? row[fiberKey] : null;
    for (let depth = 0; fiber && depth <= maxDepth; depth++, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (!props || typeof props !== "object") continue;
      for (const value of [props.uri, props.item?.uri, props.track?.uri, props.value?.uri, props.trackUri]) {
        if (typeof value === "string" && TRACK_URI.test(value)) return value;
      }
    }
    return null;
  }
  function getRowLayout(row) {
    const cells = Array.from(row.querySelectorAll(CELL_SELECTOR)).filter((cell) => cell.closest('[role="row"]') === row && !cell.classList.contains(CELL_CLASS) && !cell.classList.contains(HEADER_CLASS));
    const last = cells.find((cell) => cell.classList.contains("main-trackList-rowSectionEnd")) ?? cells.at(-1);
    if (!last || cells.length < 2) return null;
    const container = last.parentElement;
    const siblings = cells.filter((cell) => cell.parentElement === container);
    const neighbour = Array.from(container.children).find((child) => child.matches(RIGHT_NEIGHBOUR_CELLS));
    const nativeCells = siblings.filter((cell) => cell !== neighbour);
    if (neighbour && !siblings.includes(neighbour)) siblings.splice(siblings.indexOf(last), 0, neighbour);
    return { container, cells: siblings, nativeCells, tagify: neighbour ?? null, anchor: neighbour ?? last };
  }
  function insertCell(layout, cell) {
    const { container, cells, anchor } = layout;
    const index = Number(anchor.getAttribute("aria-colindex")) || cells.indexOf(anchor) + 1;
    cell.setAttribute("aria-colindex", String(index));
    for (const other of cells.slice(cells.indexOf(anchor))) {
      const otherIndex = Number(other.getAttribute("aria-colindex"));
      if (otherIndex >= index) other.setAttribute("aria-colindex", String(otherIndex + 1));
    }
    container.insertBefore(cell, anchor);
  }
  var appliedTemplates = /* @__PURE__ */ new WeakMap();
  function setTemplate(container, template) {
    const current = container.style.getPropertyValue("grid-template-columns");
    const applied = appliedTemplates.get(container);
    if (applied && applied.template === template && applied.serialized === current) return;
    container.style.setProperty("grid-template-columns", template, "important");
    appliedTemplates.set(container, { template, serialized: container.style.getPropertyValue("grid-template-columns") });
  }
  function getNativeTemplate(container) {
    const variable = getComputedStyle(container).getPropertyValue("--grid-template-columns").trim();
    return variable.includes("[last]") ? variable : container.style.getPropertyValue("grid-template-columns");
  }
  function ensureTemplate(layout) {
    const { container } = layout;
    const inline = container.style.getPropertyValue("grid-template-columns");
    if (inline.includes(`[${COLUMN_NAME}]`)) return false;
    const track = `[${COLUMN_NAME}] var(${WIDTH_VAR}, 0px)`;
    const native = inline.includes("[last]") ? inline : getComputedStyle(container).getPropertyValue("--grid-template-columns").trim();
    let template = null;
    if (native.includes("[last]")) {
      const neighbour = RIGHT_NEIGHBOUR_LINES.find((line) => native.includes(line)) ?? "[last]";
      template = native.replace(neighbour, `${track} ${neighbour}`);
    } else {
      template = buildTemplateFromComputed(layout, track);
    }
    if (!template) return false;
    container.style.setProperty("grid-template-columns", template, "important");
    return true;
  }
  function buildTemplateFromComputed(layout, track) {
    const { container, cells, anchor } = layout;
    const computed = getComputedStyle(container).getPropertyValue("grid-template-columns");
    const tokens = computed.match(/\[[^\]]*\]|[^\s\[]+/g) ?? [];
    const sizes = tokens.filter((token) => !token.startsWith("["));
    if (sizes.length !== cells.length) return null;
    const insertAt = cells.indexOf(anchor);
    const parts = sizes.map((size, index) => {
      const px = parseFloat(size);
      if (!Number.isFinite(px) || px <= 64) return size;
      return `minmax(0, ${Math.round(px)}fr)`;
    });
    parts.splice(insertAt, 0, track);
    return parts.join(" ");
  }

  // src/layout.ts
  var TIDY_SIZES = {
    index: null,
    title: "minmax(200px, 4fr)",
    album: "minmax(120px, 2fr)",
    addedBy: "minmax(110px, 1.25fr)",
    date: "124px",
    plays: "124px",
    other: null,
    last: "minmax(120px, 0.5fr)"
  };
  var TAGIFY_DEFAULT_WIDTH = "150px";
  var INJECTED_COLUMNS = [COLUMN_NAME, TAGIFY_COLUMN_NAME];
  function parseTemplate(template) {
    const tokens = [];
    let depth = 0;
    let current = "";
    for (const char of template.trim()) {
      if (char === "(" || char === "[") depth++;
      if (char === ")" || char === "]") depth--;
      if (/\s/.test(char) && depth === 0) {
        if (current) tokens.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    if (current) tokens.push(current);
    const tracks = [];
    let names = [];
    for (const token of tokens) {
      if (token.startsWith("[")) {
        names.push(...token.slice(1, -1).split(/\s+/).filter(Boolean));
      } else {
        if (token.startsWith("repeat(")) return null;
        tracks.push({ names, size: token });
        names = [];
      }
    }
    const native = tracks.filter((track) => !track.names.some((name) => INJECTED_COLUMNS.includes(name)));
    return native.at(-1)?.names.includes("last") ? native : null;
  }
  function classifyCell(cell) {
    if (!cell) return "other";
    if (cell.querySelector('a[href*="/album/"], a[href^="spotify:album:"]')) return "album";
    if (cell.querySelector('a[href*="/user/"], a[href^="spotify:user:"]')) return "addedBy";
    const text = cell.textContent?.trim() ?? "";
    if (/^[\d.,\s  ]+$/.test(text)) return "plays";
    if (text && !cell.querySelector("a, button, input")) return "date";
    return "other";
  }
  function classifyColumns(tracks, cells) {
    return tracks.map((track, index) => {
      if (track.names.includes("index")) return "index";
      if (track.names.includes("first")) return "title";
      if (track.names.includes("last")) return "last";
      return classifyCell(cells[index]);
    });
  }
  function buildTemplate(tracks, kinds, options) {
    return tracks.map((track, index) => {
      const size = options.tidy && TIDY_SIZES[kinds[index]] || track.size;
      const column = `${track.names.length ? `[${track.names.join(" ")}] ` : ""}${size}`;
      if (kinds[index] !== "last") return column;
      const tagifyWidth = options.tidy && options.tagifyWidth ? `${options.tagifyWidth}px` : TAGIFY_DEFAULT_WIDTH;
      const tagify = options.tagify ? ` [${TAGIFY_COLUMN_NAME}] ${tagifyWidth}` : "";
      return `[${COLUMN_NAME}] var(${WIDTH_VAR}, 0px)${tagify} ${column}`;
    }).join(" ");
  }

  // src/playlist.ts
  var RATED_FOLDER_NAME = localStorage.getItem("spicetify-playlist-labels:rated-folder") || "Rated";
  function getPlaylistsFromContents(contents) {
    let playlists = [];
    let ratedPlaylists = [];
    function traverse(item, isRated) {
      if (item.type === "playlist") {
        if (isRated)
          ratedPlaylists.push(item);
        else
          playlists.push(item);
      } else if (item.type === "folder" && item.items) {
        item.items.forEach((i) => traverse(i, isRated || item.name == RATED_FOLDER_NAME));
      }
    }
    traverse(contents, false);
    return [playlists, ratedPlaylists];
  }
  async function getPlaylistsExtra() {
    const contents = await getContents();
    const [playlists, ratedPlaylists] = getPlaylistsFromContents(contents);
    let allPlaylists = [...playlists, ...ratedPlaylists];
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
  var DB_NAME = "spicetify-playlist-labels";
  var STORES = ["playlists", "playlistItems"];
  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
  }
  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        for (const store of STORES) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "uri" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (STORES.every((store) => db.objectStoreNames.contains(store))) {
          resolve(db);
        } else {
          db.close();
          reject(new Error("IndexedDB cache is missing object stores"));
        }
      };
    });
  }
  var dbPromise = null;
  function getDb() {
    dbPromise ??= openDb().catch(async (error) => {
      console.warn("[playlist-labels] could not open cache, recreating it", error);
      await requestResult(indexedDB.deleteDatabase(DB_NAME)).catch(() => void 0);
      return openDb();
    }).catch((error) => {
      console.warn("[playlist-labels] cache disabled, playlists will be loaded on every start", error);
      return null;
    });
    return dbPromise;
  }
  async function readCache(db, store) {
    if (!db) return [];
    try {
      return await requestResult(db.transaction(store).objectStore(store).getAll());
    } catch (error) {
      console.warn(`[playlist-labels] could not read ${store} cache`, error);
      return [];
    }
  }
  async function writeCache(db, store, records, clear = false) {
    if (!db) return;
    try {
      const transaction = db.transaction(store, "readwrite");
      const objectStore = transaction.objectStore(store);
      if (clear) objectStore.clear();
      records.forEach((record) => objectStore.put(record));
      await transactionDone(transaction);
    } catch (error) {
      console.warn(`[playlist-labels] could not write ${store} cache`, error);
    }
  }
  var getCachedPlaylists = (db) => readCache(db, "playlists");
  var getCachedPlaylistItems = (db) => readCache(db, "playlistItems");
  function cachePlaylists(db, playlists, clear = false) {
    return writeCache(db, "playlists", playlists, clear);
  }
  function cachePlaylistItems(db, uriToPlaylistItems, clear = false) {
    const records = Object.entries(uriToPlaylistItems).map(([uri, items]) => ({ uri, items }));
    return writeCache(db, "playlistItems", records, clear);
  }
  function addPlaylists(trackUriToPlaylistData2, playlists, uriToPlaylistItems) {
    playlists.forEach((playlist) => {
      const playlistItems = uriToPlaylistItems[playlist.uri] ?? [];
      playlistItems.forEach((playlistItem) => {
        const trackUri = playlistItem.uri;
        if (!trackUriToPlaylistData2[trackUri])
          trackUriToPlaylistData2[trackUri] = [];
        if (!trackUriToPlaylistData2[trackUri].some((obj) => obj.uri === playlist.uri)) {
          trackUriToPlaylistData2[trackUri].push({
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
  function addLikedTracks(trackUriToPlaylistData2, likedTracks) {
    (likedTracks ?? []).forEach((item) => {
      const trackUri = item.uri;
      if (!trackUriToPlaylistData2[trackUri])
        trackUriToPlaylistData2[trackUri] = [];
      if (!trackUriToPlaylistData2[trackUri].some((obj) => obj.isLikedTracks)) {
        trackUriToPlaylistData2[trackUri].push({
          uri: null,
          name: "Liked Songs",
          trackUid: item.uid,
          image: "https://misc.scdn.co/liked-songs/liked-songs-300.png",
          isOwnPlaylist: true,
          isLikedTracks: true
        });
      }
    });
  }
  async function updatePlaylistData(uri) {
    const db = await getDb();
    let playlists = await getPlaylistsExtra();
    const cachedPlaylistItems = await getCachedPlaylistItems(db);
    const cachedUriToPlaylistItems = [];
    cachedPlaylistItems.forEach((playlistItems) => {
      cachedUriToPlaylistItems[playlistItems.uri] = playlistItems.items;
    });
    const updatedPlaylistItems = await getPlaylistItems(uri);
    cachedUriToPlaylistItems[uri] = updatedPlaylistItems;
    const trackUriToPlaylistData2 = {};
    playlists = playlists.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    const ratedPlaylists = playlists.filter((playlist) => playlist.isRatedPlaylist);
    const nonRatedPlaylists = playlists.filter((playlist) => !playlist.isRatedPlaylist);
    const likedTracks = cachedUriToPlaylistItems["likedTracks"];
    const uriToPlaylistItems = {};
    uriToPlaylistItems[uri] = updatedPlaylistItems;
    await cachePlaylists(db, playlists);
    await cachePlaylistItems(db, uriToPlaylistItems);
    addPlaylists(trackUriToPlaylistData2, ratedPlaylists, cachedUriToPlaylistItems);
    addLikedTracks(trackUriToPlaylistData2, likedTracks);
    addPlaylists(trackUriToPlaylistData2, nonRatedPlaylists, cachedUriToPlaylistItems);
    return trackUriToPlaylistData2;
  }
  async function updateLikedTracks() {
    const db = await getDb();
    const cachedPlaylists = await getCachedPlaylists(db);
    const cachedPlaylistItems = await getCachedPlaylistItems(db);
    const cachedUriToPlaylistItems = [];
    cachedPlaylistItems.forEach((playlistItems) => {
      cachedUriToPlaylistItems[playlistItems.uri] = playlistItems.items;
    });
    const trackUriToPlaylistData2 = {};
    const playlists = cachedPlaylists.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    const ratedPlaylists = playlists.filter((playlist) => playlist.isRatedPlaylist);
    const nonRatedPlaylists = playlists.filter((playlist) => !playlist.isRatedPlaylist);
    let likedTracks = await getLikedTracks();
    likedTracks = likedTracks.items;
    addPlaylists(trackUriToPlaylistData2, ratedPlaylists, cachedUriToPlaylistItems);
    addLikedTracks(trackUriToPlaylistData2, likedTracks);
    addPlaylists(trackUriToPlaylistData2, nonRatedPlaylists, cachedUriToPlaylistItems);
    const uriToPlaylistItems = {};
    uriToPlaylistItems["likedTracks"] = likedTracks;
    await cachePlaylistItems(db, uriToPlaylistItems);
    localStorage.setItem("spicetify-playlist-labels:liked-tracks-count", `${likedTracks.length}`);
    return trackUriToPlaylistData2;
  }
  async function getTrackUriToPlaylistData() {
    const db = await getDb();
    const cachedPlaylists = await getCachedPlaylists(db);
    const cachedPlaylistItems = await getCachedPlaylistItems(db);
    let playlists = await getPlaylistsExtra();
    const updatedPlaylists = [];
    playlists.forEach((playlist) => {
      const cachedPlaylist = cachedPlaylists.find((cachedPlaylist2) => cachedPlaylist2.uri === playlist.uri);
      if (!cachedPlaylist || cachedPlaylist.totalLength !== playlist.totalLength) {
        updatedPlaylists.push(playlist);
      }
    });
    const cachedUriToPlaylistItems = [];
    cachedPlaylistItems.forEach((playlistItems) => {
      cachedUriToPlaylistItems[playlistItems.uri] = playlistItems.items;
    });
    const updatedPlaylistItems = await Promise.all(updatedPlaylists.map((playlist) => getPlaylistItems(playlist.uri)));
    const uriToUpdatedPlaylistItems = {};
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
        uriToPlaylistItems[uri] = cachedUriToPlaylistItems[uri];
    });
    uriToPlaylistItems["likedTracks"] = cachedUriToPlaylistItems["likedTracks"];
    const cachedLikedTracksCount = JSON.parse(localStorage.getItem("spicetify-playlist-labels:liked-tracks-count") || "0");
    const likedTracksCount = await getLikedTracksCount();
    let likedTracks = uriToPlaylistItems["likedTracks"];
    if (!likedTracks || cachedLikedTracksCount != likedTracksCount) {
      likedTracks = await getLikedTracks();
      likedTracks = likedTracks.items;
      uriToPlaylistItems["likedTracks"] = likedTracks;
    }
    const trackUriToPlaylistData2 = {};
    playlists = playlists.sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    const ratedPlaylists = playlists.filter((playlist) => playlist.isRatedPlaylist);
    const nonRatedPlaylists = playlists.filter((playlist) => !playlist.isRatedPlaylist);
    addPlaylists(trackUriToPlaylistData2, ratedPlaylists, uriToPlaylistItems);
    addLikedTracks(trackUriToPlaylistData2, likedTracks);
    addPlaylists(trackUriToPlaylistData2, nonRatedPlaylists, uriToPlaylistItems);
    await cachePlaylists(db, playlists, true);
    await cachePlaylistItems(db, uriToPlaylistItems, true);
    localStorage.setItem("spicetify-playlist-labels:liked-tracks-count", `${likedTracksCount}`);
    return trackUriToPlaylistData2;
  }
  async function clearCache() {
    localStorage.removeItem("spicetify-playlist-labels:liked-tracks-count");
    const db = await getDb();
    await writeCache(db, "playlists", [], true);
    await writeCache(db, "playlistItems", [], true);
  }

  // src/index.ts
  var VERSION = "0.3.0";
  var PREFIX = "spicetify-playlist-labels:";
  var SIZE_VAR = "--spicetify-playlist-labels-size";
  var GAP = 6;
  var MORE_WIDTH = 24 + GAP;
  var LIKED_SONGS_PATH = "/collection/tracks";
  var LABEL_CLASS = "spicetify-playlist-labels-label";
  var MENU_CLASS = "spicetify-playlist-labels-menu";
  function readSetting(key, fallback) {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  function writeSetting(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.warn("[playlist-labels] could not save setting", key, error);
    }
  }
  var settings = {
    showAllPlaylists: readSetting("show-all", false),
    showOnArtistPages: readSetting("show-on-artist-pages", true),
    // Rebalance Spotify's column widths around the title (see layout.ts).
    tidyColumns: readSetting("tidy-columns", true),
    // Share of the track list width the label column may take. Keeps the
    // title readable when the right panel is open or on artist pages.
    maxWidthRatio: readSetting("max-width-ratio", 0.2),
    maxLabels: readSetting("max-labels", 20),
    // Width given to Tagify's rating column while tidying (Tagify uses 150px).
    tagifyWidth: readSetting("tagify-width", 112)
  };
  var trackUriToPlaylistData = {};
  var dataVersion = 0;
  var updatePromise = Promise.resolve();
  var highlight = null;
  var scheduledFrame = 0;
  var gridStates = /* @__PURE__ */ new WeakMap();
  function currentPath() {
    return Spicetify.Platform.History.location.pathname;
  }
  function playlistPath(playlistData) {
    if (playlistData.isLikedTracks) return LIKED_SONGS_PATH;
    return `/playlist/${playlistData.uri.split(":").pop()}`;
  }
  function getLabels(trackUri, path) {
    return (trackUriToPlaylistData[trackUri] ?? []).filter((playlistData) => (settings.showAllPlaylists || playlistData.isOwnPlaylist) && playlistPath(playlistData) !== path);
  }
  function openPlaylist(playlistData, trackUri) {
    const path = playlistPath(playlistData);
    highlight = { trackUri, path, until: Date.now() + 1e4 };
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
        console.error("[playlist-labels] update failed", error);
      }
    });
  }
  function update() {
    const path = currentPath();
    const hidden = !settings.showOnArtistPages && path.startsWith("/artist/");
    for (const grid of getTracklists()) {
      let header = null;
      const tracks = [];
      for (const row of getRows(grid)) {
        if (isHeaderRow(row)) {
          header = row;
          continue;
        }
        const uri = getRowUri(row);
        if (uri) tracks.push({ row, uri });
      }
      if (tracks.length === 0) continue;
      const stateKey = `${path}|${dataVersion}|${settings.showAllPlaylists}|${settings.tidyColumns}`;
      let state = gridStates.get(grid);
      if (!state || state.key !== stateKey) {
        state = { key: stateKey, maxCount: 0, visibleCount: 0, columns: null };
        gridStates.set(grid, state);
      }
      const rows = tracks.map(({ row, uri }) => {
        const labels = hidden ? [] : getLabels(uri, path);
        state.maxCount = Math.max(state.maxCount, labels.length);
        return { row, uri, labels };
      });
      updateWidth(grid, state, tracks[0].row);
      for (const { row, uri, labels } of rows) {
        const cell = ensureCell(row, state, createRowCell);
        if (cell) renderCell(cell, uri, labels, state.visibleCount, stateKey);
        if (highlight && highlight.trackUri === uri && highlight.path === path) {
          highlight = null;
          row.scrollIntoView({ block: "center" });
          row.click();
        }
      }
      if (header) ensureCell(header, state, createHeaderCell);
    }
    if (highlight && Date.now() > highlight.until) highlight = null;
  }
  function updateWidth(grid, state, sampleRow) {
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
  function setStyle(element, property, value) {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  }
  function ensureCell(row, state, create) {
    const layout = getRowLayout(row);
    if (!layout) return null;
    const className = isHeaderRow(row) ? HEADER_CLASS : CELL_CLASS;
    let cell = Array.from(row.getElementsByClassName(className)).find((candidate) => candidate.closest('[role="row"]') === row) ?? null;
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
  function applyTemplate(layout, state, isHeader) {
    const native = getNativeTemplate(layout.container);
    if (!state.columns || state.columns.template !== native) {
      const tracks = parseTemplate(native);
      state.columns = tracks && !isHeader && tracks.length === layout.nativeCells.length ? { template: native, tracks, kinds: classifyColumns(tracks, layout.nativeCells) } : state.columns;
    }
    const columns = state.columns;
    if (!columns || columns.tracks.length !== layout.nativeCells.length) {
      ensureTemplate(layout);
      return;
    }
    setTemplate(layout.container, buildTemplate(columns.tracks, columns.kinds, {
      tidy: settings.tidyColumns,
      tagify: layout.tagify != null,
      tagifyWidth: settings.tagifyWidth
    }));
  }
  function createHeaderCell() {
    const cell = document.createElement("div");
    cell.className = HEADER_CLASS;
    cell.setAttribute("role", "columnheader");
    const text = document.createElement("span");
    text.textContent = "Labels";
    cell.append(text);
    return cell;
  }
  function createRowCell() {
    const cell = document.createElement("div");
    cell.className = CELL_CLASS;
    cell.setAttribute("role", "gridcell");
    for (const type of ["dblclick", "mousedown"]) {
      cell.addEventListener(type, (event) => {
        if (event.target.closest("button")) event.stopPropagation();
      });
    }
    return cell;
  }
  function renderCell(cell, trackUri, labels, visibleCount, stateKey) {
    const renderKey = `${trackUri}|${visibleCount}|${stateKey}`;
    if (cell.dataset.renderKey === renderKey) return;
    cell.dataset.renderKey = renderKey;
    const container = document.createElement("div");
    container.className = "spicetify-playlist-labels-labels";
    for (const playlistData of labels.slice(0, visibleCount)) {
      container.append(createLabel(playlistData, trackUri));
    }
    const hiddenLabels = labels.slice(visibleCount);
    if (visibleCount > 0 && hiddenLabels.length > 0) container.append(createMoreButton(hiddenLabels, trackUri));
    destroyTooltips(cell);
    cell.replaceChildren(container);
  }
  function createLabel(playlistData, trackUri) {
    const label = document.createElement("button");
    label.type = "button";
    label.className = LABEL_CLASS;
    label.setAttribute("aria-label", playlistData.name);
    if (playlistData.isLikedTracks) label.classList.add("spicetify-playlist-labels-liked");
    label.append(createCover(playlistData));
    addTooltip(label, playlistData.name);
    label.addEventListener("click", (event) => {
      event.stopPropagation();
      openPlaylist(playlistData, trackUri);
    });
    label.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showMenu(menuPosition(event, label), playlistMenuItems(playlistData, trackUri));
    });
    return label;
  }
  function createCover(playlistData) {
    const cover = document.createElement("span");
    cover.className = "spicetify-playlist-labels-cover";
    if (playlistData.isLikedTracks) cover.classList.add("spicetify-playlist-labels-liked");
    if (playlistData.image) {
      const image = document.createElement("img");
      image.src = playlistData.image;
      image.alt = "";
      image.loading = "lazy";
      image.draggable = false;
      image.addEventListener("error", () => image.remove());
      cover.append(image);
    }
    return cover;
  }
  function createMoreButton(hiddenLabels, trackUri) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spicetify-playlist-labels-more";
    button.textContent = `+${hiddenLabels.length}`;
    const description = `${hiddenLabels.length} more playlist${hiddenLabels.length === 1 ? "" : "s"}`;
    button.setAttribute("aria-label", description);
    addTooltip(button, description);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      showMenu(menuPosition(event, button), hiddenLabels.map((playlistData) => ({
        label: playlistData.name,
        cover: playlistData,
        onClick: () => openPlaylist(playlistData, trackUri)
      })));
    });
    return button;
  }
  function playlistMenuItems(playlistData, trackUri) {
    const items = [{ label: `Open ${playlistData.name}`, onClick: () => openPlaylist(playlistData, trackUri) }];
    if (!playlistData.isLikedTracks) {
      items.push({
        label: `Remove from ${playlistData.name}`,
        onClick: () => removeFromPlaylist(playlistData, trackUri)
      });
    }
    return items;
  }
  async function removeFromPlaylist(playlistData, trackUri) {
    try {
      await removeTrackFromPlaylist(playlistData.uri, trackUri, playlistData.trackUid);
      trackUriToPlaylistData[trackUri] = (trackUriToPlaylistData[trackUri] ?? []).filter((other) => other.uri !== playlistData.uri);
      refresh();
      Spicetify.showNotification(`Removed from ${playlistData.name}`);
    } catch (error) {
      console.error("[playlist-labels] remove failed", error);
      Spicetify.showNotification(`Could not remove from ${playlistData.name}`, true);
    }
  }
  function addTooltip(element, text) {
    if (typeof Spicetify.Tippy === "function") {
      try {
        Spicetify.Tippy(element, { ...Spicetify.TippyProps, content: text, delay: [200, 0] });
        return;
      } catch {
      }
    }
    element.title = text;
  }
  function destroyTooltips(root) {
    root.querySelectorAll("button").forEach((element) => element._tippy?.destroy());
  }
  function menuPosition(event, element) {
    if (event.clientX || event.clientY) return { x: event.clientX, y: event.clientY };
    const rect = element.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 4 };
  }
  function showMenu(position, items) {
    document.querySelector(`.${MENU_CLASS}`)?.remove();
    const menu = document.createElement("div");
    menu.className = MENU_CLASS;
    menu.setAttribute("role", "menu");
    menu.style.left = `${position.x}px`;
    menu.style.top = `${position.y}px`;
    const close = () => {
      menu.remove();
      document.removeEventListener("mousedown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
    const onOutside = (event) => {
      if (!(event.target instanceof Node && menu.contains(event.target))) close();
    };
    const buttons = items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      if (item.cover) button.append(createCover(item.cover));
      const text = document.createElement("span");
      text.textContent = item.label;
      button.append(text);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        close();
        item.onClick();
      });
      menu.append(button);
      return button;
    });
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }
    };
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    buttons[0]?.focus({ preventScroll: true });
    document.addEventListener("mousedown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
  }
  function describeError(error) {
    return error instanceof Event ? error.target?.error ?? error.type : error;
  }
  function queueUpdate(load) {
    const promise = updatePromise.catch(() => void 0).then(load);
    updatePromise = promise;
    promise.then((data) => {
      trackUriToPlaylistData = data;
      refresh();
    }).catch((error) => console.error("[playlist-labels] could not update playlist data", describeError(error)));
    return promise;
  }
  function addListener(api, event, listener) {
    try {
      api.getEvents().addListener(event, listener);
    } catch (error) {
      console.warn(`[playlist-labels] could not listen to ${event}`, error);
    }
  }
  function debounce(callback, delay) {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = window.setTimeout(callback, delay);
    };
  }
  function registerMenu() {
    let showAllItem = null;
    const toggleShowAll = () => {
      settings.showAllPlaylists = !settings.showAllPlaylists;
      writeSetting("show-all", settings.showAllPlaylists);
      if (playbarButton) playbarButton.active = settings.showAllPlaylists;
      if (showAllItem) showAllItem.isEnabled = settings.showAllPlaylists;
      refresh();
    };
    const playbarButton = Spicetify.Playbar?.Button ? new Spicetify.Playbar.Button(
      "Show All Saved Playlists",
      `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons?.spotify ?? ""}</svg>`,
      toggleShowAll,
      false,
      settings.showAllPlaylists
    ) : null;
    if (!Spicetify.Menu?.SubMenu) return;
    const toggle = (label, key, setting) => new Spicetify.Menu.Item(label, settings[setting], (item) => {
      settings[setting] = item.isEnabled = !settings[setting];
      writeSetting(key, settings[setting]);
      refresh();
    });
    showAllItem = new Spicetify.Menu.Item("Show all saved playlists", settings.showAllPlaylists, toggleShowAll);
    const rebuildItem = new Spicetify.Menu.Item("Rebuild cache", false, async () => {
      Spicetify.showNotification("Playlist Labels: rebuilding cache\u2026");
      await clearCache();
      queueUpdate(getTrackUriToPlaylistData).then(() => Spicetify.showNotification("Playlist Labels: cache rebuilt")).catch(() => Spicetify.showNotification("Playlist Labels: could not rebuild cache", true));
    });
    new Spicetify.Menu.SubMenu("Playlist Labels", [
      showAllItem,
      toggle("Show on artist pages", "show-on-artist-pages", "showOnArtistPages"),
      toggle("Tidy column widths", "tidy-columns", "tidyColumns"),
      rebuildItem
    ]).register();
  }
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
          sampleLabels: sample ? getLabels(getRowUri(sample), currentPath()).map((label) => label.name) : null,
          nativeTemplate: layout ? getNativeTemplate(layout.container) : null,
          template: layout?.container.style.getPropertyValue("grid-template-columns") || null
        };
      })
    };
  }
  async function main() {
    while (!Spicetify?.Platform?.History || !Spicetify.showNotification) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const style = document.createElement("style");
    style.id = "spicetify-playlist-labels-style";
    style.textContent = style_default;
    document.head.append(style);
    window.PlaylistLabels = { version: VERSION, debug };
    registerMenu();
    const mainView = document.querySelector(".Root__main-view") ?? document.body;
    new MutationObserver(schedule).observe(mainView, { childList: true, subtree: true });
    new ResizeObserver(schedule).observe(mainView);
    Spicetify.Platform.History.listen(schedule);
    addListener(Spicetify.Platform.LibraryAPI, "update", () => queueUpdate(updateLikedTracks));
    addListener(Spicetify.Platform.PlaylistAPI, "operation_complete", (event) => {
      const uri = event?.data?.uri;
      if (uri) queueUpdate(() => updatePlaylistData(uri));
    });
    addListener(Spicetify.Platform.RootlistAPI, "update", debounce(() => queueUpdate(getTrackUriToPlaylistData), 2e3));
    queueUpdate(getTrackUriToPlaylistData).catch((error) => {
      Spicetify.showNotification("Playlist Labels: could not load your playlists (see DevTools console)", true);
      console.error("[playlist-labels] could not load playlists", describeError(error));
    });
    console.info(`[playlist-labels] v${VERSION} loaded`);
  }
  main();
})();
