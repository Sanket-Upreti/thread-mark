// Saved Slack tokens, one per workspace. sessionStorage only: cleared when the tab
// closes, never written to disk. The converter page and the workspaces page both read
// and write these keys, so the record shape lives here rather than in either page.

export interface Workspace {
  id: string;
  name: string;
  token: string;
}

const WORKSPACES_KEY = 'thread-mark.workspaces';
const ACTIVE_KEY = 'thread-mark.activeWorkspace';

function read(): Workspace[] {
  try {
    const raw = sessionStorage.getItem(WORKSPACES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is Workspace =>
        typeof w?.id === 'string' && typeof w?.name === 'string' && typeof w?.token === 'string'
    );
  } catch {
    return [];
  }
}

let workspaces = read();
let activeId = sessionStorage.getItem(ACTIVE_KEY) ?? '';

function persist(): void {
  sessionStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  sessionStorage.setItem(ACTIVE_KEY, activeId);
}

function newId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// One empty workspace beats an empty list: the converter always has something to point at.
if (workspaces.length === 0) {
  workspaces = [{ id: newId(), name: 'Slack workspace', token: '' }];
  activeId = workspaces[0].id;
  persist();
} else if (!workspaces.some((w) => w.id === activeId)) {
  activeId = workspaces[0].id;
  persist();
}

export function listWorkspaces(): Workspace[] {
  return workspaces;
}

export function activeWorkspace(): Workspace | undefined {
  return workspaces.find((w) => w.id === activeId);
}

export function activeToken(): string {
  return activeWorkspace()?.token.trim() ?? '';
}

export function setActive(id: string): void {
  activeId = id;
  persist();
}

export function addWorkspace(): Workspace {
  const created: Workspace = { id: newId(), name: 'New workspace', token: '' };
  workspaces.push(created);
  activeId = created.id;
  persist();
  return created;
}

export function updateWorkspace(id: string, patch: Partial<Omit<Workspace, 'id'>>): void {
  const target = workspaces.find((w) => w.id === id);
  if (!target) return;
  Object.assign(target, patch);
  persist();
}

export function removeWorkspace(id: string): void {
  workspaces = workspaces.filter((w) => w.id !== id);
  if (workspaces.length === 0) workspaces = [{ id: newId(), name: 'Slack workspace', token: '' }];
  if (!workspaces.some((w) => w.id === activeId)) activeId = workspaces[0].id;
  persist();
}
