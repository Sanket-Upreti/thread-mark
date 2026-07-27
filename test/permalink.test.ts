import { describe, expect, it } from 'vitest';
import { parsePermalink } from '../src/slack/permalink.js';

describe('parsePermalink', () => {
  it('parses a plain message permalink into channel + ts', () => {
    const result = parsePermalink('https://myteam.slack.com/archives/C0123ABCD/p1753526400123456');
    expect(result).toEqual({ channel: 'C0123ABCD', ts: '1753526400.123456', threadTs: undefined });
  });

  it('extracts thread_ts from a reply-level permalink', () => {
    const result = parsePermalink(
      'https://myteam.slack.com/archives/C0123ABCD/p1753526412000100?thread_ts=1753526400.123456&cid=C0123ABCD'
    );
    expect(result).toEqual({
      channel: 'C0123ABCD',
      ts: '1753526412.000100',
      threadTs: '1753526400.123456',
    });
  });

  it('throws a helpful error for a non-Slack URL', () => {
    expect(() => parsePermalink('https://example.com/not-slack')).toThrow(
      /Not a recognizable Slack permalink/
    );
  });

  it('throws for a malformed URL', () => {
    expect(() => parsePermalink('not a url')).toThrow(/Not a valid URL/);
  });
});
