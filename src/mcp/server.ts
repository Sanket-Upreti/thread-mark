#!/usr/bin/env bun
import '../env.js'; // loads .env — must stay first
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createSlackClient, envToken } from '../slack/client.js';
import { fetchThread } from '../slack/fetchThread.js';
import { formatThread } from '../convert/format.js';

const server = new McpServer({ name: 'thread-mark', version: '0.3.0' });

server.registerTool(
  'get_slack_thread',
  {
    title: 'Get Slack thread as markdown',
    description:
      'Fetch a Slack thread from a permalink and return it as clean, LLM-ready markdown: ' +
      'usernames resolved, mrkdwn converted to markdown, bot/app messages unpacked from their ' +
      'blocks/attachments, reactions and file links preserved, timestamps shown relative to the ' +
      'first message. Use this whenever the user pastes a Slack link (archives/... or a message ' +
      'permalink) and wants its content understood or acted on.',
    inputSchema: {
      permalink: z
        .string()
        .describe(
          'A Slack message or thread permalink, e.g. ' +
            'https://yourteam.slack.com/archives/C0123ABCD/p1234567890123456'
        ),
      header: z
        .enum(['none', 'brief', 'full'])
        .optional()
        .describe(
          'How much orientation to put above the transcript: "full" (default) adds message ' +
            'and participant counts, duration, link/file counts and the most-reacted message; ' +
            '"brief" adds only the counts line; "none" returns just the messages.'
        ),
    },
  },
  async ({ permalink, header }) => {
    try {
      const client = createSlackClient(envToken());
      const thread = await fetchThread(client, permalink);
      const markdown = formatThread(thread, { header, permalink });
      return { content: [{ type: 'text', text: markdown }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error fetching thread: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
