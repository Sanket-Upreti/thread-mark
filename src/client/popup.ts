import { renderMarkdown } from './markdown.js';
import { explainError } from './errors.js';
import { el, wireTabs } from './dom.js';
import { wireEditor } from './editor.js';

// Must match host_permissions in manifest.json exactly, port included — MV3 grants the
// popup CORS-free access only to hosts listed there.
const SERVER_URL = 'http://127.0.0.1:4321';

const tokenInput = el<HTMLInputElement>('token');
const tokenReveal = el<HTMLButtonElement>('token-reveal');
const permalink = el<HTMLInputElement>('permalink');
const convertBtn = el<HTMLButtonElement>('convert');
const status = el<HTMLParagraphElement>('status');
const result = el<HTMLElement>('result');
const raw = el<HTMLPreElement>('raw');
const preview = el<HTMLElement>('preview');
const editor = el<HTMLTextAreaElement>('editor');
const editorPreview = el<HTMLElement>('editor-preview');

let markdown = '';

wireTabs([
  { tab: el<HTMLButtonElement>('mode-convert'), panel: el<HTMLElement>('panel-convert') },
  { tab: el<HTMLButtonElement>('mode-editor'), panel: el<HTMLElement>('panel-editor') },
]);

wireTabs([
  { tab: el<HTMLButtonElement>('tab-raw'), panel: raw },
  { tab: el<HTMLButtonElement>('tab-preview'), panel: preview },
]);

// --- Token -----------------------------------------------------------------
// chrome.storage.session is memory-only: cleared on browser restart, never on disk.

void chrome.storage.session.get('token').then(({ token }) => {
  if (typeof token === 'string') tokenInput.value = token;
});

tokenInput.addEventListener('input', () => {
  void chrome.storage.session.set({ token: tokenInput.value });
});

tokenReveal.addEventListener('click', () => {
  const hidden = tokenInput.type === 'password';
  tokenInput.type = hidden ? 'text' : 'password';
  tokenReveal.textContent = hidden ? 'Hide' : 'Show';
  tokenReveal.setAttribute('aria-label', hidden ? 'Hide token' : 'Show token');
});

// --- Convert ---------------------------------------------------------------

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle('is-error', isError);
}

convertBtn.addEventListener('click', async () => {
  const link = permalink.value.trim();
  if (!link) {
    setStatus('Paste a Slack message or thread link first.', true);
    return;
  }

  const token = tokenInput.value.trim();
  if (!token) {
    setStatus('Paste a Slack user token above first.', true);
    tokenInput.focus();
    return;
  }

  convertBtn.disabled = true;
  result.hidden = true;
  setStatus('Fetching the thread from Slack…');

  try {
    const response = await fetch(`${SERVER_URL}/api/thread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permalink: link, token }),
    });
    const data = (await response.json()) as { markdown?: string; error?: string };
    if (!response.ok) throw new Error(data.error ?? 'The request failed.');

    markdown = data.markdown ?? '';
    raw.textContent = markdown;
    preview.innerHTML = renderMarkdown(markdown);
    result.hidden = false;
    result.classList.add('reveal');

    await navigator.clipboard.writeText(markdown);
    setStatus(`Copied ${markdown.length.toLocaleString()} characters to the clipboard.`);
  } catch (error) {
    setStatus(explainError((error as Error).message), true);
  } finally {
    convertBtn.disabled = false;
  }
});

permalink.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') convertBtn.click();
});

// --- Editor ----------------------------------------------------------------

wireEditor({
  markdown: editor,
  rich: editorPreview,
  swap: el<HTMLButtonElement>('swap'),
  markdownLabel: el<HTMLElement>('editor-label'),
  richLabel: el<HTMLElement>('rich-label'),
  copyMarkdown: el<HTMLButtonElement>('copy-markdown'),
  copyRich: el<HTMLButtonElement>('copy-rich'),
});
