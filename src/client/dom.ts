// Small helpers shared by the three browser entry points.

export function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

export interface TabPair {
  tab: HTMLButtonElement;
  panel: HTMLElement;
}

/** Wires a tablist: clicking a tab selects it and shows its panel, hiding the rest. */
export function wireTabs(pairs: TabPair[]): void {
  const select = (chosen: TabPair) => {
    for (const pair of pairs) {
      const isChosen = pair === chosen;
      pair.tab.setAttribute('aria-selected', String(isChosen));
      pair.panel.hidden = !isChosen;
    }
  };

  for (const pair of pairs) {
    pair.tab.addEventListener('click', () => select(pair));
  }
}
