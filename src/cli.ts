#!/usr/bin/env bun
import './env.js'; // loads .env — must stay first
import { createSlackClient, envToken, REQUIRED_SCOPES } from './slack/client.js';
import { fetchThread } from './slack/fetchThread.js';
import { formatThread } from './convert/format.js';
import { HEADER_PRESETS, isHeaderPreset, type HeaderPreset } from './convert/digest.js';

interface Options {
  permalink?: string;
  outPath?: string;
  copy: boolean;
  header: HeaderPreset;
  help: boolean;
}

/**
 * Parses arguments positionally, letting flags consume their own value.
 *
 * Scanning for "the first argument without a leading dash" is simpler but wrong: in
 * `--write out.md <permalink>` it picks up out.md as the permalink.
 */
function parseArgs(argv: string[]): Options | { error: string } {
  const options: Options = { copy: false, header: 'full', help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '--copy') {
      options.copy = true;
    } else if (arg === '--write') {
      const value = argv[++i];
      if (!value) return { error: '--write needs a file path.' };
      options.outPath = value;
    } else if (arg === '--header') {
      const value = argv[++i];
      if (!isHeaderPreset(value)) {
        return { error: `--header must be one of: ${HEADER_PRESETS.join(', ')}` };
      }
      options.header = value;
    } else if (arg.startsWith('-')) {
      return { error: `Unknown option: ${arg}` };
    } else if (!options.permalink) {
      options.permalink = arg;
    } else {
      return { error: `Unexpected argument: ${arg}` };
    }
  }

  return options;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    printUsage();
    process.exit(1);
  }

  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    console.error(`thread-mark: ${parsed.error}\n`);
    printUsage();
    process.exit(1);
  }

  if (parsed.help) {
    printUsage();
    process.exit(0);
  }

  if (!parsed.permalink) {
    console.error('thread-mark: no Slack permalink given.\n');
    printUsage();
    process.exit(1);
  }

  try {
    const client = createSlackClient(envToken());
    const thread = await fetchThread(client, parsed.permalink);
    const markdown = formatThread(thread, {
      header: parsed.header,
      permalink: parsed.permalink,
    });

    if (parsed.outPath) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(parsed.outPath, markdown, 'utf8');
      console.error(`Wrote ${markdown.length} bytes to ${parsed.outPath}`);
    } else if (parsed.copy) {
      const clipboardy = await import('clipboardy');
      await clipboardy.default.write(markdown);
      console.error('Copied to clipboard.');
    } else {
      process.stdout.write(markdown);
    }
  } catch (err: unknown) {
    console.error(`thread-mark: ${(err as Error).message}`);
    process.exit(1);
  }
}

function printUsage(): void {
  console.error(`thread-mark — turn a Slack thread into clean markdown for LLM context

Usage:
  thread-mark <permalink> [--header <preset>] [--write <path>] [--copy]

Options:
  --header <preset>  How much orientation to put above the transcript:
                       full   counts, participants, links/files/reactions (default)
                       brief  the counts line only
                       none   just the messages
  --write <path>     Write the markdown to a file instead of stdout
  --copy             Copy the markdown to the clipboard instead of stdout
  -h, --help         Show this help

Environment:
  SLACK_USER_TOKEN   Slack user token (xoxp-...) with these scopes:
                     ${REQUIRED_SCOPES.join(', ')}
                     Read from .env automatically — no export needed.

Examples:
  thread-mark https://myteam.slack.com/archives/C0123ABCD/p1753526400123456
  thread-mark https://myteam.slack.com/archives/C0123ABCD/p1753526400123456 --header none
  thread-mark --write context.md https://myteam.slack.com/archives/C0123ABCD/p1753526400123456
`);
}

void main();
