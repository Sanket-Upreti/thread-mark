import { Agent } from 'node:https';
import { WebClient } from '@slack/web-api';

export const REQUIRED_SCOPES = [
  'channels:history',
  'groups:history',
  'im:history',
  'mpim:history',
  'users:read',
  'files:read',
];

// Pooled so the long-lived web and MCP servers reuse sockets between requests. Holds
// connections, never tokens — a fresh client is still built per request.
const keepAliveAgent = new Agent({ keepAlive: true, maxSockets: 10 });

/**
 * Reads SLACK_USER_TOKEN, which loadDotEnv() populates from .env.
 *
 * Only the CLI and the MCP server may call this. The web server never does and never even
 * loads .env, so a browser cannot reach the token on disk — it must send its own.
 */
export function envToken(): string {
  const token = process.env.SLACK_USER_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'No Slack token found.\n\n' +
        'Create a .env file in the project root containing:\n' +
        '  SLACK_USER_TOKEN=xoxp-your-token-here\n\n' +
        'Copy .env.example to get started. The token must be a user token (xoxp-), with these ' +
        `scopes: ${REQUIRED_SCOPES.join(', ')}.\n` +
        'See README.md for how to create one.'
    );
  }
  return token;
}

/**
 * The token is always passed in explicitly — there is no environment fallback here, so the
 * web server cannot use .env by accident. It lives only for the duration of the call.
 */
export function createSlackClient(token: string): WebClient {
  if (!token.trim()) {
    throw new Error('No Slack token provided for this request.');
  }
  if (!token.startsWith('xoxp-')) {
    console.error(
      'Warning: that does not look like a user token (expected an "xoxp-" prefix). Bot tokens ' +
        '(xoxb-) cannot read channel history via conversations.replies.'
    );
  }

  return new WebClient(token, {
    agent: keepAliveAgent,
    // Default is no timeout at all, which is how a rate-limited request hangs forever.
    timeout: 30_000,
    // The SDK's default retry policy spans about thirty minutes. Cap concurrency and fail
    // fast instead — this is an interactive tool.
    maxRequestConcurrency: 5,
    retryConfig: { retries: 2, minTimeout: 300, maxTimeout: 2000, randomize: true },
  });
}
