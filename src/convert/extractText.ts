import { mrkdwnToMarkdown } from './mrkdwn.js';

export interface ExtractCtx {
  resolveUser: (id: string) => string;
}

/**
 * Bot messages keep their real content in `blocks` or `attachments` and leave `text` as a
 * short fallback. Human messages mirror the same content into `text` and a `rich_text`
 * block, so including both would double every message.
 */
export function extractText(message: any, ctx: ExtractCtx): string {
  const blocks: any[] = Array.isArray(message.blocks) ? message.blocks : [];
  const hasRichText = blocks.some((b) => b?.type === 'rich_text');
  const blockText = blocks.length ? extractBlocks(blocks, ctx).trim() : '';
  const attachments = extractAttachments(message, ctx);

  // rich_text mirrors `text`, so it replaces it and leads. Other Block-Kit blocks
  // supplement a short `text` summary, so they trail the attachments they describe.
  const parts = hasRichText && blockText
    ? [blockText, ...attachments]
    : [message.text ? mrkdwnToMarkdown(message.text, ctx) : '', ...attachments, blockText];

  const combined = parts.filter(Boolean).join('\n\n').trim();
  return combined || '*[no text content]*';
}

function extractAttachments(message: any, ctx: ExtractCtx): string[] {
  if (!Array.isArray(message.attachments)) return [];
  const parts: string[] = [];

  for (const att of message.attachments) {
    // Slack auto-unfurls permalinks pasted inline (to its own messages) by attaching a
    // preview of the target message -- that's link-preview chrome duplicating content
    // that's either already visible via the link itself or is a whole separate message
    // elsewhere, not something the sender actually wrote here. Skip it.
    if (att.is_msg_unfurl || att.is_share || Array.isArray(att.message_blocks)) continue;

    const pieces = [att.pretext, att.title, att.text].filter(Boolean);
    if (pieces.length) {
      parts.push(pieces.map((p: string) => mrkdwnToMarkdown(p, ctx)).join('\n'));
    } else if (att.fallback) {
      parts.push(mrkdwnToMarkdown(att.fallback, ctx));
    }

    for (const field of att.fields ?? []) {
      if (field?.title || field?.value) {
        parts.push(`**${field.title ?? ''}**: ${field.value ?? ''}`.trim());
      }
    }
  }

  return parts;
}

function extractBlocks(blocks: any[], ctx: ExtractCtx): string {
  return blocks
    .map((b) => extractBlock(b, ctx))
    .filter(Boolean)
    .join('\n');
}

function extractBlock(block: any, ctx: ExtractCtx): string {
  switch (block.type) {
    case 'section': {
      const parts: string[] = [];
      if (block.text?.text) parts.push(block.text.text);
      if (Array.isArray(block.fields)) {
        for (const f of block.fields) if (f?.text) parts.push(f.text);
      }
      return parts.join('\n');
    }
    case 'header':
      return block.text?.text ? `### ${block.text.text}` : '';
    case 'context':
      return Array.isArray(block.elements)
        ? block.elements
            .map((e: any) => e.text)
            .filter(Boolean)
            .join(' · ')
        : '';
    case 'rich_text':
      return Array.isArray(block.elements)
        ? block.elements.map((el: any) => extractRichTextElement(el, ctx)).join('\n')
        : '';
    case 'divider':
      return '';
    case 'image':
      return block.alt_text ? `[image: ${block.alt_text}]` : '[image]';
    case 'actions':
      return '*[interactive buttons]*';
    default:
      return '';
  }
}

function extractRichTextElement(el: any, ctx: ExtractCtx): string {
  const leaves = (node: any): string =>
    (node.elements ?? []).map((sub: any) => extractRichTextLeaf(sub, ctx)).join('');

  switch (el.type) {
    case 'rich_text_section':
      return leaves(el);
    case 'rich_text_quote':
      return `> ${leaves(el)}`;
    case 'rich_text_preformatted':
      return '```\n' + leaves(el) + '\n```';
    case 'rich_text_list': {
      const marker = el.style === 'ordered' ? '1.' : '-';
      return (el.elements ?? [])
        .map((item: any) => `${marker} ${leaves(item)}`)
        .join('\n');
    }
    default:
      return '';
  }
}

function extractRichTextLeaf(leaf: any, ctx: ExtractCtx): string {
  switch (leaf.type) {
    case 'text': {
      let t = leaf.text ?? '';
      if (leaf.style?.code) t = `\`${t}\``;
      if (leaf.style?.strike) t = `~~${t}~~`;
      if (leaf.style?.italic) t = `*${t}*`;
      if (leaf.style?.bold) t = `**${t}**`;
      return t;
    }
    case 'link':
      return leaf.text ? `[${leaf.text}](${leaf.url})` : leaf.url;
    case 'user':
      return `@${ctx.resolveUser(leaf.user_id)}`;
    case 'channel':
      return `#${leaf.channel_id}`;
    case 'emoji':
      return `:${leaf.name}:`;
    default:
      return '';
  }
}
