import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, type HtmlNode } from '../src/client/htmlToMarkdown.js';

// Minimal stand-ins for DOM nodes -- the converter is typed structurally so it can be
// tested without a DOM implementation.
function text(value: string): HtmlNode {
  return { nodeType: 3, nodeName: '#text', textContent: value, childNodes: [] };
}

function el(tag: string, children: HtmlNode[] = [], attrs: Record<string, string> = {}): HtmlNode {
  return {
    nodeType: 1,
    nodeName: tag,
    childNodes: children,
    get textContent(): string {
      return children.map((c) => c.textContent ?? '').join('');
    },
    getAttribute: (name: string) => attrs[name] ?? null,
  };
}

const root = (...children: HtmlNode[]): HtmlNode => el('BODY', children);

describe('htmlToMarkdown', () => {
  it('converts a paragraph', () => {
    expect(htmlToMarkdown(root(el('P', [text('hello there')])))).toBe('hello there');
  });

  it('collapses runs of whitespace like HTML does', () => {
    expect(htmlToMarkdown(root(el('P', [text('a   b\n  c')])))).toBe('a b c');
  });

  it('separates blocks with one blank line', () => {
    const doc = root(el('P', [text('one')]), el('P', [text('two')]));
    expect(htmlToMarkdown(doc)).toBe('one\n\ntwo');
  });

  it('converts bold, italic, and strikethrough', () => {
    const doc = root(
      el('P', [el('STRONG', [text('b')]), text(' '), el('EM', [text('i')]), text(' '), el('DEL', [text('s')])])
    );
    expect(htmlToMarkdown(doc)).toBe('**b** *i* ~~s~~');
  });

  it('converts headings by level', () => {
    expect(htmlToMarkdown(root(el('H2', [text('Title')])))).toBe('## Title');
  });

  it('converts links', () => {
    const doc = root(el('P', [el('A', [text('docs')], { href: 'https://example.com' })]));
    expect(htmlToMarkdown(doc)).toBe('[docs](https://example.com)');
  });

  it('keeps link text when there is no href', () => {
    expect(htmlToMarkdown(root(el('A', [text('bare')])))).toBe('bare');
  });

  it('converts unordered lists', () => {
    const doc = root(el('UL', [el('LI', [text('a')]), el('LI', [text('b')])]));
    expect(htmlToMarkdown(doc)).toBe('- a\n- b');
  });

  it('numbers ordered lists', () => {
    const doc = root(el('OL', [el('LI', [text('a')]), el('LI', [text('b')])]));
    expect(htmlToMarkdown(doc)).toBe('1. a\n2. b');
  });

  it('prefixes every line of a blockquote', () => {
    const doc = root(el('BLOCKQUOTE', [el('P', [text('one')]), el('P', [text('two')])]));
    expect(htmlToMarkdown(doc)).toBe('> one\n>\n> two');
  });

  it('fences preformatted blocks', () => {
    const doc = root(el('PRE', [el('CODE', [text('if (a < b) {}')])]));
    expect(htmlToMarkdown(doc)).toBe('```\nif (a < b) {}\n```');
  });

  it('makes standalone code a span', () => {
    const doc = root(el('P', [text('run '), el('CODE', [text('npm test')])]));
    expect(htmlToMarkdown(doc)).toBe('run `npm test`');
  });

  it('escapes markdown characters in plain text', () => {
    expect(htmlToMarkdown(root(el('P', [text('a * b [c]')])))).toBe('a \\* b \\[c\\]');
  });

  it('leaves underscores alone so snake_case survives', () => {
    expect(htmlToMarkdown(root(el('P', [text('some_name here')])))).toBe('some_name here');
  });

  it('drops script and style content', () => {
    const doc = root(el('SCRIPT', [text('alert(1)')]), el('P', [text('kept')]));
    expect(htmlToMarkdown(doc)).toBe('kept');
  });

  it('unwraps unknown elements', () => {
    const doc = root(el('SPAN', [el('FONT', [text('still here')])]));
    expect(htmlToMarkdown(doc)).toBe('still here');
  });

  it('turns br into a line break', () => {
    const doc = root(el('P', [text('one'), el('BR'), text('two')]));
    expect(htmlToMarkdown(doc)).toBe('one\ntwo');
  });

  it('converts a horizontal rule', () => {
    expect(htmlToMarkdown(root(el('P', [text('a')]), el('HR'), el('P', [text('b')])))).toBe(
      'a\n\n---\n\nb'
    );
  });

  it('converts images with alt text', () => {
    const doc = root(el('IMG', [], { src: 'x.png', alt: 'a chart' }));
    expect(htmlToMarkdown(doc)).toBe('![a chart](x.png)');
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToMarkdown(root())).toBe('');
  });
});
