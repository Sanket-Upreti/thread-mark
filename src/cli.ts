#!/usr/bin/env bun
import './env.js'; // loads .env — must stay first
import { createSlackClient, envToken, REQUIRED_SCOPES } from './slack/client.js';
import { fetchThread } from './slack/fetchThread.js';
import { formatThread } from './convert/format.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const permalink = args.find((a) => !a.startsWith('-'));
  if (!permalink) {
    console.error('No Slack permalink given.\n');
    printUsage();
    process.exit(1);
  }

  const writeIndex = args.indexOf('--write');
  const outPath = writeIndex !== -1 ? args[writeIndex + 1] : undefined;
  const copy = args.includes('--copy');

  try {
    const client = createSlackClient(envToken());
    const thread = await fetchThread(client, permalink);
    const markdown = formatThread(thread);

    if (outPath) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outPath, markdown, 'utf8');
      console.error(`Wrote ${markdown.length} bytes to ${outPath}`);
    } else if (copy) {
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
  thread-mark <permalink> [--write <path>] [--copy]

Options:
  --write <path>   Write the markdown to a file instead of stdout
  --copy           Copy the markdown to the clipboard instead of stdout
  -h, --help       Show this help

Environment:
  SLACK_USER_TOKEN   Slack user token (xoxp-...) with these scopes:
                     ${REQUIRED_SCOPES.join(', ')}

Examples:
  thread-mark https://myteam.slack.com/archives/C0123ABCD/p1753526400123456
  thread-mark https://myteam.slack.com/archives/C0123ABCD/p1753526400123456 --write context.md
  thread-mark https://myteam.slack.com/archives/C0123ABCD/p1753526400123456 --copy
`);
}

void main();
