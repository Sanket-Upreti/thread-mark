import type { DecoratedMessage } from './prepare.js';
import { emojiFor } from './mrkdwn.js';
import { relativeDelta } from './time.js';

// A few lines of orientation before the transcript: how big the thread is, who is in it,
// and what it points at. Derived entirely from data already fetched -- no model, no extra
// API call, and identical output for identical input.

export type HeaderPreset = 'none' | 'brief' | 'full';

export const HEADER_PRESETS: HeaderPreset[] = ['none', 'brief', 'full'];

export function isHeaderPreset(value: unknown): value is HeaderPreset {
  return typeof value === 'string' && (HEADER_PRESETS as string[]).includes(value);
}

// Beyond this the participant line turns into a paragraph, which defeats the point.
const MAX_NAMED_PARTICIPANTS = 8;

// Below a minute a duration says nothing a reader can use.
const MIN_REPORTABLE_SPAN_MS = 60_000;

const FENCED_CODE = /```[\s\S]*?```/g;
const MARKDOWN_LINK = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

function participantCounts(prepared: DecoratedMessage[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const { name } of prepared) counts.set(name, (counts.get(name) ?? 0) + 1);

  // Name breaks ties so the same thread always yields the same line.
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Distinct http(s) URLs across the thread. A link repeated twice is one referenced thing. */
function uniqueLinkCount(prepared: DecoratedMessage[]): number {
  const urls = new Set<string>();

  for (const { body } of prepared) {
    // Code samples routinely contain bracket-paren syntax that isn't a link.
    for (const match of body.replace(FENCED_CODE, '').matchAll(MARKDOWN_LINK)) {
      urls.add(match[1]);
    }
  }

  return urls.size;
}

function fileCount(prepared: DecoratedMessage[]): number {
  return prepared.reduce((total, { message }) => total + (message.files?.length ?? 0), 0);
}

interface TopReaction {
  name: string;
  tsMs: number;
  emoji: string;
  count: number;
}

/** The most-reacted message. Ties go to the earliest, since `prepared` is time-sorted. */
function topReaction(prepared: DecoratedMessage[]): TopReaction | undefined {
  let best: TopReaction | undefined;
  let bestTotal = 0;

  for (const { message, name, tsMs } of prepared) {
    const reactions = message.reactions;
    if (!Array.isArray(reactions) || reactions.length === 0) continue;

    const total = reactions.reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);
    if (total <= bestTotal) continue;

    const top = reactions.reduce((a: any, b: any) => ((b.count ?? 0) > (a.count ?? 0) ? b : a));
    bestTotal = total;
    best = { name, tsMs, emoji: emojiFor(top.name), count: top.count ?? 0 };
  }

  return best;
}

function countsLine(prepared: DecoratedMessage[]): string {
  const messages = prepared.length;
  const people = new Set(prepared.map((d) => d.name)).size;
  const span = prepared[prepared.length - 1].tsMs - prepared[0].tsMs;

  const parts = [
    `${messages} message${messages === 1 ? '' : 's'}`,
    `${people} ${people === 1 ? 'person' : 'people'}`,
  ];
  if (span >= MIN_REPORTABLE_SPAN_MS) parts.push(relativeDelta(span));

  return parts.join(' · ');
}

function participantsLine(prepared: DecoratedMessage[]): string {
  const counts = participantCounts(prepared);
  const named = counts.slice(0, MAX_NAMED_PARTICIPANTS);
  const rest = counts.length - named.length;

  const list = named.map(([name, count]) => `${name} (${count})`).join(', ');
  return `Participants: ${list}${rest > 0 ? `, +${rest} more` : ''}`;
}

/** Links, files and the top reaction — whichever of them the thread actually has. */
function contentLine(prepared: DecoratedMessage[], firstTs: number): string {
  const segments: string[] = [];

  const links = uniqueLinkCount(prepared);
  if (links > 0) segments.push(`Links: ${links}`);

  const files = fileCount(prepared);
  if (files > 0) segments.push(`Files: ${files}`);

  const top = topReaction(prepared);
  if (top) {
    const at = top.tsMs === firstTs ? 'the first message' : `+${relativeDelta(top.tsMs - firstTs)}`;
    segments.push(`Most-reacted: ${top.name} at ${at} (${top.emoji} ×${top.count})`);
  }

  return segments.join(' · ');
}

/**
 * Builds the header for a preset. Returns an empty string when there is nothing to say,
 * so callers can prepend unconditionally.
 */
export function buildDigest(
  prepared: DecoratedMessage[],
  preset: HeaderPreset,
  permalink?: string
): string {
  if (preset === 'none' || prepared.length === 0) return '';

  const lines = [countsLine(prepared)];

  if (preset === 'full') {
    lines.push(participantsLine(prepared));

    const content = contentLine(prepared, prepared[0].tsMs);
    if (content) lines.push(content);

    // The permalink is what the reader was given; it beats a channel name, which would
    // cost an extra API call and four scopes every existing install would have to re-grant.
    if (permalink) lines.push(`Source: ${permalink}`);
  }

  return lines.join('\n');
}
