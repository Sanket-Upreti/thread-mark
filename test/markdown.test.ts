import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/client/markdown.js';

describe('renderMarkdown', () => {
  it('escapes HTML in message text', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
    );
  });

  it('keeps a message’s own line breaks inside one paragraph', () => {
    expect(renderMarkdown('**Ana** (+3m):\nshipped it')).toBe(
      '<p><strong>Ana</strong> (+3m):<br>shipped it</p>'
    );
  });

  it('starts a new paragraph at a blank line', () => {
    expect(renderMarkdown('one\n\ntwo')).toBe('<p>one</p><p>two</p>');
  });

  it('merges consecutive blockquote lines', () => {
    expect(renderMarkdown('> a\n> b')).toBe('<blockquote>a<br>b</blockquote>');
  });

  it('groups bullets into one list', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('splits when the list type changes', () => {
    expect(renderMarkdown('- a\n1. b')).toBe('<ul><li>a</li></ul><ol><li>b</li></ol>');
  });

  it('leaves styling markers alone inside code spans', () => {
    expect(renderMarkdown('use `a *b* c` here')).toBe('<p>use <code>a *b* c</code> here</p>');
  });

  it('escapes fenced code and does not style it', () => {
    expect(renderMarkdown('```\nif (a < b) **x**\n```')).toBe(
      '<pre><code>if (a &lt; b) **x**</code></pre>'
    );
  });

  it('closes an unterminated fence', () => {
    expect(renderMarkdown('```\nstill code')).toBe('<pre><code>still code</code></pre>');
  });

  it('renders bold, italic, and strikethrough', () => {
    expect(renderMarkdown('**b** *i* ~~s~~')).toBe(
      '<p><strong>b</strong> <em>i</em> <del>s</del></p>'
    );
  });

  it('links http URLs', () => {
    expect(renderMarkdown('[docs](https://example.com)')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a></p>'
    );
  });

  it('renders a javascript: link as plain text', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>');
  });

  it('renders headings and rules', () => {
    expect(renderMarkdown('## Title\n---')).toBe('<h2>Title</h2><hr>');
  });

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('renders an image', () => {
    expect(renderMarkdown('![a chart](https://ex.com/c.png)')).toBe(
      '<p><img src="https://ex.com/c.png" alt="a chart" loading="lazy"></p>'
    );
  });

  it('does not leave a stray ! before an image', () => {
    expect(renderMarkdown('![x](https://ex.com/i.png)')).not.toContain('!<');
  });

  it('allows data: image URIs, which pasting produces', () => {
    expect(renderMarkdown('![p](data:image/png;base64,iVBOR)')).toContain('<img src="data:image/png;base64,iVBOR"');
  });

  it('rejects a non-image data: URI', () => {
    expect(renderMarkdown('![x](data:text/html;base64,PHNjcmlwdD4=)')).toBe(
      '<p>![x](data:text/html;base64,PHNjcmlwdD4=)</p>'
    );
  });

  it('still renders a link that follows an image', () => {
    const out = renderMarkdown('![i](https://ex.com/i.png) and [docs](https://ex.com)');
    expect(out).toContain('<img src="https://ex.com/i.png"');
    expect(out).toContain('<a href="https://ex.com"');
  });
});
