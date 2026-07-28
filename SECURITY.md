# Security

## Reporting a vulnerability

Open a [private security advisory](https://github.com/Sanket-Upreti/thread-mark/security/advisories/new).
Please don't open a public issue for anything exploitable.

## What this project handles

A Slack **user** OAuth token (`xoxp-`), which can read every conversation its owner can read.
That makes two things matter: where the token lives, and what happens to thread content that
someone else wrote.

## Where the token lives

| Surface | Storage | Reaches `.env`? |
|---|---|---|
| CLI, MCP server | `SLACK_USER_TOKEN`, read from `.env` | yes |
| Web UI | `sessionStorage`, cleared when the tab closes | **no** |
| Extension | `chrome.storage.session`, memory only | **no** |

- **The web server never loads `.env`.** `SLACK_USER_TOKEN` is not in its process environment,
  and `createSlackClient()` takes the token as a required argument with no environment fallback.
  There is no code path from an HTTP request to the token on disk. A request arriving without a
  token is rejected with a 400 rather than served with the operator's credentials.
- The server binds to `127.0.0.1` only. The single outbound request is to Slack's API.
- The token is used to build a one-off client per request and then dropped — never logged, never
  written to disk, never held after the request returns.
- `localStorage` is never used, by any surface.

## Thread content is untrusted

Anyone in a Slack workspace can post a message, so message text is attacker-controllable and it
reaches `innerHTML` in the preview panes. The renderer is the trust boundary:

- All text is HTML-escaped before any markup is inserted.
- Link and image URLs are **allow-listed**. `javascript:`, `vbscript:`, `data:text/html` and
  protocol-relative `//host` URLs render as literal text rather than as links.
- Image `data:` URIs are limited to raster types. `image/svg+xml` is excluded: an SVG can carry
  script, and it is inert inside `<img>` only because browsers disable scripting there — that is
  their guarantee to withdraw, not one to depend on.
- External links carry `rel="noopener noreferrer"`.

`test/xss.test.ts` locks this down with 28 cases covering script and event-handler injection,
scheme smuggling, and attribute breakout. It asserts against emitted **tags**, not raw text,
because correctly escaped output still contains strings like `onerror=` and matching on text
produces false alarms.

## Known limitations

- **Pasting into the editor's rich pane is self-XSS territory.** That pane is `contenteditable`,
  so pasted HTML is handled by the browser's own paste sanitiser rather than by this project. An
  attacker would have to persuade you to copy hostile markup and paste it into your own editor;
  the payoff would be reading a token from `sessionStorage`. Don't paste markup you don't trust.
- **No secret or PII redaction.** Thread content is reproduced verbatim. Don't point this at
  threads containing credentials you don't want in a file or handed to an MCP client.
- **The request body is read without a size limit.** Only reachable from localhost.

## Dependencies

`bun audit` is expected to report one moderate advisory: a path-traversal issue in
`@hono/node-server`, pulled in transitively by `@modelcontextprotocol/sdk`. It affects
`serve-static`, which this project never reaches — the MCP server uses the stdio transport, not
HTTP. It will clear when the SDK bumps its own dependency.
