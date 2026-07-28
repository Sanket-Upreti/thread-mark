import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/client/markdown.js';

// Thread content is attacker-controllable: anyone in a Slack workspace can post a message,
// and the result is assigned to innerHTML in the preview panes. These lock that boundary.
//
// Assertions inspect the emitted *tags*, not the text. Escaped output still contains the
// substring "onerror=" -- inert, because `<` became `&lt;` -- so matching raw text reports
// false alarms.

const DANGEROUS_TAG = /^<\s*(script|iframe|object|embed|link|meta|style|base|form|svg|math)\b/i;
const EVENT_ATTR = /\s+on[a-z]+\s*=/i;
const BAD_URL_ATTR = /\b(href|src|xlink:href)\s*=\s*["']?\s*(javascript|vbscript|data:text\/html)/i;

function tagsIn(html: string): string[] {
  return html.match(/<[a-zA-Z][^>]*>/g) ?? [];
}

function expectInert(markdown: string): void {
  for (const tag of tagsIn(renderMarkdown(markdown))) {
    expect(tag).not.toMatch(DANGEROUS_TAG);
    expect(tag).not.toMatch(BAD_URL_ATTR);
    // An event handler must never appear as an attribute of a real tag.
    expect(tag.replace(/"[^"]*"/g, '""')).not.toMatch(EVENT_ATTR);
  }
}

describe('renderMarkdown is inert against hostile thread content', () => {
  const payloads: Record<string, string> = {
    'raw script tag': '<script>alert(1)</script>',
    'img with onerror': '<img src=x onerror=alert(1)>',
    'svg with onload': '<svg onload=alert(1)>',
    'iframe with srcdoc': '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    'style tag': '<style>body{background:url(javascript:alert(1))}</style>',
    'base tag': '<base href="https://evil.test/">',
    'javascript: link': '[x](javascript:alert(1))',
    'mixed-case javascript: link': '[x](JaVaScRiPt:alert(1))',
    'vbscript: link': '[x](vbscript:msgbox(1))',
    'data:text/html link': '[x](data:text/html,<script>alert(1)</script>)',
    'javascript: image': '![x](javascript:alert(1))',
    'data:text/html image': '![x](data:text/html;base64,PHNjcmlwdD4=)',
    'svg data-URI image': '![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
    'quote breakout in href': '[x](#" onmouseover="alert(1))',
    'quote breakout in alt': '![" onerror="alert(1)](https://a.test/i.png)',
    'html inside a code span': '`<img src=x onerror=alert(1)>`',
    'html inside a fenced block': '```\n<script>alert(1)</script>\n```',
    'html inside a blockquote': '> <script>alert(1)</script>',
    'html inside a heading': '# <img src=x onerror=alert(1)>',
    'html inside a list item': '- <img src=x onerror=alert(1)>',
    'html wrapped in bold': '**<script>alert(1)</script>**',
    'entity-encoded scheme': '[x](&#106;avascript:alert(1))',
  };

  for (const [name, payload] of Object.entries(payloads)) {
    it(`neutralises ${name}`, () => expectInert(payload));
  }
});

describe('URL allow-listing', () => {
  it('renders an unsafe scheme as literal text, not a link', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>');
  });

  it('rejects protocol-relative URLs, which point at another host', () => {
    expect(renderMarkdown('[x](//evil.test/p)')).toBe('<p>[x](//evil.test/p)</p>');
  });

  it('still allows a same-origin absolute path', () => {
    expect(renderMarkdown('[x](/settings)')).toContain('<a href="/settings"');
  });

  it('rejects an svg data URI even though <img> would not run it', () => {
    const out = renderMarkdown('![x](data:image/svg+xml;base64,PHN2Zz4=)');
    expect(out).not.toContain('<img');
  });

  it('still allows a pasted raster data URI', () => {
    expect(renderMarkdown('![x](data:image/png;base64,iVBOR)')).toContain('<img src="data:image/png');
  });

  it('keeps rel="noopener noreferrer" on every external link', () => {
    expect(renderMarkdown('[x](https://a.test)')).toContain('rel="noopener noreferrer"');
  });
});
