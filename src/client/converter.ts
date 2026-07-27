import { renderMarkdown } from './markdown.js';
import { activeToken, activeWorkspace, listWorkspaces, setActive } from './tokenStore.js';
import { explainError } from './errors.js';
import { el, wireTabs } from './dom.js';
import { wireEditor } from './editor.js';

const workspaceSelect = el<HTMLSelectElement>('workspace');
const form = el<HTMLFormElement>('convert-form');
const permalink = el<HTMLInputElement>('permalink');
const convertBtn = el<HTMLButtonElement>('convert');
const status = el<HTMLParagraphElement>('status');
const result = el<HTMLElement>('result');
const raw = el<HTMLPreElement>('raw');
const preview = el<HTMLElement>('preview');
const copyBtn = el<HTMLButtonElement>('copy');
const downloadBtn = el<HTMLButtonElement>('download');
const editor = el<HTMLTextAreaElement>('editor');
const editorPreview = el<HTMLElement>('editor-preview');

let markdown = '';

// --- Modes -----------------------------------------------------------------

wireTabs([
  { tab: el<HTMLButtonElement>('mode-slack'), panel: el<HTMLElement>('panel-slack') },
  { tab: el<HTMLButtonElement>('mode-editor'), panel: el<HTMLElement>('panel-editor') },
]);

// --- Workspace picker ------------------------------------------------------
// Every token comes from this browser tab. The server has no fallback of its own — the
// token in .env is for the CLI and MCP server only.

function renderWorkspaceOptions(): void {
  workspaceSelect.replaceChildren();

  for (const workspace of listWorkspaces()) {
    const option = document.createElement('option');
    option.value = workspace.id;
    option.textContent = workspace.name || 'Unnamed workspace';
    workspaceSelect.append(option);
  }

  workspaceSelect.value = activeWorkspace()?.id ?? '';
}

workspaceSelect.addEventListener('change', () => setActive(workspaceSelect.value));

renderWorkspaceOptions();

// --- Convert ---------------------------------------------------------------

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle('is-error', isError);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const link = permalink.value.trim();
  if (!link) {
    setStatus('Paste a Slack message or thread link first.', true);
    return;
  }

  const token = activeToken();
  if (!token) {
    const name = activeWorkspace()?.name || 'this workspace';
    status.classList.add('is-error');
    status.innerHTML = '';
    status.append(`No token saved for ${name}. `);
    const settingsLink = document.createElement('a');
    settingsLink.href = '/settings';
    settingsLink.textContent = 'Add one on the Workspaces page.';
    status.append(settingsLink);
    return;
  }

  convertBtn.disabled = true;
  result.hidden = true;
  setStatus('Fetching the thread from Slack…');

  try {
    const response = await fetch('/api/thread', {
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
    setStatus(`Converted ${markdown.length.toLocaleString()} characters.`);
  } catch (error) {
    setStatus(explainError((error as Error).message), true);
  } finally {
    convertBtn.disabled = false;
  }
});

// --- Result actions --------------------------------------------------------

wireTabs([
  { tab: el<HTMLButtonElement>('tab-raw'), panel: raw },
  { tab: el<HTMLButtonElement>('tab-preview'), panel: preview },
]);

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(markdown);
  copyBtn.textContent = 'Copied';
  setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
});

downloadBtn.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'thread.md';
  anchor.click();
  URL.revokeObjectURL(url);
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
