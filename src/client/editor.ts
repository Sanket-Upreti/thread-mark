import { renderMarkdown } from './markdown.js';
import { htmlToMarkdown } from './htmlToMarkdown.js';
import { wireCopy } from './clipboard.js';

// A two-way editor: markdown on one side, rendered content on the other, with a button
// between them that reverses which one you edit. Shared by the web page and the popup.

export interface EditorParts {
  markdown: HTMLTextAreaElement;
  rich: HTMLElement;
  swap: HTMLButtonElement;
  markdownLabel: HTMLElement;
  richLabel: HTMLElement;
  copyMarkdown: HTMLButtonElement;
  copyRich: HTMLButtonElement;
}

const LABELS = {
  toRich: { markdown: 'You type', rich: 'Renders as' },
  toMarkdown: { markdown: 'Markdown out', rich: 'You paste' },
};

export function wireEditor(parts: EditorParts): void {
  const { markdown, rich, swap, markdownLabel, richLabel, copyMarkdown, copyRich } = parts;
  let toRich = true; // markdown -> rendered, the default direction
  let timer: number | undefined;

  // Each pane copies itself, so there is a copy button on the output whichever way the
  // arrow points. The rendered side copies as rich text too, so it keeps its formatting
  // when pasted into a doc or a Slack message.
  wireCopy(copyMarkdown, 'Copy markdown', () => ({ text: markdown.value }));
  wireCopy(copyRich, 'Copy formatted text', () => ({
    text: rich.textContent ?? '',
    html: rich.innerHTML,
  }));

  function apply(): void {
    const labels = toRich ? LABELS.toRich : LABELS.toMarkdown;
    markdownLabel.textContent = labels.markdown;
    richLabel.textContent = labels.rich;

    markdown.readOnly = !toRich;
    rich.contentEditable = String(!toRich);

    // The arrow points the way content flows, so the current direction is readable at a glance.
    swap.textContent = toRich ? '→' : '←';
    swap.setAttribute(
      'aria-label',
      toRich
        ? 'Switch direction: turn pasted rich text into markdown'
        : 'Switch direction: render markdown as a preview'
    );
    swap.title = swap.getAttribute('aria-label') ?? '';

    markdown.classList.toggle('is-derived', !toRich);
    rich.classList.toggle('is-derived', toRich);
  }

  function debounce(run: () => void): void {
    clearTimeout(timer);
    timer = setTimeout(run, 100);
  }

  markdown.addEventListener('input', () => {
    if (!toRich) return;
    debounce(() => {
      rich.innerHTML = renderMarkdown(markdown.value);
    });
  });

  rich.addEventListener('input', () => {
    if (toRich) return;
    debounce(() => {
      markdown.value = htmlToMarkdown(rich);
    });
  });

  // Both panes are kept in sync as you type, so swapping only changes which one is
  // editable — it never re-derives, which would round-trip and lose formatting.
  swap.addEventListener('click', () => {
    toRich = !toRich;
    apply();
    (toRich ? markdown : rich).focus();
  });

  apply();
}
