import type { RawThread } from '../slack/fetchThread.js';
import { emojiFor } from './mrkdwn.js';
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

// Slack's own threshold for grouping consecutive messages under one name header.
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

export function formatThread(thread: RawThread): string {
  const { messages, users } = thread;
  const resolveUser = (id: string) => users.get(id) ?? id;
  const ctx = { resolveUser };

  // Resolve name and timestamp once, so the grouping check below doesn't re-derive them.
  const decorate = (m: any) => ({
    message: m,
    name: m.user
      ? resolveUser(m.user)
      : m.username
        ? `${m.username} (bot)`
        : m.bot_id
          ? 'Bot'
          : 'Unknown',
    tsMs: parseFloat(m.ts) * 1000,
  });

  const all = messages.map(decorate).sort((a, b) => a.tsMs - b.tsMs);
  const substantive = all.filter(({ message }) => !NOISE_SUBTYPES.has(message.subtype));
  // A thread of nothing but system events still renders them -- an empty document is
  // less useful than the join notice the link actually pointed at.
  const decorated = substantive.length > 0 ? substantive : all;

  const firstTs = decorated[0].tsMs;
  const lines: string[] = [];

  for (const [i, { message: m, name, tsMs }] of decorated.entries()) {
    const prev = i > 0 ? decorated[i - 1] : undefined;
    const isSameGroup =
      prev !== undefined && prev.name === name && tsMs - prev.tsMs < GROUPING_WINDOW_MS;

    if (!isSameGroup) {
      if (i > 0) lines.push('');
      const timeLabel = i === 0 ? formatAbsolute(tsMs) : `+${relativeDelta(tsMs - firstTs)}`;
      lines.push(`**${name}** (${timeLabel}):`);
    }

    lines.push(extractText(m, ctx));

    if (Array.isArray(m.reactions) && m.reactions.length) {
      lines.push(m.reactions.map((r: any) => `[${emojiFor(r.name)} ×${r.count}]`).join(' '));
    }

    for (const f of m.files ?? []) {
      lines.push(`📎 [${f.name || 'file'}](${f.permalink || f.url_private || ''})`);
    }
  }

  return lines.join('\n').trim() + '\n';
}

function formatAbsolute(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function relativeDelta(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '<1m';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);

  // Always non-empty: totalMinutes >= 1 here, so at least one component was pushed.
  return parts.join(' ');
}
