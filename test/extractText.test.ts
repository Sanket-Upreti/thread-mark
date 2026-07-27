import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractText } from '../src/convert/extractText.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'));
}

const ctx = {
  resolveUser: (id: string) => ({ U111: 'Alice', U222: 'Bob' })[id] ?? id,
};

describe('extractText', () => {
  it('pulls real content out of a bot message whose text is just a summary', () => {
    const message = loadFixture('github-bot-message.json');
    const text = extractText(message, ctx);

    expect(text).toContain('Fix null pointer in checkout flow');
    expect(text).toContain('This fixes a crash when the cart is empty.');
    expect(text).toContain('Fixes ENG-4412.');
    expect(text).toContain('**Reviewers**: bob, carol');
  });

  it('extracts rich_text blocks including bold, links, and user mentions', () => {
    const message = loadFixture('rich-text-message.json');
    const text = extractText(message, ctx);

    expect(text).toContain('**this now**');
    expect(text).toContain('[the doc](https://example.com/doc)');
    expect(text).toContain('@Bob');
  });

  it('does not duplicate content when a message has both text and a matching rich_text block', () => {
    // Ordinary Slack messages mirror the same content into `text` and a `rich_text` block --
    // including both roughly doubles output for every normal message in a thread.
    const message = loadFixture('rich-text-message.json');
    const text = extractText(message, ctx);

    expect(text).not.toContain('Fallback plain text version');
  });

  it('skips Slack auto-unfurl previews of pasted internal permalinks', () => {
    // Pasting a Slack permalink into a message auto-attaches a preview of the target
    // message. That preview isn't something the sender wrote here -- it's link-preview
    // chrome for a message that's either already in this thread or elsewhere entirely.
    const message = loadFixture('message-unfurl-attachment.json');
    const text = extractText(message, ctx);

    expect(text).toBe('trying to add a link');
    expect(text).not.toContain('Tets thread like to check if it works');
  });

  it('falls back to a placeholder when a message has no text at all', () => {
    expect(extractText({}, ctx)).toBe('*[no text content]*');
  });

  it('extracts plain message text through the mrkdwn converter', () => {
    const message = { text: '*hello* <@U111>' };
    expect(extractText(message, ctx)).toBe('**hello** @Alice');
  });
});
