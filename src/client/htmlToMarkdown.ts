// The inverse of markdown.ts: walks rendered content and emits markdown. Used when the
// editor runs backwards, so pasted rich text (from Slack, a browser, a doc) becomes
// markdown.
//
// Typed against a structural subset of the DOM rather than `Node` so it can be tested
// without a DOM implementation. Real nodes satisfy it.

export interface HtmlNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<HtmlNode>;
  getAttribute?(name: string): string | null;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

// Escaped so pasted prose can't accidentally become markup. `_` is left alone: escaping it
// would mangle snake_case, and intra-word underscores don't start emphasis anyway.
function escapeText(text: string): string {
  return text.replace(/([\\`*[\]])/g, '\\$1');
}

function childrenOf(node: HtmlNode): HtmlNode[] {
  return Array.prototype.slice.call(node.childNodes) as HtmlNode[];
}

function attr(node: HtmlNode, name: string): string {
  return node.getAttribute?.(name) ?? '';
}

function renderChildren(node: HtmlNode): string {
  return childrenOf(node).map(render).join('');
}

/**
 * Trims and collapses blank runs. Nested blocks each pad themselves with a blank line, so
 * a container has to normalise before wrapping its body — otherwise a blockquote holding
 * two paragraphs ends up with three empty quoted lines between them.
 */
function tidy(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Wraps inline content, keeping the markers tight against the text. */
function wrap(marker: string, content: string): string {
  const inner = content.trim();
  return inner ? marker + inner + marker : '';
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line ? prefix + line : prefix.trimEnd()))
    .join('\n');
}

function renderList(node: HtmlNode, ordered: boolean): string {
  const items = childrenOf(node).filter(
    (child) => child.nodeType === ELEMENT_NODE && child.nodeName.toUpperCase() === 'LI'
  );

  const lines = items.map((item, index) => {
    const marker = ordered ? `${index + 1}.` : '-';
    // Continuation lines indent under the marker so nested content stays in the item.
    const body = tidy(renderChildren(item)).replace(/\n/g, '\n  ');
    return `${marker} ${body}`;
  });

  return lines.length ? `\n\n${lines.join('\n')}\n\n` : '';
}

function render(node: HtmlNode): string {
  // HTML collapses runs of whitespace; <pre> and <code> bypass this by reading textContent.
  if (node.nodeType === TEXT_NODE) {
    return escapeText((node.textContent ?? '').replace(/\s+/g, ' '));
  }

  if (node.nodeType !== ELEMENT_NODE) return '';

  const tag = node.nodeName.toUpperCase();

  switch (tag) {
    case 'SCRIPT':
    case 'STYLE':
    case 'NOSCRIPT':
      return '';

    case 'BR':
      return '\n';

    case 'HR':
      return '\n\n---\n\n';

    case 'STRONG':
    case 'B':
      return wrap('**', renderChildren(node));

    case 'EM':
    case 'I':
      return wrap('*', renderChildren(node));

    case 'DEL':
    case 'S':
    case 'STRIKE':
      return wrap('~~', renderChildren(node));

    case 'CODE':
      return wrap('`', node.textContent ?? '');

    case 'PRE':
      return `\n\n\`\`\`\n${(node.textContent ?? '').replace(/\n+$/, '')}\n\`\`\`\n\n`;

    case 'A': {
      const label = renderChildren(node).trim();
      const href = attr(node, 'href');
      if (!label) return '';
      return href ? `[${label}](${href})` : label;
    }

    case 'IMG': {
      const src = attr(node, 'src');
      return src ? `![${attr(node, 'alt')}](${src})` : '';
    }

    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const body = tidy(renderChildren(node));
      return body ? `\n\n${'#'.repeat(Number(tag[1]))} ${body}\n\n` : '';
    }

    case 'BLOCKQUOTE': {
      const body = tidy(renderChildren(node));
      return body ? `\n\n${prefixLines(body, '> ')}\n\n` : '';
    }

    case 'UL':
      return renderList(node, false);

    case 'OL':
      return renderList(node, true);

    case 'P':
    case 'DIV':
    case 'SECTION':
    case 'ARTICLE':
    case 'TR': {
      const body = tidy(renderChildren(node));
      return body ? `\n\n${body}\n\n` : '';
    }

    default:
      // Unknown wrappers (span, font, table cells, a stray li, …) contribute contents only.
      return renderChildren(node);
  }
}

/** Converts a rendered subtree to markdown. */
export function htmlToMarkdown(root: HtmlNode): string {
  return renderChildren(root)
    .replace(/\n{3,}/g, '\n\n') // at most one blank line between blocks
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}
