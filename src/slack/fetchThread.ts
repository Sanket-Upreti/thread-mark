import type { WebClient } from '@slack/web-api';
import { parsePermalink } from './permalink.js';

export interface RawThread {
  messages: any[];
  users: Map<string, string>;
}

const MENTION_RE = /<@([A-Z0-9]+)/g;

export async function fetchThread(client: WebClient, permalink: string): Promise<RawThread> {
  const { channel, ts, threadTs } = parsePermalink(permalink);
  const messages = await fetchAllReplies(client, channel, threadTs ?? ts);

  if (messages.length === 0) {
    throw new Error(
      'No messages found for that link. The token\'s user must be a member of this ' +
        'conversation, and the link must point at a real message or thread.'
    );
  }

  const users = await resolveUsers(client, collectUserIds(messages));
  return { messages, users };
}

async function fetchAllReplies(client: WebClient, channel: string, ts: string): Promise<any[]> {
  const messages: any[] = [];
  let cursor: string | undefined;

  do {
    const resp: any = await client.conversations.replies({
      channel,
      ts,
      limit: 200,
      cursor,
      inclusive: true,
    });
    messages.push(...(resp.messages ?? []));
    cursor = resp.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return messages;
}

function collectUserIds(messages: any[]): Set<string> {
  const ids = new Set<string>();

  for (const m of messages) {
    if (m.user) ids.add(m.user);
    for (const r of m.reactions ?? []) {
      for (const u of r.users ?? []) ids.add(u);
    }
  }

  // Mentions hide in text, attachments, and nested blocks. One scan of the serialized
  // thread beats walking every shape; the Set dedupes against the ids already added.
  for (const [, id] of JSON.stringify(messages).matchAll(MENTION_RE)) ids.add(id);

  return ids;
}

async function resolveUsers(client: WebClient, ids: Set<string>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const resp: any = await client.users.info({ user: id });
        const profile = resp.user;
        map.set(
          id,
          profile?.profile?.display_name || profile?.real_name || profile?.name || id
        );
      } catch {
        map.set(id, id);
      }
    })
  );
  return map;
}
