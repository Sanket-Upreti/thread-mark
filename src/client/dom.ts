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

/**
 * Wires a tablist: clicking a tab selects it and shows its panel, hiding the rest.
 * `onSelect` runs for the chosen pair, including once on wiring for the initial tab,
 * so callers can style the page around whichever panel is showing.
 */
export function wireTabs(pairs: TabPair[], onSelect?: (chosen: TabPair) => void): void {
  const select = (chosen: TabPair) => {
    for (const pair of pairs) {
      const isChosen = pair === chosen;
      pair.tab.setAttribute('aria-selected', String(isChosen));
      pair.panel.hidden = !isChosen;
    }
    onSelect?.(chosen);
  };

  for (const pair of pairs) {
    pair.tab.addEventListener('click', () => select(pair));
  }

  const initial = pairs.find((pair) => pair.tab.getAttribute('aria-selected') === 'true');
  if (initial) onSelect?.(initial);
}
