import type { RawThread } from '../slack/fetchThread.js';
import { extractText } from './extractText.js';

// Auto-generated system events -- never substantive thread content, always noise.
const NOISE_SUBTYPES = new Set([
  'channel_join',
  'channel_leave',
  'group_join',
  'group_leave',
  'channel_topic',
  'channel_purpose',
  'channel_name',
  'channel_archive',
  'channel_unarchive',
  'pinned_item',
  'unpinned_item',
]);

export interface DecoratedMessage {
  message: any;
  name: string;
  tsMs: number;
  /** The converted markdown body, produced once and shared. */
  body: string;
}

/**
 * Sorts, filters and converts a thread once, so the transcript and the digest header
 * describe exactly the same set of messages. Deriving either separately lets them drift --
 * a header counting messages the transcript then filters out is worse than no header.
 */
export function prepareThread(thread: RawThread): DecoratedMessage[] {
  const { messages, users } = thread;
  const ctx = { resolveUser: (id: string) => users.get(id) ?? id };

  const decorate = (m: any): DecoratedMessage => ({
    message: m,
    name: m.user
      ? ctx.resolveUser(m.user)
      : m.username
        ? `${m.username} (bot)`
        : m.bot_id
          ? 'Bot'
          : 'Unknown',
    tsMs: parseFloat(m.ts) * 1000,
    body: extractText(m, ctx),
  });

  const all = messages.map(decorate).sort((a, b) => a.tsMs - b.tsMs);
  const substantive = all.filter(({ message }) => !NOISE_SUBTYPES.has(message.subtype));

  // A thread of nothing but system events still renders them -- an empty document is
  // less useful than the join notice the link actually pointed at.
  return substantive.length > 0 ? substantive : all;
}
