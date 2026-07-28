import { describe, expect, it } from 'vitest';
import { formatThread } from '../src/convert/format.js';
import type { RawThread } from '../src/slack/fetchThread.js';

const users = new Map([
  ['U111', 'Alice'],
  ['U222', 'Bob'],
]);

function thread(messages: any[]): RawThread {
  return { messages, users };
}

describe('formatThread', () => {
  // Replaces an earlier guarantee of "no header at all". The header is now opt-out rather
  // than absent, so the guarantee moves to `header: 'none'` -- which must still produce
  // exactly the bare transcript that guarantee described.
  it('emits only the messages when the header is turned off', () => {
    const md = formatThread(
      thread([
        { ts: '1753526400.000000', user: 'U111', text: 'hello' },
        { ts: '1753526460.000000', user: 'U222', text: 'hi back' },
      ]),
      { header: 'none' }
    );

    expect(md).not.toContain('Participants:');
    expect(md).not.toContain('message · ');
    expect(md).not.toContain('---');
    expect(md.startsWith('**Alice**')).toBe(true);
  });

  it('puts the header above the transcript by default', () => {
    const md = formatThread(
      thread([
        { ts: '1753526400.000000', user: 'U111', text: 'hello' },
        { ts: '1753526460.000000', user: 'U222', text: 'hi back' },
      ])
    );

    expect(md.startsWith('2 messages · 2 people')).toBe(true);
    expect(md).toContain('Participants: Alice (1), Bob (1)');
    // Header and transcript separated by one blank line, transcript otherwise unchanged.
    expect(md).toContain('\n\n**Alice** (');
    // A horizontal rule here would render as a divider and sever the two visually.
    expect(md).not.toContain('---');
  });

  it('shows an absolute timestamp for the first message', () => {
    const md = formatThread(thread([{ ts: '1753526400.000000', user: 'U111', text: 'first' }]));
    expect(md).toMatch(/\*\*Alice\*\* \(2025-\d{2}-\d{2} \d{2}:\d{2} UTC\):/);
  });

  it('formats a relative delta of several minutes', () => {
    const md = formatThread(
      thread([
        { ts: '1753526400.000000', user: 'U111', text: 'first' },
        { ts: '1753526580.000000', user: 'U222', text: 'later' }, // +180s
      ])
    );
    expect(md).toContain('**Bob** (+3m):');
  });

  it('includes reactions inline', () => {
    const md = formatThread(
      thread([
        {
          ts: '1753526400.000000',
          user: 'U111',
          text: 'ship it',
          reactions: [{ name: '+1', count: 3 }],
        },
      ])
    );
    expect(md).toContain('[👍 ×3]');
  });

  it('labels bot messages without a user id by username', () => {
    const md = formatThread(
      thread([{ ts: '1753526400.000000', username: 'GitHub', bot_id: 'B1', text: 'opened a PR' }])
    );
    expect(md).toContain('**GitHub (bot)**');
  });

  it('sorts out-of-order messages by timestamp', () => {
    const md = formatThread(
      thread([
        { ts: '1753526460.000000', user: 'U222', text: 'second' },
        { ts: '1753526400.000000', user: 'U111', text: 'first' },
      ])
    );
    const firstIdx = md.indexOf('first');
    const secondIdx = md.indexOf('second');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('groups consecutive messages from the same author under one header', () => {
    const md = formatThread(
      thread([
        { ts: '1753526400.000000', user: 'U111', text: 'first' },
        { ts: '1753526410.000000', user: 'U111', text: 'second' },
        { ts: '1753526420.000000', user: 'U111', text: 'third' },
      ])
    );
    expect(md.match(/\*\*Alice\*\*/g)).toHaveLength(1);
    expect(md).toContain('first');
    expect(md).toContain('second');
    expect(md).toContain('third');
  });

  it('starts a new group once the same author returns after a gap of 5+ minutes', () => {
    const md = formatThread(
      thread([
        { ts: '1753526400.000000', user: 'U111', text: 'first' },
        { ts: '1753527000.000000', user: 'U111', text: 'ten minutes later' }, // +10m
      ])
    );
    expect(md.match(/\*\*Alice\*\*/g)).toHaveLength(2);
  });

  it('drops channel_join/leave and similar system-event messages', () => {
    const md = formatThread(
      thread([
        { ts: '1753526400.000000', user: 'U111', text: 'hello', subtype: undefined },
        { ts: '1753526410.000000', user: 'U222', subtype: 'channel_join', text: '<@U222> has joined the channel' },
        { ts: '1753526420.000000', user: 'U111', text: 'anyone there?' },
      ])
    );
    expect(md).not.toContain('has joined the channel');
    expect(md).toContain('hello');
    expect(md).toContain('anyone there?');
  });
});
