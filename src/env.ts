// Side-effect module: importing it loads .env into process.env.
//
// Imported ONLY by the CLI and the MCP server. The web server must never import it — the
// token in .env is not for anything a browser can reach.
//
// Import it FIRST in those entry points. ES module imports are hoisted and evaluated in
// source order, so a bare `loadDotEnv()` call in an entry point's body would run after its
// imports had already been evaluated — too late for any module reading process.env at
// import time.
import { loadDotEnv } from './loadEnv.js';

/** Path of the .env that was loaded, or undefined if there wasn't one. */
export const ENV_FILE = loadDotEnv();
