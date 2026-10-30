// Playlist Labels for Spicetify - https://github.com/duffey/spicetify-playlist-labels (fork for Spotify 1.3)
(() => {
  // src/style.css
  var style_default = ".spicetify-playlist-labels-cell,\n.spicetify-playlist-labels-header {\n    display: flex;\n    align-items: center;\n    justify-content: flex-end;\n    min-width: 0;\n    overflow: hidden;\n}\n\n.spicetify-playlist-labels-header {\n    color: var(--text-subdued, #b3b3b3);\n}\n\n.spicetify-playlist-labels-labels {\n    display: flex;\n    /* First label (rated playlists, then Liked Songs) sits closest to the right. */\n    flex-direction: row-reverse;\n    align-items: center;\n    gap: 6px;\n    overflow: hidden;\n}\n\n.spicetify-playlist-labels-labels::after {\n    content: '\u22EF';\n    display: none;\n    width: 14px;\n    text-align: center;\n    color: var(--text-subdued, #b3b3b3);\n}\n\n.spicetify-playlist-labels-labels.spicetify-playlist-labels-overflow::after {\n    display: block;\n}\n\n.spicetify-playlist-labels-label {\n    flex: 0 0 auto;\n    width: var(--spicetify-playlist-labels-size, 28px);\n    height: var(--spicetify-playlist-labels-size, 28px);\n    border-radius: calc(var(--spicetify-playlist-labels-size, 28px) * 0.1);\n    overflow: hidden;\n    cursor: pointer;\n    background-color: var(--background-tinted-base, rgba(255, 255, 255, 0.1));\n}\n\n.spicetify-playlist-labels-label:hover {\n    outline: 1px solid var(--text-base, #fff);\n}\n\n.spicetify-playlist-labels-liked {\n    background: linear-gradient(135deg, #450af5, #c4efd9);\n}\n\n.spicetify-playlist-labels-label > img {\n    display: block;\n    width: 100%;\n    height: 100%;\n    object-fit: cover;\n}\n\n.spicetify-playlist-labels-menu {\n    position: fixed;\n    z-index: 9999;\n    padding: 4px;\n    border-radius: 4px;\n    background-color: var(--background-elevated-highlight, #3e3e3e);\n    box-shadow: 0 16px 24px rgba(0, 0, 0, 0.3), 0 6px 8px rgba(0, 0, 0, 0.2);\n}\n\n.spicetify-playlist-labels-menu > button {\n    display: block;\n    max-width: 320px;\n    padding: 12px 12px;\n    border: 0;\n    border-radius: 2px;\n    background: none;\n    color: var(--text-base, #fff);\n    font: inherit;\n    font-size: 0.875rem;\n    text-align: left;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    cursor: pointer;\n}\n\n.spicetify-playlist-labels-menu > button:hover {\n    background-color: var(--background-tinted-highlight, rgba(255, 255, 255, 0.1));\n}\n";

  // src/api.ts
  async function getContents() {
    return await Spicetify.Platform.RootlistAPI.getContents({ decorateImagesAndOwner: true });
  }
  async function getLikedTracksCount() {
    return (await Spicetify.Platform.LibraryAPI.getTracks()).totalLength;
  }
  async function getPlaylistItems(uri) {
    const result = await Spicetify.Platform.PlaylistAPI.getContents(uri);
    return result.items;
  }
  async function removeTrackFromPlaylist(playlistUri, trackUri, trackUid) {
    await Spicetify.Platform.PlaylistAPI.remove(playlistUri, [{ uri: trackUri, uid: trackUid ?? "" }]);
  }
  async function getLikedTracks() {
    return await Spicetify.Platform.LibraryAPI.getTracks({ limit: Number.MAX_SAFE_INTEGER });
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
  var RIGHT_NEIGHBOUR_CELLS = ".tagify-info, .tagify-header";
  var RIGHT_NEIGHBOUR_LINES = ["[tagify]"];
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
    const anchor = neighbour ?? last;
    if (neighbour && !siblings.includes(neighbour)) siblings.splice(siblings.indexOf(last), 0, neighbour);
    return { container, cells: siblings, anchor };
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
      ...playlist,
      isRatedPlaylist: ratedPlaylists.some((ratedPlaylist) => ratedPlaylist.uri === playlist.uri)
    }));
    return allPlaylists;
  }
  async function getDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("spicetify-playlist-labels", 1);
      request.onerror = (event) => {
        reject(event);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore("playlists", { keyPath: "uri" });
        db.createObjectStore("playlistItems", { keyPath: "uri" });
      };
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
    });
  }
  async function getCachedPlaylists(db) {
    return new Promise((resolve, reject) => {
      const playlistObjectStoreRequest = db.transaction("playlists").objectStore("playlists").getAll();
      playlistObjectStoreRequest.onsuccess = (event) => {
        resolve(playlistObjectStoreRequest.result);
      };
      playlistObjectStoreRequest.onerror = (event) => {
        reject(event);
      };
    });
  }
  async function getCachedPlaylistItems(db) {
    return new Promise((resolve, reject) => {
      const playlistItemsObjectStoreRequest = db.transaction("playlistItems").objectStore("playlistItems").getAll();
      playlistItemsObjectStoreRequest.onsuccess = (event) => {
        resolve(playlistItemsObjectStoreRequest.result);
      };
      playlistItemsObjectStoreRequest.onerror = (event) => {
        reject(event);
      };
    });
  }
  async function clearCachedPlaylists(db) {
    return new Promise((resolve, reject) => {
      const playlistObjectStoreRequest = db.transaction("playlists", "readwrite").objectStore("playlists").clear();
      playlistObjectStoreRequest.onsuccess = (event) => {
        resolve();
      };
      playlistObjectStoreRequest.onerror = (event) => {
        reject(event);
      };
    });
  }
  async function clearCachedPlaylistItems(db) {
    return new Promise((resolve, reject) => {
      const playlistItemsObjectStoreRequest = db.transaction("playlistItems", "readwrite").objectStore("playlistItems").clear();
      playlistItemsObjectStoreRequest.onsuccess = (event) => {
        resolve();
      };
      playlistItemsObjectStoreRequest.onerror = (event) => {
        reject(event);
      };
    });
  }
  async function cachePlaylists(db, playlists) {
    return new Promise((resolve, reject) => {
      const playlistObjectStore = db.transaction("playlists", "readwrite").objectStore("playlists");
      playlists.forEach((playlist) => {
        playlistObjectStore.put(playlist);
      });
      playlistObjectStore.transaction.oncomplete = (event) => {
        resolve();
      };
      playlistObjectStore.transaction.onerror = (event) => {
        reject(event);
      };
    });
  }
  async function cachePlaylistItems(db, uriToPlaylistItems) {
    return new Promise((resolve, reject) => {
      const playlistItemsObjectStore = db.transaction("playlistItems", "readwrite").objectStore("playlistItems");
      Object.entries(uriToPlaylistItems).forEach(([uri, items]) => {
        playlistItemsObjectStore.put({ uri, items });
      });
      playlistItemsObjectStore.transaction.oncomplete = (event) => {
        resolve();
      };
      playlistItemsObjectStore.transaction.onerror = (event) => {
        reject(event);
      };
    });
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
    await clearCachedPlaylists(db);
    await clearCachedPlaylistItems(db);
    await cachePlaylists(db, playlists);
    await cachePlaylistItems(db, uriToPlaylistItems);
    localStorage.setItem("spicetify-playlist-labels:liked-tracks-count", `${likedTracksCount}`);
    return trackUriToPlaylistData2;
  }
  async function clearCache() {
    localStorage.removeItem("spicetify-playlist-labels:liked-tracks-count");
    const db = await getDb();
    await clearCachedPlaylists(db);
    await clearCachedPlaylistItems(db);
    db.close();
  }

  // src/index.ts
  var PREFIX = "spicetify-playlist-labels:";
  var SIZE_VAR = "--spicetify-playlist-labels-size";
  var GAP = 6;
  var OVERFLOW_WIDTH = 14 + GAP;
  var LIKED_SONGS_PATH = "/collection/tracks";
  function readSetting(key, fallback) {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  function writeSetting(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }
  var settings = {
    showAllPlaylists: readSetting("show-all", false),
    showOnArtistPages: readSetting("show-on-artist-pages", true),
    // Share of the track list width the label column may take. Keeps the
    // title/album columns readable when the right panel is open.
    maxWidthRatio: readSetting("max-width-ratio", 0.2),
    maxLabels: readSetting("max-labels", 20)
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
      const stateKey = `${path}|${dataVersion}|${settings.showAllPlaylists}`;
      let state = gridStates.get(grid);
      if (!state || state.key !== stateKey) {
        state = { key: stateKey, maxCount: 0, visibleCount: 0 };
        gridStates.set(grid, state);
      }
      const rows = tracks.map(({ row, uri }) => {
        const labels = hidden ? [] : getLabels(uri, path);
        state.maxCount = Math.max(state.maxCount, labels.length);
        return { row, uri, labels };
      });
      updateWidth(grid, state, tracks[0].row);
      if (header) ensureCell(header, createHeaderCell);
      for (const { row, uri, labels } of rows) {
        const cell = ensureCell(row, createRowCell);
        if (cell) renderCell(cell, uri, labels, state.visibleCount, stateKey);
        if (highlight && highlight.trackUri === uri && highlight.path === path) {
          highlight = null;
          row.scrollIntoView({ block: "center" });
          row.click();
        }
      }
    }
    if (highlight && Date.now() > highlight.until) highlight = null;
  }
  function updateWidth(grid, state, sampleRow) {
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
  function setStyle(element, property, value) {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  }
  function ensureCell(row, create) {
    const layout = getRowLayout(row);
    if (!layout) return null;
    const className = isHeaderRow(row) ? HEADER_CLASS : CELL_CLASS;
    let cell = Array.from(row.getElementsByClassName(className)).find((candidate) => candidate.closest('[role="row"]') === row) ?? null;
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
    const cell = document.createElement("div");
    cell.className = HEADER_CLASS;
    cell.setAttribute("role", "columnheader");
    cell.title = "Playlists";
    const icon = Spicetify.SVGIcons?.playlist;
    if (icon) cell.innerHTML = `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${icon}</svg>`;
    return cell;
  }
  function createRowCell() {
    const cell = document.createElement("div");
    cell.className = CELL_CLASS;
    cell.setAttribute("role", "gridcell");
    for (const type of ["dblclick", "mousedown"]) {
      cell.addEventListener(type, (event) => {
        if (event.target.closest(".spicetify-playlist-labels-label")) event.stopPropagation();
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
    if (labels.length > visibleCount) container.classList.add("spicetify-playlist-labels-overflow");
    for (const playlistData of labels.slice(0, visibleCount)) {
      container.append(createLabel(playlistData, trackUri));
    }
    cell.replaceChildren(container);
  }
  function createLabel(playlistData, trackUri) {
    const label = document.createElement("div");
    label.className = "spicetify-playlist-labels-label";
    if (playlistData.isLikedTracks) label.classList.add("spicetify-playlist-labels-liked");
    if (playlistData.image) {
      const image = document.createElement("img");
      image.src = playlistData.image;
      image.alt = "";
      image.loading = "lazy";
      image.draggable = false;
      image.addEventListener("error", () => image.remove());
      label.append(image);
    }
    addTooltip(label, playlistData.name);
    label.addEventListener("click", (event) => {
      event.stopPropagation();
      const path = playlistPath(playlistData);
      highlight = { trackUri, path, until: Date.now() + 1e4 };
      Spicetify.Platform.History.push({ pathname: path, search: `?uid=${playlistData.trackUid}` });
    });
    if (!playlistData.isLikedTracks) {
      label.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showRemoveMenu(event, playlistData, trackUri);
      });
    }
    return label;
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
  function showRemoveMenu(event, playlistData, trackUri) {
    document.querySelector(".spicetify-playlist-labels-menu")?.remove();
    const menu = document.createElement("div");
    menu.className = "spicetify-playlist-labels-menu";
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    const button = document.createElement("button");
    button.textContent = `Remove from ${playlistData.name}`;
    button.addEventListener("click", async (clickEvent) => {
      clickEvent.stopPropagation();
      menu.remove();
      try {
        await removeTrackFromPlaylist(playlistData.uri, trackUri, playlistData.trackUid);
        trackUriToPlaylistData[trackUri] = (trackUriToPlaylistData[trackUri] ?? []).filter((other) => other.uri !== playlistData.uri);
        dataVersion++;
        schedule();
        Spicetify.showNotification(`Removed from ${playlistData.name}`);
      } catch (error) {
        console.error("[playlist-labels] remove failed", error);
        Spicetify.showNotification(`Could not remove from ${playlistData.name}`, true);
      }
    });
    menu.append(button);
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;
    const close = (closeEvent) => {
      if (closeEvent instanceof KeyboardEvent && closeEvent.key !== "Escape") return;
      if (closeEvent.target instanceof Node && menu.contains(closeEvent.target)) return;
      menu.remove();
      document.removeEventListener("mousedown", close, true);
      document.removeEventListener("keydown", close, true);
      window.removeEventListener("blur", close);
    };
    document.addEventListener("mousedown", close, true);
    document.addEventListener("keydown", close, true);
    window.addEventListener("blur", close);
  }
  function queueUpdate(load) {
    const promise = updatePromise.catch(() => void 0).then(load);
    updatePromise = promise;
    setData(promise);
    return promise;
  }
  function setData(promise) {
    promise.then((data) => {
      trackUriToPlaylistData = data;
      dataVersion++;
      schedule();
    }).catch((error) => console.error("[playlist-labels] could not update playlist data", error));
  }
  function addListener(api, event, listener) {
    try {
      api.getEvents().addListener(event, listener);
    } catch (error) {
      console.warn(`[playlist-labels] could not listen to ${event}`, error);
    }
  }
  function registerMenu() {
    let showAllItem = null;
    const playbarButton = Spicetify.Playbar?.Button ? new Spicetify.Playbar.Button(
      "Show All Saved Playlists",
      `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons?.spotify ?? ""}</svg>`,
      (button) => toggleShowAll(button),
      false,
      settings.showAllPlaylists
    ) : null;
    const toggleShowAll = (button = playbarButton) => {
      settings.showAllPlaylists = !settings.showAllPlaylists;
      writeSetting("show-all", settings.showAllPlaylists);
      if (button) button.active = settings.showAllPlaylists;
      if (showAllItem) showAllItem.isEnabled = settings.showAllPlaylists;
      schedule();
    };
    if (!Spicetify.Menu?.SubMenu) return;
    showAllItem = new Spicetify.Menu.Item("Show all saved playlists", settings.showAllPlaylists, () => toggleShowAll());
    const artistItem = new Spicetify.Menu.Item("Show on artist pages", settings.showOnArtistPages, (item) => {
      settings.showOnArtistPages = item.isEnabled = !settings.showOnArtistPages;
      writeSetting("show-on-artist-pages", settings.showOnArtistPages);
      dataVersion++;
      schedule();
    });
    const rebuildItem = new Spicetify.Menu.Item("Rebuild cache", false, async () => {
      Spicetify.showNotification("Playlist Labels: rebuilding cache\u2026");
      await clearCache();
      queueUpdate(getTrackUriToPlaylistData).then(() => Spicetify.showNotification("Playlist Labels: cache rebuilt")).catch(() => Spicetify.showNotification("Playlist Labels: could not rebuild cache", true));
    });
    new Spicetify.Menu.SubMenu("Playlist Labels", [showAllItem, artistItem, rebuildItem]).register();
  }
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
          sampleLabels: sample ? getLabels(getRowUri(sample), currentPath()).map((label) => label.name) : null,
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
    window.PlaylistLabels = { debug };
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
    queueUpdate(getTrackUriToPlaylistData).catch((error) => {
      console.error("[playlist-labels] could not load playlists", error);
      Spicetify.showNotification("Playlist Labels: could not load your playlists (see DevTools console)", true);
    });
  }
  main();
})();
