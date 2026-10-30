// Bundles the extension into a single file Spicetify can load.
import { build, context } from 'esbuild';

const options = {
    entryPoints: ['src/index.ts'],
    outfile: 'dist/spicetify-playlist-labels.js',
    bundle: true,
    format: 'iife',
    target: 'chrome120',
    loader: { '.css': 'text' },
    minify: process.argv.includes('--minify'),
    banner: { js: '// Playlist Labels for Spicetify - https://github.com/duffey/spicetify-playlist-labels (fork for Spotify 1.3)' },
    logLevel: 'info',
};

if (process.argv.includes('--watch')) {
    await (await context(options)).watch();
} else {
    await build(options);
}
