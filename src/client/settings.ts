import {
  addWorkspace,
  listWorkspaces,
  removeWorkspace,
  updateWorkspace,
  type Workspace,
} from './tokenStore.js';
import { el } from './dom.js';

const list = el<HTMLElement>('list');
const addBtn = el<HTMLButtonElement>('add');
const status = el<HTMLParagraphElement>('status');

function announce(text: string): void {
  status.textContent = text;
  setTimeout(() => (status.textContent = ''), 2500);
}

function buildRow(workspace: Workspace): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ws-row';

  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'control ws-name';
  name.value = workspace.name;
  name.placeholder = 'Workspace name';
  name.setAttribute('aria-label', 'Workspace name');
  name.addEventListener('input', () => updateWorkspace(workspace.id, { name: name.value }));

  const token = document.createElement('input');
  token.type = 'password';
  token.className = 'control ws-token';
  token.value = workspace.token;
  token.placeholder = 'xoxp-…';
  token.autocomplete = 'off';
  token.spellcheck = false;
  token.setAttribute('aria-label', 'Slack token');
  token.addEventListener('input', () => updateWorkspace(workspace.id, { token: token.value }));

  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'btn btn-quiet btn-icon';
  reveal.textContent = 'Show';
  reveal.setAttribute('aria-label', 'Show token');
  reveal.addEventListener('click', () => {
    const hidden = token.type === 'password';
    token.type = hidden ? 'text' : 'password';
    reveal.textContent = hidden ? 'Hide' : 'Show';
    reveal.setAttribute('aria-label', hidden ? 'Hide token' : 'Show token');
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-quiet btn-icon';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => {
    removeWorkspace(workspace.id);
    render();
    announce(`Removed ${workspace.name || 'the workspace'}.`);
  });

  row.append(name, token, reveal, remove);
  return row;
}

function render(): void {
  list.replaceChildren(...listWorkspaces().map(buildRow));
}

render();

addBtn.addEventListener('click', () => {
  const created = addWorkspace();
  render();
  list.querySelector<HTMLInputElement>('.ws-row:last-child .ws-name')?.select();
  announce(`Added ${created.name}.`);
});
