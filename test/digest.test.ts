import { describe, expect, it } from 'vitest';
import { buildDigest, isHeaderPreset } from '../src/convert/digest.js';
import { prepareThread } from '../src/convert/prepare.js';
import type { RawThread } from '../src/slack/fetchThread.js';

const users = new Map([
  ['U111', 'Alice'],
  ['U222', 'Bob'],
  ['U333', 'Chen'],
]);

const thread = (messages: any[]): RawThread => ({ messages, users });

/** Seconds after a fixed origin, so timings in the expectations are readable. */
const at = (seconds: number) => String(1753526400 + seconds) + '.000000';

const digest = (messages: any[], preset: 'none' | 'brief' | 'full' = 'full', permalink?: string) =>
  buildDigest(prepareThread(thread(messages)), preset, permalink);

describe('buildDigest', () => {
  it('returns nothing for the none preset', () => {
    expect(digest([{ ts: at(0), user: 'U111', text: 'hi' }], 'none')).toBe('');
  });

  it('returns only the counts line for brief', () => {
    const out = digest(
      [
        { ts: at(0), user: 'U111', text: 'hi' },
        { ts: at(60), user: 'U222', text: 'hello' },
      ],
      'brief'
    );
    expect(out).toBe('2 messages · 2 people · 1m');
  });

  it('counts messages, people and duration', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a' },
      { ts: at(3600), user: 'U222', text: 'b' },
      { ts: at(8280), user: 'U111', text: 'c' },
    ]);
    expect(out.split('\n')[0]).toBe('3 messages · 2 people · 2h 18m');
  });

  it('uses singular wording for a one-message thread', () => {
    expect(digest([{ ts: at(0), user: 'U111', text: 'a' }]).split('\n')[0]).toBe(
      '1 message · 1 person'
    );
  });

  it('omits a duration under a minute rather than printing "<1m"', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a' },
      { ts: at(5), user: 'U222', text: 'b' },
    ]);
    expect(out.split('\n')[0]).toBe('2 messages · 2 people');
  });

  it('ranks participants by message count, then name', () => {
    const out = digest([
      { ts: at(0), user: 'U222', text: 'a' },
      { ts: at(1), user: 'U111', text: 'b' },
      { ts: at(2), user: 'U111', text: 'c' },
      { ts: at(3), user: 'U333', text: 'd' },
    ]);
    expect(out).toContain('Participants: Alice (2), Bob (1), Chen (1)');
  });

  it('labels bots the same way the transcript does', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a' },
      { ts: at(1), username: 'GitHub', bot_id: 'B1', subtype: 'bot_message', text: 'build ok' },
    ]);
    expect(out).toContain('GitHub (bot) (1)');
  });

  it('counts distinct links only', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'see <https://a.test|A> and <https://b.test|B>' },
      { ts: at(1), user: 'U222', text: 'again <https://a.test|A>' },
    ]);
    expect(out).toContain('Links: 2');
  });

  it('ignores bracket-paren syntax inside fenced code', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: '```\n[not](https://nope.test)\n```' },
      { ts: at(1), user: 'U222', text: 'real <https://yes.test|Y>' },
    ]);
    expect(out).toContain('Links: 1');
  });

  it('counts files across the thread', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a', files: [{ name: 'x.png' }, { name: 'y.png' }] },
      { ts: at(1), user: 'U222', text: 'b', files: [{ name: 'z.png' }] },
    ]);
    expect(out).toContain('Files: 3');
  });

  it('reports the most-reacted message with its top emoji', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a', reactions: [{ name: 'eyes', count: 1 }] },
      {
        ts: at(3840),
        user: 'U222',
        text: 'b',
        reactions: [
          { name: '+1', count: 6 },
          { name: 'tada', count: 1 },
        ],
      },
    ]);
    expect(out).toContain('Most-reacted: Bob at +1h 4m (👍 ×6)');
  });

  it('names the first message rather than showing +<1m', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a', reactions: [{ name: '+1', count: 3 }] },
      { ts: at(60), user: 'U222', text: 'b' },
    ]);
    expect(out).toContain('Most-reacted: Alice at the first message (👍 ×3)');
  });

  it('breaks a most-reacted tie towards the earlier message', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a', reactions: [{ name: '+1', count: 2 }] },
      { ts: at(600), user: 'U222', text: 'b', reactions: [{ name: '+1', count: 2 }] },
    ]);
    expect(out).toContain('Most-reacted: Alice');
  });

  it('omits the whole content line when there is nothing in it', () => {
    const out = digest([
      { ts: at(0), user: 'U111', text: 'a' },
      { ts: at(60), user: 'U222', text: 'b' },
    ]);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).not.toContain('Links:');
    expect(out).not.toContain('Files:');
  });

  it('caps the participant list and reports the remainder', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      ts: at(i),
      username: `Bot${i}`,
      bot_id: `B${i}`,
      subtype: 'bot_message',
      text: 'x',
    }));
    const out = digest(many);
    expect(out).toContain('+3 more');
  });

  it('includes the permalink as the source when one is given', () => {
    const out = digest([{ ts: at(0), user: 'U111', text: 'a' }], 'full', 'https://x.slack.com/p1');
    expect(out).toContain('Source: https://x.slack.com/p1');
  });

  it('omits the source line when no permalink is given', () => {
    expect(digest([{ ts: at(0), user: 'U111', text: 'a' }])).not.toContain('Source:');
  });

  it('describes only the messages the transcript keeps', () => {
    // The join notice is filtered out of the transcript, so it must not be counted here.
    const out = digest([
      { ts: at(0), user: 'U333', subtype: 'channel_join', text: 'Chen joined' },
      { ts: at(1), user: 'U111', text: 'a' },
      { ts: at(2), user: 'U222', text: 'b' },
    ]);
    expect(out.split('\n')[0]).toBe('2 messages · 2 people');
    expect(out).not.toContain('Chen');
  });
});

describe('isHeaderPreset', () => {
  it('accepts the three presets', () => {
    expect(['none', 'brief', 'full'].every(isHeaderPreset)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isHeaderPreset('verbose')).toBe(false);
    expect(isHeaderPreset(undefined)).toBe(false);
  });
});
