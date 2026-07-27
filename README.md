# thread-mark

Turn a Slack thread into clean, LLM-ready markdown — from your terminal, your browser, or from
inside Claude itself.

Paste a Slack permalink and get a readable transcript: usernames resolved, Slack's `mrkdwn`
converted to real markdown, bot messages unpacked, reactions and files preserved, timestamps
shown as relative deltas. One converter, four ways to reach it.

- [**Using thread-mark**](#using-thread-mark) — install it, get a token, convert things
- [**Developing thread-mark**](#developing-thread-mark) — architecture, layout, how to extend it

---

# Using thread-mark

## What you get

**Clean transcripts from any thread.** Whole threads, not just the first page. `*bold*` becomes
`**bold**`, `<@U123>` becomes `@ana`, `&gt;` becomes a real blockquote, and 27 common emoji
shortcodes become actual emoji. Consecutive messages from one person collapse under a single
header, the way Slack itself groups them.

**Bot messages that actually say something.** GitHub, Jira, and Datadog leave `message.text` as a
one-line summary and put the real content in `blocks` or `attachments`. thread-mark reads those,
so an alert thread doesn't come out as five lines of "New alert".

**Readable timing.** The first message gets an absolute timestamp; every reply after it is a
delta — `+3m`, `+1h 5m` — so you can see how a conversation actually unfolded.

**Reactions and files kept.** `[👍 ×3]` and `📎 [trace.png](…)` stay inline instead of vanishing.

**A two-way markdown editor.** Type markdown and watch it render, or click the arrow and paste
rich text from a browser or doc to get markdown back. Copy either side — the rendered side copies
as rich text, so formatting survives into a doc or an email.

**Noise filtered.** Join/leave notices and topic changes are dropped, unless that's all the
thread contains — in which case you get them rather than an empty file.

## Quick start

```bash
bun install
bun run build
cp .env.example .env     # then paste your Slack token into it
```

That's it. The CLI and MCP server read `.env` themselves — **no `export`, no environment
variable, no flag.**

```bash
bun run cli <slack-permalink>   # markdown to stdout
bun run dev                        # web UI at http://127.0.0.1:4321
```

The web UI and Chrome extension are deliberately **not** wired to `.env` — see
[why](#the-env-token-is-for-the-terminal-only). Paste a token into their own UI once and it stays
for that browser session.

## Runtime

**[Bun](https://bun.sh) 1.3 or newer. That's the only requirement — Node is not used anywhere.**

Bun handles install, build, tests, and all four surfaces. `bun.lock` is the committed lockfile;
there is no `package-lock.json`, and `package.json` declares `engines.bun`. Configuration lives
in [`bunfig.toml`](bunfig.toml) — note the name, since a file called `bun.toml` is silently
ignored by Bun.

```bash
curl -fsSL https://bun.sh/install | bash   # if you don't have it
bun --version                              # expect 1.3.0 or newer
```

## Getting a Slack token

The one thing only you can supply, since it comes from your workspace. About two minutes:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
2. Open **OAuth & Permissions** and add these under **User Token Scopes** (not Bot Token Scopes):
   `channels:history`, `groups:history`, `im:history`, `mpim:history`, `users:read`, `files:read`
3. Click **Install to Workspace**.
4. Copy the **User OAuth Token** — it starts with `xoxp-`.
5. Put it in `.env`:

   ```
   SLACK_USER_TOKEN=xoxp-your-token-here
   ```

It must be a **user token**, not a bot token. Bot tokens only read channels the bot was invited
to; a user token sees whatever you can already see in Slack.

> **Keep this an internal, single-workspace app** — don't submit it for Slack Marketplace review.
> Since May 2025, Slack throttles `conversations.history` and `conversations.replies` to 15
> messages/request and 1 request/minute for apps that aren't Marketplace-approved. Internal apps
> built for your own workspace are exempt and keep the old limits (1,000 messages/request,
> 50+ requests/minute).

## The four surfaces

| | Best for | Token comes from |
|---|---|---|
| [CLI](#cli) | scripting, piping into a repo | `.env` |
| [Web UI](#web-ui) | one-off conversions, the markdown editor | pasted, per browser tab |
| [MCP server](#mcp-server) | letting Claude fetch threads itself | `.env` |
| [Chrome extension](#chrome-extension) | converting without leaving the browser | pasted, per browser session |

### CLI

```bash
bun run cli <permalink> [--write <path>] [--copy]
```

Arguments pass straight through — Bun needs no `--` separator. Run with no permalink and it
prints usage and exits 1.

```bash
# Print markdown to stdout
bun run cli https://myteam.slack.com/archives/C0123ABCD/p1753526400123456

# Write into a repo an agent is already working in
bun run cli https://myteam.slack.com/archives/C0123ABCD/p1753526400123456 --write context.md

# Copy to clipboard
bun run cli https://myteam.slack.com/archives/C0123ABCD/p1753526400123456 --copy
```

After `bun run build` you can also call the built file directly:

```bash
bun dist/cli.js https://myteam.slack.com/archives/C0123ABCD/p1753526400123456
```

Get a permalink from Slack via a message's **More actions → Copy link**.

### Web UI

```bash
bun run dev     # or `bun run web` — the same thing
```

Serves `http://127.0.0.1:4321`, localhost only. Two modes:

**From Slack** — pick a workspace, paste a permalink, Convert. The result has raw/preview tabs,
Copy, and Download .md.

**Editor** — nothing to do with Slack, and it converts both ways. A round button on the seam
between the panes shows which way content is flowing; click it to reverse:

- **→** you type markdown on the left, it renders live on the right
- **←** you paste rich text on the right — from Slack, a browser, a doc — and get markdown on the
  left, with bold, links, lists, quotes, images and code blocks preserved

Both panes stay in sync as you type, so the button only changes which one you edit. It never
re-derives on click, which would round-trip your text and lose formatting.

Each pane has its own copy button, so the output is one click away whichever way the arrow
points. The markdown pane copies plain text; the rendered pane copies **rich text**, so bold,
links and lists survive being pasted into a doc, an email, or Slack.

Light and dark follow your OS's `prefers-color-scheme`.

> Links between the converter and the Workspaces page navigate in the _same tab_ on purpose:
> `sessionStorage` is per-tab, so a new tab would show an empty, disconnected list.

### MCP server

Lets Claude fetch a thread itself when you paste a Slack link, instead of you exporting it by
hand. It speaks JSON-RPC over stdin/stdout, so an MCP client spawns it — running it in a terminal
by hand just looks like it's hanging, because it's waiting for a client.

Register the built server with Claude Code (`.mcp.json`) or Claude Desktop:

```json
{
  "mcpServers": {
    "thread-mark": {
      "command": "bun",
      "args": ["/absolute/path/to/thread-mark/dist/mcp/server.js"]
    }
  }
}
```

The MCP client needs `bun` on **its** `PATH`, which is not always the same `PATH` your shell has
— GUI apps like Claude Desktop often don't inherit your shell profile. If the server fails to
start, use the absolute path to the binary (`which bun`) as `command`.

Like the CLI, it picks up `.env` from the project root, so no `env` block is needed. Add one only
if you'd rather keep the token in the client's config, or if the client spawns it from a
directory with no `.env` above it:

```json
"env": { "SLACK_USER_TOKEN": "xoxp-..." }
```

It exposes one tool, `get_slack_thread(permalink)`, returning the same markdown the CLI produces.

### Chrome extension

Convert-and-copy from the browser toolbar, plus the same two-way markdown editor. It injects
nothing into Slack's pages.

1. `bun run build` — assembles `dist/extension/`
2. `bun run dev` and leave it running; the extension calls it
3. Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → select
   **`dist/extension/`**

> **Load `dist/extension/`, not `src/extension/`.** The source folder holds only markup and a
> manifest — the stylesheet and JavaScript are shared with the web UI and copied in at build
> time. Load the source folder by mistake and the popup renders unstyled with dead buttons; it
> will say so at the top if you do.

On WSL, paste the UNC path into the file picker's address bar rather than browsing to it:

```
\\wsl.localhost\<distro>\home\<you>\path\to\thread-mark\dist\extension
```

The popup holds one token, pasted in directly — an extension can't read your `.env`, and a 400px
popup is a poor home for a workspace switcher. Use the web UI if you juggle several workspaces.

After every `bun run build`, hit **reload** on the extension card in `chrome://extensions` —
Chrome caches the old files otherwise.

## Where the token is read from

`.env` is found by searching upward from the directory you run in, then falling back to the
project root — so the CLI works from any subdirectory, and from anywhere once installed globally.
A real environment variable always wins over `.env`.

| Surface | Token source | Can it read `.env`? |
|---|---|---|
| CLI | `.env`, or `SLACK_USER_TOKEN` in the environment | **yes** |
| MCP server | `.env`, or `env` in the MCP client's config | **yes** |
| Web UI | pasted on the Workspaces page, kept in `sessionStorage` | **no** |
| Extension | pasted into the popup, kept in `chrome.storage.session` | **no** |

`.env` is gitignored. Don't commit it.

### The `.env` token is for the terminal only

**Nothing reachable from a browser can use the token in `.env`.** The web server does not load
`.env` at all — `SLACK_USER_TOKEN` is not even in its process environment — and
`createSlackClient()` takes the token as a required argument with no environment fallback, so
there is no code path from an HTTP request to the token on disk. A request without a token is
rejected with a 400, never quietly served using someone else's credentials.

So the web UI and the extension each need a token pasted in once. On the **Workspaces** page
(`/settings`) you can save as many as you like, one per Slack workspace, and switch between them
from the converter's dropdown.

If you want the web UI to start with a token already loaded, that's deliberately not possible —
use the CLI, which is the surface `.env` exists for.

### How the token travels

- The server binds to `127.0.0.1` only. Nothing crosses a network boundary; the one outbound call
  is the server's own request to Slack's API.
- The token rides in the request body for a single request. The server builds a one-off Slack
  client from it and discards it — never logged, never written to disk, never held afterwards.
- Browser-side it lives in that tab's `sessionStorage` (gone when the tab closes) or, for the
  extension, `chrome.storage.session` (memory only, gone when the browser restarts). Neither
  touches `localStorage`, disk, or sync storage.
- Every token input is a masked `password` field with a Show/Hide toggle and `autocomplete="off"`.

## Troubleshooting

**"No Slack token found." — CLI or MCP.** There's no `.env`, or it has no `SLACK_USER_TOKEN`.
Run `cp .env.example .env` and paste your token in.

**"No token saved for …" / "No Slack token was sent." — web UI or extension.** These surfaces
don't use `.env` by design. Paste a token on the Workspaces page (`/settings`), or into the
extension popup. Expected even when `.env` is set up and the CLI works fine.

**"Slack rejected that token."** Wrong, expired, or a bot token (`xoxb-`). It must start with
`xoxp-`.

**"That token is missing a scope."** Add all six scopes under **User Token Scopes** and reinstall
the app to your workspace.

**"Could not reach the thread-mark server."** The extension needs `bun run dev` running.

**The extension popup is unstyled and its buttons do nothing.** You loaded `src/extension/`.
Load `dist/extension/` instead.

**The extension can't reach a server that's clearly running.** The port in
`src/extension/manifest.json` must match the server's exactly, including the number. MV3 grants
CORS-free access only to hosts listed in `host_permissions`.

**Port already in use.** `PORT=8080 bun run dev`. It must be a real environment variable — the
web server doesn't read `.env`, so putting `PORT` there has no effect.

## Known limitations

- **No reference resolution.** A thread saying "see ENG-4412" or linking a GitHub PR just gets the
  link — it isn't fetched and inlined.
- **No secret/PII redaction.** Don't point this at threads containing credentials you don't want
  leaving Slack until redaction is built.
- **Single thread at a time.** No bulk export, no channel-wide digest.
- **Emoji shortcode map is small** — 27 common ones. Unmapped emoji stay as `:shortcode:` text,
  which most LLMs read fine.
- **File content isn't fetched**, only linked (`📎 [name](url)`).
- **The preview renderer handles a subset of markdown** — what the formatter emits, plus lists and
  images. It isn't CommonMark.

---

# Developing thread-mark

## Design decisions

These are the constraints the code is built around. Breaking one should be a deliberate choice.

**One converter, four front ends.** `src/convert/` knows nothing about HTTP, the CLI, or the
browser. Every surface calls the same `fetchThread` → `formatThread` pair, so a fix to the
converter fixes all four at once.

**No template-literal HTML.** Markup lives in real `.html` files and styles in a real `.css`
file. Nothing is assembled from strings in TypeScript, where escaping bugs are silent and editors
give no tooling.

**No bundler.** `tsc` plus a copy script. Browser code compiles to plain ESM that the browser and
the extension load directly. Four runtime dependencies, four dev dependencies, no build framework.

**Browser code cannot reach server secrets.** Enforced structurally rather than by convention —
see [the `.env` token is for the terminal only](#the-env-token-is-for-the-terminal-only).

**The extension is assembled, never hand-maintained.** `dist/extension/` is built from
`src/extension/` plus the shared stylesheet and compiled modules. The build follows `popup.js`'s
import graph, so a new module is picked up automatically instead of silently missing.

## Layout

```
.env                    your token (gitignored); copy .env.example to create it
bunfig.toml             Bun config -- NOT bun.toml, which Bun silently ignores
public/                 served as-is by the web server
  index.html            converter + markdown editor
  settings.html         workspace token management
  app.css               one stylesheet for both pages AND the extension popup
src/
  env.ts                loads .env; imported ONLY by cli.ts and mcp/server.ts
  loadEnv.ts            .env parser + upward file search
  cli.ts
  mcp/server.ts         MCP over stdio; one tool, get_slack_thread
  web/server.ts         localhost HTTP: static files + /api/thread (no .env access)
  extension/            MV3 manifest + popup markup only -- NOT loadable as-is
  slack/
    permalink.ts        permalink -> {channel, ts, threadTs}
    client.ts           Slack WebClient; token is a required argument
    fetchThread.ts      conversations.replies (paginated) + users.info
  convert/              pure: no I/O, no DOM, no HTTP
    mrkdwn.ts           Slack mrkdwn -> markdown (the core converter)
    extractText.ts      pulls text out of blocks/attachments for bot messages
    format.ts           assembles the final document
  client/               browser TypeScript -> ESM in dist/client
    markdown.ts         markdown -> HTML preview (shared web + extension)
    htmlToMarkdown.ts   the reverse: pasted rich text -> markdown
    editor.ts           the two-way editor and its direction swap
    clipboard.ts        copy buttons, plain and rich
    tokenStore.ts       sessionStorage-backed workspace tokens
    errors.ts           Slack error codes -> what to do about them
    dom.ts              element lookup + tablist wiring
    converter.ts        entry point for index.html
    settings.ts         entry point for settings.html
    popup.ts            entry point for the extension popup
dist/
  extension/            the complete, loadable extension
scripts/
  build-extension.mjs   assembles dist/extension by walking popup.js's imports
test/                   vitest; fixtures/ holds sample Slack payloads
```

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | web UI on `http://127.0.0.1:4321` |
| `bun run web` | identical to `dev` |
| `bun run cli <permalink>` | the CLI, from source |
| `bun run mcp` | MCP server over stdio, from source |
| `bun run build` | server + browser code + extension |
| `bun run build:server` | `tsc -p tsconfig.json` → `dist/` |
| `bun run build:client` | `tsc -p tsconfig.client.json` → `dist/client/` |
| `bun run build:extension` | assembles `dist/extension/` |
| `bun run typecheck` | all three tsconfigs, no emit |
| `bun run test` | Vitest, single run |
| `bun run test:watch` | Vitest in watch mode |

Bun needs no `--` before script arguments: `bun run cli <permalink>` just works.

## Three TypeScript projects

Each has a different environment, so they get different configs. `bun run typecheck` runs all
three, and every file in the repo belongs to exactly one — a file outside them all gets guessed-at
settings in your editor and produces phantom errors.

| Config | Covers | Environment |
|---|---|---|
| `tsconfig.json` | `src/` except `src/client` | server-side, `@types/node`, NodeNext modules |
| `tsconfig.client.json` | `src/client` | DOM, `"types": []` so server globals stay out |
| `tsconfig.tools.json` | `test/`, `scripts/` | server-side, `checkJs`, `noEmit` |

`"types": []` on the client config is load-bearing: without it `@types/node` leaks in and
`setTimeout` returns a `Timeout` instead of a `number`.

`@types/node` is still the right dev dependency despite the project being Bun-only — Bun
implements Node's APIs, and the server code imports `node:fs`, `node:path`, and `node:http`.
Those are the interfaces Bun provides, not a dependency on the Node runtime.

## The build

```
tsconfig.json         -> dist/           (cli, mcp, web server, converters)
tsconfig.client.json  -> dist/client/    (browser ESM, imported with .js paths)
build-extension.mjs   -> dist/extension/ (popup.html + manifest + app.css + module graph)
```

Browser code is written with explicit `.js` extensions on imports, which is what a browser needs
and what `tsc` emits unchanged. The web server serves `public/` at `/` and `dist/client/` under
`/js/`.

`bun run dev` compiles the client first, so the server never serves stale browser code.

## Testing

```bash
bun run test        # Vitest — the canonical path
bun test            # Bun's own runner: same 86 tests, roughly 3x faster
```

> `bun test` and `bun run test` are **different commands**. `bun run test` executes the
> package.json script (Vitest); a bare `bun test` uses Bun's built-in runner, which picks up the
> same files directly. Both pass all 86 tests here, so use whichever you prefer — but CI should
> pin one, and `bun run test` is what the scripts table documents.

86 tests, no DOM library required:

| Suite | Covers |
|---|---|
| `mrkdwn.test.ts` (16) | styling, mentions, links, emoji, entities, code-block protection |
| `htmlToMarkdown.test.ts` (20) | rich text → markdown: lists, quotes, escaping, unwrapping |
| `markdown.test.ts` (19) | markdown → HTML: escaping, grouping, unsafe URLs, images |
| `loadEnv.test.ts` (12) | `.env` parsing and the upward file search |
| `format.test.ts` (9) | message grouping, system-noise filtering |
| `extractText.test.ts` (6) | bot blocks/attachments, text-vs-rich_text duplication |
| `permalink.test.ts` (4) | permalink parsing |

`htmlToMarkdown` is typed against a structural subset of the DOM rather than `Node`, so it's
tested with plain objects — no jsdom, no new dependency.

## Extending it

**Adding a markdown feature** means touching both directions: `client/markdown.ts` renders it and
`client/htmlToMarkdown.ts` reads it back. A feature added to one and not the other breaks the
editor's round trip — that's how images ended up rendering as a stray `!` before a link.

**Adding a browser module** needs no build change. `build-extension.mjs` walks `popup.js`'s
imports and reports what it copied.

**Adding a Slack API call** goes in `src/slack/`. Keep `src/convert/` free of I/O so it stays
testable with fixtures.

**Changing the port** means three places: the default in `src/web/server.ts`, `SERVER_URL` in
`src/client/popup.ts`, and `host_permissions` in `src/extension/manifest.json`. The last two must
match exactly or the extension's requests are blocked.

**New Slack error codes** go in `client/errors.ts`, which maps them to what the user should do
rather than showing a raw code.

## Next steps

Roughly in order of leverage:

1. **Reference resolution** — detect GitHub PR/issue, Jira/Linear, Google Doc, and nested Slack
   permalink URLs in the thread body and fetch+inline them as an appendix. This is what turns a
   transcript into a self-contained brief.
2. **Redaction pass** — entropy/pattern scan for API keys, tokens, and emails before anything is
   written out or handed to an MCP client.
3. **Native Slack message shortcut** — a real entry in Slack's message menu, via Interactivity and
   a public Request URL. Sidesteps the extension's constraints, at the cost of needing a publicly
   reachable endpoint.
4. **Typed output modes** — `--as bug|prd|timeline` to shape the markdown for a specific
   downstream use rather than a flat transcript.
5. **Cross-surface stitching** — merge a channel thread with a related DM or huddle recap into one
   deduped timeline.

---

## License

[MIT](LICENSE) © Sanket Upreti.

Slack is a trademark of Slack Technologies, Inc. This project is not affiliated with or endorsed
by Slack; it talks to the public Slack Web API using a token you supply.
