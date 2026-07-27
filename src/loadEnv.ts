import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Project root, whether running from src/ (tsx) or dist/ (built).
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parses .env text. Handles comments, `export ` prefixes, and quoted values. */
export function parseEnv(source: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    if (!key) continue;

    let value = line.slice(eq + 1).trim();

    if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else if (value.startsWith("'") && value.endsWith("'") && value.length > 1) {
      value = value.slice(1, -1);
    } else {
      // Unquoted values end at an inline comment.
      value = value.split(/\s+#/)[0].trim();
    }

    values[key] = value;
  }

  return values;
}

/** Walks up from `startDir` looking for a .env, stopping at the filesystem root. */
export function findEnvFile(startDir: string): string | undefined {
  let dir = path.resolve(startDir);

  for (;;) {
    const candidate = path.join(dir, '.env');
    if (existsSync(candidate)) return candidate;

    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Loads a .env into process.env so no `export` is needed. Searches upward from the
 * working directory, then falls back to the package root so an installed `thread-mark`
 * works from anywhere. Real environment variables always win.
 *
 * Returns the file it used, or undefined if there wasn't one — absence is not an error,
 * since the token can also come from the environment or the browser UI.
 */
export function loadDotEnv(): string | undefined {
  const file = findEnvFile(process.cwd()) ?? findEnvFile(PACKAGE_ROOT);
  if (!file) return undefined;

  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (!(key in process.env)) process.env[key] = value;
  }

  return file;
}
