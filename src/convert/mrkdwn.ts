export interface MrkdwnContext {
  resolveUser: (id: string) => string;
  resolveChannel?: (id: string) => string | undefined;
}

const EMOJI_MAP: Record<string, string> = {
  '+1': '👍',
  thumbsup: '👍',
  '-1': '👎',
  thumbsdown: '👎',
  tada: '🎉',
  eyes: '👀',
  heart: '❤️',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  x: '❌',
  rocket: '🚀',
  thinking_face: '🤔',
  fire: '🔥',
  '100': '💯',
  warning: '⚠️',
  question: '❓',
  pray: '🙏',
  raised_hands: '🙌',
  joy: '😂',
  laughing: '😆',
  wave: '👋',
  clap: '👏',
  point_up: '☝️',
  bug: '🐛',
  smile: '😄',
  slightly_smiling_face: '🙂',
  sob: '😭',
};

export function emojiFor(shortcode: string): string {
  return EMOJI_MAP[shortcode] ?? `:${shortcode}:`;
}

// Private-use-area character: won't collide with anything a human or Slack would type.
const SENTINEL = String.fromCharCode(0xe000);
const TOKEN_RE = new RegExp(SENTINEL + '(\\d+)' + SENTINEL, 'g');

/**
 * Lifts code spans and fences out of the text so mrkdwn styling can't touch them. Both
 * passes share one counter — separate counters would each emit a token 0 and the first
 * restore would overwrite the other's content.
 */
function protectCode(text: string): { text: string; values: string[] } {
  const values: string[] = [];
  const stash = (match: string) => {
    values.push(unescapeEntities(match));
    return SENTINEL + (values.length - 1) + SENTINEL;
  };

  // Fences first -- an inline-span match must never straddle a fence boundary.
  const out = text.replace(/```[\s\S]*?```/g, stash).replace(/`[^`\n]+`/g, stash);
  return { text: out, values };
}

function restoreCode(text: string, values: string[]): string {
  if (values.length === 0) return text;
  // A function replacement keeps `$` in the restored code literal.
  return text.replace(TOKEN_RE, (_full, index: string) => values[Number(index)]);
}

function unescapeEntities(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Slack sends blockquotes as "&gt; text", so this runs before entity unescaping.
function convertBlockquotes(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const m = line.match(/^(&gt;|>)\s?(.*)$/);
      return m ? `> ${m[2]}` : line;
    })
    .join('\n');
}

function convertAngleTokens(text: string, ctx: MrkdwnContext): string {
  return text.replace(/<([^<>]+)>/g, (_full, inner: string) => {
    if (inner.startsWith('@')) {
      const body = inner.slice(1);
      const [id, label] = body.split('|');
      const name = ctx.resolveUser(id) || label || id;
      return `@${name}`;
    }
    if (inner.startsWith('#')) {
      const body = inner.slice(1);
      const [id, label] = body.split('|');
      const name = label ?? ctx.resolveChannel?.(id) ?? id;
      return `#${name}`;
    }
    if (inner.startsWith('!')) {
      const body = inner.slice(1);
      if (body === 'here') return '@here';
      if (body === 'channel') return '@channel';
      if (body === 'everyone') return '@everyone';
      if (body.startsWith('subteam^')) {
        const [, label] = body.split('|');
        return label ? `@${label.replace(/^@/, '')}` : '@team';
      }
      if (body.startsWith('date^')) {
        const parts = body.split('|');
        return parts[parts.length - 1] || parts[0];
      }
      return `@${body}`;
    }
    // Plain URL, optionally with a |label
    const pipeIdx = inner.indexOf('|');
    if (pipeIdx === -1) return inner;
    const url = inner.slice(0, pipeIdx);
    const label = inner.slice(pipeIdx + 1);
    return `[${label}](${url})`;
  });
}

function convertInlineStyles(text: string): string {
  let out = text;
  out = out.replace(/(^|[\s(])\*(?!\s)([^*\n]+?)(?<!\s)\*(?=[\s).,!?:;]|$)/g, '$1**$2**');
  out = out.replace(/(^|[\s(])_(?!\s)([^_\n]+?)(?<!\s)_(?=[\s).,!?:;]|$)/g, '$1*$2*');
  out = out.replace(/(^|[\s(])~(?!\s)([^~\n]+?)(?<!\s)~(?=[\s).,!?:;]|$)/g, '$1~~$2~~');
  return out;
}

function convertEmojiShortcodes(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/gi, (full, code: string) => {
    const lower = code.toLowerCase();
    const mapped = emojiFor(lower);
    return mapped === `:${lower}:` ? full : mapped;
  });
}

export function mrkdwnToMarkdown(source: string, ctx: MrkdwnContext): string {
  if (!source) return '';

  // Blockquote markers must be read before fence protection or entity unescaping.
  let text = convertBlockquotes(source);

  // Slack applies no styling inside code, so hold it aside while */_/~ are converted.
  const protected_ = protectCode(text);

  text = protected_.text;
  text = convertAngleTokens(text, ctx);
  text = convertInlineStyles(text);
  text = convertEmojiShortcodes(text);
  text = unescapeEntities(text);

  return restoreCode(text, protected_.values);
}
