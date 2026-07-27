import { describe, expect, it } from 'vitest';
import { mrkdwnToMarkdown } from '../src/convert/mrkdwn.js';

const ctx = {
  resolveUser: (id: string) => ({ U111: 'Alice', U222: 'Bob' })[id] ?? id,
  resolveChannel: (id: string) => ({ C999: 'general' })[id] ?? undefined,
};

describe('mrkdwnToMarkdown', () => {
  it('converts bold, italic, and strikethrough', () => {
    expect(mrkdwnToMarkdown('*bold* and _italic_ and ~gone~', ctx)).toBe(
      '**bold** and *italic* and ~~gone~~'
    );
  });

  it('does not mangle standalone asterisks/underscores used as punctuation', () => {
    expect(mrkdwnToMarkdown('use snake_case_names please', ctx)).toBe(
      'use snake_case_names please'
    );
  });

  it('resolves user mentions', () => {
    expect(mrkdwnToMarkdown('hey <@U111>, ping <@U222|bob>', ctx)).toBe('hey @Alice, ping @Bob');
  });

  it('falls back to the raw id when a user cannot be resolved', () => {
    const noResolve = { resolveUser: (id: string) => id };
    expect(mrkdwnToMarkdown('hey <@U999>', noResolve)).toBe('hey @U999');
  });

  it('resolves channel mentions', () => {
    expect(mrkdwnToMarkdown('see <#C999|general>', ctx)).toBe('see #general');
    expect(mrkdwnToMarkdown('see <#C999>', ctx)).toBe('see #general');
  });

  it('handles special mentions', () => {
    expect(mrkdwnToMarkdown('<!here> check this out', ctx)).toBe('@here check this out');
    expect(mrkdwnToMarkdown('<!channel>', ctx)).toBe('@channel');
    expect(mrkdwnToMarkdown('<!subteam^S123|@sre-team> please look', ctx)).toBe(
      '@sre-team please look'
    );
  });

  it('converts labeled and bare links', () => {
    expect(mrkdwnToMarkdown('see <https://example.com|the docs>', ctx)).toBe(
      'see [the docs](https://example.com)'
    );
    expect(mrkdwnToMarkdown('see <https://example.com>', ctx)).toBe('see https://example.com');
  });

  it('unescapes HTML entities', () => {
    expect(mrkdwnToMarkdown('if a &lt; b &amp;&amp; b &gt; c', ctx)).toBe(
      'if a < b && b > c'
    );
  });

  it('converts blockquotes', () => {
    expect(mrkdwnToMarkdown('&gt; quoted line\nnormal line', ctx)).toBe(
      '> quoted line\nnormal line'
    );
  });

  it('converts known emoji shortcodes and leaves unknown ones as-is', () => {
    expect(mrkdwnToMarkdown('nice :+1: :tada:', ctx)).toBe('nice 👍 🎉');
    expect(mrkdwnToMarkdown('weird :not_a_real_emoji:', ctx)).toBe('weird :not_a_real_emoji:');
  });

  it('protects fenced code blocks from mrkdwn/entity processing', () => {
    const input = '```\nif (a &lt; b) { *not_bold* }\n```';
    expect(mrkdwnToMarkdown(input, ctx)).toBe('```\nif (a < b) { *not_bold* }\n```');
  });

  it('protects inline code spans from mrkdwn processing', () => {
    expect(mrkdwnToMarkdown('run `*not_bold*` please', ctx)).toBe('run `*not_bold*` please');
  });

  it('keeps a fenced block and an inline span distinct in the same message', () => {
    // Regression: fenced and inline protection used separate counters, so both emitted a
    // token numbered 0 and the first restore overwrote the other -- the fenced block was
    // replaced by the inline span's text.
    const input = '```\nfenced\n``` and `inline`';
    expect(mrkdwnToMarkdown(input, ctx)).toBe('```\nfenced\n``` and `inline`');
  });

  it('restores code containing $ patterns literally', () => {
    expect(mrkdwnToMarkdown('run `echo $&$1` now', ctx)).toBe('run `echo $&$1` now');
  });

  it('resolves mentions that appear inside otherwise-styled text', () => {
    expect(mrkdwnToMarkdown('*please review* <@U111>', ctx)).toBe('**please review** @Alice');
  });

  it('handles a realistic multi-feature message', () => {
    const input =
      '*Heads up* <@U111> — deploy failed, see <https://ci.example.com/123|the build log>.\n' +
      '&gt; error: connection &lt;refused&gt;\n' +
      'cc <!channel> :fire:';
    const expected =
      '**Heads up** @Alice — deploy failed, see [the build log](https://ci.example.com/123).\n' +
      '> error: connection <refused>\n' +
      'cc @channel 🔥';
    expect(mrkdwnToMarkdown(input, ctx)).toBe(expected);
  });
});
