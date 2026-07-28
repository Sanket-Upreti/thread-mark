// Renders the markdown subset thread-mark emits: bold/italic/strike, inline and fenced
// code, links, blockquotes, lists, headings, rules. Not a general-purpose parser.

// Private-use character: cannot collide with anything Slack or a human types.
const CODE_MARK = '\uE000';
const CODE_TOKEN = new RegExp(CODE_MARK + '(\\d+)' + CODE_MARK, 'g');

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Allow-list, so a link like `javascript:...` renders as text instead of running.
//
// `\/(?!\/)` matches a single leading slash but not two: `//evil.test/x` is a
// protocol-relative URL to an arbitrary host, not the same-origin path this permits.
function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url.trim());
}

// Images additionally allow data: URIs, which is what pasting an image produces --
// but raster types only.
//
// `image/svg+xml` is deliberately excluded. An SVG carried in a data: URI can contain
// script, and it is inert in an <img> only because browsers disable scripting there. That
// is their guarantee to withdraw, not ours to depend on, and nothing pastes as an SVG
// data URI anyway.
const SAFE_IMAGE_DATA = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon)[;,]/i;

function isSafeImageUrl(url: string): boolean {
  return isSafeUrl(url) || SAFE_IMAGE_DATA.test(url.trim());
}

// Runs on already-escaped text. Code spans are pulled out first so styling markers
// inside them survive.
function inline(escaped: string): string {
  const codes: string[] = [];
  let out = escaped.replace(/`([^`]+)`/g, (_match, body: string) => {
    codes.push(body);
    return CODE_MARK + (codes.length - 1) + CODE_MARK;
  });

  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Images before links -- otherwise the link rule matches and leaves a stray "!".
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt: string, url: string) =>
      isSafeImageUrl(url) ? `<img src="${url}" alt="${alt}" loading="lazy">` : match
    )
    .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (match, label: string, url: string) =>
      isSafeUrl(url)
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : match
    );

  return out.replace(CODE_TOKEN, (_match, index: string) => `<code>${codes[Number(index)]}</code>`);
}

export function renderMarkdown(markdown: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  let items: string[] = [];
  let ordered = false;
  let fence: string[] | null = null;

  // Paragraph lines join with <br>: a Slack message's own line breaks carry meaning.
  const flush = () => {
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
    if (quote.length) out.push(`<blockquote>${quote.join('<br>')}</blockquote>`);
    if (items.length) {
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`);
    }
    para = [];
    quote = [];
    items = [];
  };

  for (const line of markdown.split('\n')) {
    // Structural markers are read before escaping — escaping turns ">" into "&gt;".
    if (line.trim().startsWith('```')) {
      if (fence === null) {
        flush();
        fence = [];
      } else {
        out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const blockquote = line.match(/^>\s?(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);

    if (line.trim() === '') {
      flush();
    } else if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
    } else if (line.trim() === '---') {
      flush();
      out.push('<hr>');
    } else if (blockquote) {
      if (para.length || items.length) flush();
      quote.push(inline(escapeHtml(blockquote[1])));
    } else if (bullet || numbered) {
      const isOrdered = Boolean(numbered);
      if (para.length || quote.length || (items.length && ordered !== isOrdered)) flush();
      ordered = isOrdered;
      items.push(inline(escapeHtml((bullet ?? numbered)![1])));
    } else {
      if (quote.length || items.length) flush();
      para.push(inline(escapeHtml(line)));
    }
  }

  if (fence !== null) out.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
  flush();

  return out.join('');
}
