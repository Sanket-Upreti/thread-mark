// Copy buttons with their own "copied" feedback. Inline SVG rather than an icon font, so
// the extension stays self-contained and the glyph inherits the theme via currentColor.

const ICON_COPY =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>' +
  '<path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1"/></svg>';

const ICON_DONE =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
  '<path d="M3 8.5l3.5 3.5L13 5"/></svg>';

export interface CopyPayload {
  text: string;
  /** Supplied when the source is rendered content, so it pastes with formatting intact. */
  html?: string;
}

async function write(payload: CopyPayload): Promise<void> {
  // Rich copy needs ClipboardItem; fall back to plain text where it isn't available.
  if (payload.html && typeof ClipboardItem === 'function') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([payload.html], { type: 'text/html' }),
          'text/plain': new Blob([payload.text], { type: 'text/plain' }),
        }),
      ]);
      return;
    } catch {
      // Some browsers reject the rich write; plain text is better than nothing.
    }
  }
  await navigator.clipboard.writeText(payload.text);
}

/** Wires a button to copy whatever `getPayload` returns, with a brief confirmation. */
export function wireCopy(
  button: HTMLButtonElement,
  label: string,
  getPayload: () => CopyPayload
): void {
  const reset = () => {
    button.innerHTML = ICON_COPY;
    button.classList.remove('is-copied');
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  let timer: number | undefined;

  button.addEventListener('click', async () => {
    const payload = getPayload();
    if (!payload.text.trim()) return;

    try {
      await write(payload);
      button.innerHTML = ICON_DONE;
      button.classList.add('is-copied');
      button.setAttribute('aria-label', 'Copied');
      button.title = 'Copied';
    } catch {
      button.setAttribute('aria-label', 'Copy failed');
      button.title = 'Copy failed';
    }

    clearTimeout(timer);
    timer = setTimeout(reset, 1400);
  });

  reset();
}
