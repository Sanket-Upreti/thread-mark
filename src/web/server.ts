#!/usr/bin/env bun
//
// This server deliberately does NOT load .env. The token in .env belongs to the CLI and the
// MCP server; anything reachable from a browser must send its own token, entered in the UI
// and held in that tab's sessionStorage (or the extension's chrome.storage.session).
// Set PORT as a real environment variable if you need to override it.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createSlackClient } from '../slack/client.js';
import { fetchThread } from '../slack/fetchThread.js';
import { formatThread } from '../convert/format.js';
import { isHeaderPreset } from '../convert/digest.js';

// Resolves to the project root from both src/web (tsx) and dist/web (built).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CLIENT_DIR = path.join(ROOT, 'dist', 'client');

const PAGES: Record<string, string> = {
  '/': 'index.html',
  '/settings': 'settings.html',
};

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;
const HOST = '127.0.0.1'; // localhost only — this process handles your Slack token

if (!existsSync(path.join(CLIENT_DIR, 'converter.js'))) {
  console.error('Browser code is not built. Run: npm run build:client');
  process.exit(1);
}

/** Maps a URL path to a file inside public/ or dist/client/, or null if there isn't one. */
function resolveStatic(pathname: string): string | null {
  const page = PAGES[pathname];
  if (page) return path.join(PUBLIC_DIR, page);

  const isClient = pathname.startsWith('/js/');
  const dir = isClient ? CLIENT_DIR : PUBLIC_DIR;
  const relative = isClient ? pathname.slice('/js/'.length) : pathname.slice(1);

  const target = path.resolve(dir, relative);
  // Never serve outside the directory the request maps to.
  if (!target.startsWith(dir + path.sep)) return null;

  return existsSync(target) && statSync(target).isFile() ? target : null;
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    sendJson(res, 500, { error: (err as Error).message });
  });
});

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (req.method === 'GET') {
    const file = resolveStatic(url.pathname);
    if (file) {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
      return;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/thread') {
    await handleThread(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

async function handleThread(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const permalink = typeof body.permalink === 'string' ? body.permalink.trim() : '';
  // The caller's own token, for this one request: never logged, never written to disk, not
  // held past this function. There is no server-side fallback — a request without a token
  // is rejected rather than quietly borrowing one.
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!permalink) {
    sendJson(res, 400, { error: 'Missing "permalink" in the request body.' });
    return;
  }

  if (!token) {
    sendJson(res, 400, {
      error: 'No Slack token was sent. Add one on the Workspaces page.',
    });
    return;
  }

  // An unrecognised preset falls back to the default rather than failing the request --
  // the header is a presentation choice, not something worth losing a fetch over.
  const header = isHeaderPreset(body.header) ? body.header : undefined;

  try {
    const client = createSlackClient(token);
    const thread = await fetchThread(client, permalink);
    sendJson(res, 200, { markdown: formatThread(thread, { header, permalink }) });
  } catch (err: unknown) {
    sendJson(res, 502, { error: (err as Error).message });
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

server.listen(PORT, HOST, () => {
  console.error(`thread-mark is at http://${HOST}:${PORT} (localhost only)`);
});
