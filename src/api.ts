export async function getContents() {
    return await Spicetify.Platform.RootlistAPI.getContents({ decorateImagesAndOwner: true });
}

export async function getLikedTracksCount() {
    return (await Spicetify.Platform.LibraryAPI.getTracks()).totalLength;
}

export async function getPlaylistItems(uri) {
    const result = await Spicetify.Platform.PlaylistAPI.getContents(uri);
    return result.items;
}

export async function removeTrackFromPlaylist(playlistUri, trackUri, trackUid) {
    await Spicetify.Platform.PlaylistAPI.remove(playlistUri, [{ uri: trackUri, uid: trackUid ?? '' }]);
}

export async function getLikedTracks() {
    return await Spicetify.Platform.LibraryAPI.getTracks({ limit: Number.MAX_SAFE_INTEGER });
}

/**
 * Picks the smallest playlist image that still looks sharp at label size and
 * turns `spotify:image:` / `spotify:mosaic:` URIs into loadable URLs.
 */
export function getImageUrl(images: any[] | undefined): string {
    if (!images?.length) return '';
    const sized = images.filter((image) => image?.url && (image.width ?? image.size));
    const image = sized
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
        .find((candidate) => (candidate.width ?? 0) >= 60) ?? images[0];
    const url: string = image?.url ?? '';

    if (url.startsWith('spotify:image:')) {
        return `https://i.scdn.co/image/${url.slice('spotify:image:'.length)}`;
    }
    if (url.startsWith('spotify:mosaic:')) {
        return `https://mosaic.scdn.co/300/${url.slice('spotify:mosaic:'.length).split(':').join('')}`;
    }
    return url;
}
