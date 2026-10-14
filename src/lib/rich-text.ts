/**
 * Ideas and comments are stored as a small Markdown subset: paragraphs, bulleted
 * and numbered lists, quotes, **bold**, _italic_, and links. Rendering escapes
 * every piece of text and only links http(s) and mailto URLs, so stored content
 * can't inject markup. Plain text from before the editor parses as paragraphs.
 */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong' | 'em'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] };
export type Line = Inline[];
export type Block = { type: 'p'; lines: Line[] } | { type: 'quote'; lines: Line[] } | { type: 'ul'; items: Line[] } | { type: 'ol'; items: Line[] };

const escapable = '\\*_[]-+>.)';
// Punctuation that ends a sentence rather than a pasted URL.
const trailingPunctuation = /[.,;:!?'")\]]+$/;

export function safeHref(value: string) {
  return /^(https?:\/\/|mailto:)[^\s<>"]+$/i.test(value) && value.length <= 2000 ? value : null;
}

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  let open = null as Block | null;
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(raw);
    const number = /^\s*\d+[.)]\s+(.*)$/.exec(raw);
    const quote = /^\s*>\s?(.*)$/.exec(raw);
    const type = !raw.trim() ? null : bullet ? 'ul' : number ? 'ol' : quote ? 'quote' : 'p';
    if (!type) {
      open = null;
      continue;
    }
    const content = parseInline((bullet ?? number ?? quote)?.[1] ?? raw.trim());
    const block: Block = open?.type === type ? open : type === 'ul' || type === 'ol' ? { type, items: [] } : { type, lines: [] };
    if (block !== open) blocks.push(block);
    if ('items' in block) block.items.push(content);
    else block.lines.push(content);
    open = block;
  }
  return blocks;
}

function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = '';
  const push = (node: Inline) => {
    if (text) out.push({ type: 'text', text });
    text = '';
    out.push(node);
  };
  for (let i = 0; i < source.length; ) {
    const char = source[i];
    if (char === '\\' && escapable.includes(source[i + 1] ?? '')) {
      text += source[i + 1];
      i += 2;
      continue;
    }
    if (source.startsWith('**', i)) {
      const end = closing(source, i + 2, '**');
      if (end > 0) {
        push({ type: 'strong', children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    // Underscores inside words, like snake_case, stay literal.
    if (char === '_' && !/[\p{L}\p{N}]/u.test(source[i - 1] ?? '')) {
      const end = closing(source, i + 1, '_');
      if (end > 0 && !/[\p{L}\p{N}]/u.test(source[end + 1] ?? '')) {
        push({ type: 'em', children: parseInline(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    const link = char === '[' ? /^\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)\)/.exec(source.slice(i)) : null;
    if (link && safeHref(link[2])) {
      push({ type: 'link', href: link[2], children: parseInline(link[1]) });
      i += link[0].length;
      continue;
    }
    const url = (char === 'h' || char === 'H') && !/[\p{L}\p{N}]/u.test(source[i - 1] ?? '') ? /^https?:\/\/[^\s<>"]+/i.exec(source.slice(i)) : null;
    if (url) {
      const href = url[0].replace(trailingPunctuation, '');
      push({ type: 'link', href, children: [{ type: 'text', text: href }] });
      i += href.length;
      continue;
    }
    text += char;
    i += 1;
  }
  if (text) out.push({ type: 'text', text });
  return out;
}

/** Index of the marker that closes a span starting at `from`, or -1. Spans can't start or end with a space. */
function closing(source: string, from: number, marker: string) {
  if (/^\s/.test(source.slice(from))) return -1;
  for (let i = from; i < source.length; i++) {
    if (source[i] === '\\') i++;
    else if (source.startsWith(marker, i) && i > from && !/\s/.test(source[i - 1])) return i;
  }
  return -1;
}

export function stringifyRichText(blocks: Block[]) {
  return blocks
    .map((block) => {
      if (block.type === 'ul') return block.items.map((item) => `- ${inlineText(item).trim()}`).join('\n');
      if (block.type === 'ol') return block.items.map((item, index) => `${index + 1}. ${inlineText(item).trim()}`).join('\n');
      // Escape text that would otherwise start a list or quote when parsed again.
      const lines = block.lines.map((line) => inlineText(line).trim().replace(/^[-+>]/, '\\$&').replace(/^(\d+)([.)])/, '$1\\$2'));
      while (lines.length && !lines[0].trim()) lines.shift();
      while (lines.length && !lines.at(-1)!.trim()) lines.pop();
      return block.type === 'quote' ? lines.map((line) => `> ${line}`).join('\n') : lines.join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function inlineText(nodes: Inline[], inside: Set<string> = new Set()): string {
  const pieces = nodes.map((node) => {
    // URLs are left as typed; the parser reads them whole, so escapes would end up in the link.
    if (node.type === 'text') return node.text.replace(/(https?:\/\/[^\s<>"]+)|[\\*_[\]]/gi, (match, url) => url ?? `\\${match}`);
    if (inside.has(node.type)) return inlineText(node.children, inside);
    const content = inlineText(node.children, new Set([...inside, node.type]));
    if (node.type === 'link') {
      const label = plainInline(node.children);
      const bare = label === node.href && !trailingPunctuation.test(node.href);
      return bare ? node.href : `[${content}](${node.href.replace(/[()\s]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)})`;
    }
    // Markers must touch the text they wrap, so edge spaces move outside.
    const [, before, inner, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(content)!;
    const marker = node.type === 'strong' ? '**' : '_';
    return inner ? `${before}${marker}${inner}${marker}${after}` : content;
  });
  // `_` only reads as italic between word boundaries, so italics inside a word are dropped.
  return pieces
    .map((piece, index) => {
      const node = nodes[index];
      if (node.type !== 'em' || inside.has('em') || !piece.startsWith('_') || !piece.endsWith('_')) return piece;
      const wordBefore = /[\p{L}\p{N}]$/u.test(pieces.slice(0, index).join(''));
      const wordAfter = /^[\p{L}\p{N}]/u.test(pieces[index + 1] ?? '');
      return wordBefore || wordAfter ? piece.slice(1, -1) : piece;
    })
    .join('');
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function richTextToHtml(blocks: Block[]) {
  const inline = (nodes: Inline[]): string =>
    nodes
      .map((node) => {
        if (node.type === 'text') return escapeHtml(node.text);
        if (node.type === 'link') {
          const href = safeHref(node.href);
          return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${inline(node.children)}</a>` : inline(node.children);
        }
        return `<${node.type}>${inline(node.children)}</${node.type}>`;
      })
      .join('');
  return blocks
    .map((block) => {
      if (block.type === 'ul' || block.type === 'ol') return `<${block.type}>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${block.type}>`;
      const lines = block.lines.map(inline).join('<br>');
      return block.type === 'quote' ? `<blockquote>${lines}</blockquote>` : `<p>${lines}</p>`;
    })
    .join('');
}

function plainInline(nodes: Inline[]): string {
  return nodes.map((node) => (node.type === 'text' ? node.text : plainInline(node.children))).join('');
}

/** The text without formatting, for previews and search. */
export function plainText(source: string) {
  return parseRichText(source)
    .flatMap((block) => ('items' in block ? block.items : block.lines))
    .map(plainInline)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
