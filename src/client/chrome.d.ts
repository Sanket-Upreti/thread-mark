// The slice of the extension API the popup uses. Avoids a dependency on @types/chrome.
declare const chrome: {
  storage: {
    session: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};
