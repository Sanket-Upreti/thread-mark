import type { RawThread } from '../slack/fetchThread.js';
import { emojiFor } from './mrkdwn.js';
import { prepareThread } from './prepare.js';
import { buildDigest, type HeaderPreset } from './digest.js';
import { formatAbsolute, relativeDelta } from './time.js';

// Slack's own threshold for grouping consecutive messages under one name header.
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

export interface FormatOptions {
  /** How much orientation to put above the transcript. Defaults to `full`. */
  header?: HeaderPreset;
  /** Shown in the header as the thread's source, when a header is included. */
  permalink?: string;
}

export function formatThread(thread: RawThread, options: FormatOptions = {}): string {
  const prepared = prepareThread(thread);
  const firstTs = prepared[0].tsMs;
  const lines: string[] = [];

  for (const [i, { message: m, name, tsMs, body }] of prepared.entries()) {
    const prev = i > 0 ? prepared[i - 1] : undefined;
    const isSameGroup =
      prev !== undefined && prev.name === name && tsMs - prev.tsMs < GROUPING_WINDOW_MS;

    if (!isSameGroup) {
      if (i > 0) lines.push('');
      const timeLabel = i === 0 ? formatAbsolute(tsMs) : `+${relativeDelta(tsMs - firstTs)}`;
      lines.push(`**${name}** (${timeLabel}):`);
    }

    lines.push(body);

    if (Array.isArray(m.reactions) && m.reactions.length) {
      lines.push(m.reactions.map((r: any) => `[${emojiFor(r.name)} ×${r.count}]`).join(' '));
    }

    for (const f of m.files ?? []) {
      lines.push(`📎 [${f.name || 'file'}](${f.permalink || f.url_private || ''})`);
    }
  }

  const transcript = lines.join('\n').trim();
  const header = buildDigest(prepared, options.header ?? 'full', options.permalink);

  return header ? `${header}\n\n${transcript}\n` : `${transcript}\n`;
}
