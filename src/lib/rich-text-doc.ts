import type { JSONContent } from '@tiptap/react';
import { parseRichText, safeHref, stringifyRichText, type Block, type Inline, type Line } from '~/lib/rich-text';

/**
 * Converts between stored rich text and the editor's document. The editor's schema matches the
 * stored format: list items hold one paragraph, and quotes hold paragraphs, one per line.
 */
export function richTextToDoc(source: string): JSONContent {
  const paragraph = (lines: Line[]): JSONContent => ({
    type: 'paragraph',
    content: lines.flatMap((line, index) => [...(index ? [{ type: 'hardBreak' }] : []), ...textNodes(line, [])])
  });
  const content = parseRichText(source).map((block): JSONContent => {
    if (block.type === 'ul' || block.type === 'ol') {
      return { type: block.type === 'ul' ? 'bulletList' : 'orderedList', content: block.items.map((item) => ({ type: 'listItem', content: [paragraph([item])] })) };
    }
    if (block.type === 'quote') return { type: 'blockquote', content: block.lines.map((line) => paragraph([line])) };
    return paragraph(block.lines);
  });
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

function textNodes(nodes: Inline[], marks: JSONContent['marks'] & {}): JSONContent[] {
  return nodes.flatMap((node): JSONContent[] => {
    if (node.type === 'text') return node.text ? [{ type: 'text', text: node.text, ...(marks.length ? { marks } : {}) }] : [];
    const mark = node.type === 'link' ? { type: 'link', attrs: { href: node.href } } : { type: node.type === 'strong' ? 'bold' : 'italic' };
    return textNodes(node.children, [...marks, mark]);
  });
}

export function docToRichText(doc: JSONContent): string {
  const blocks = (doc.content ?? []).map((node): Block => {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      // A line break inside a list item reads as a space, and empty items are dropped.
      const items = (node.content ?? [])
        .map((item) => (item.content ?? []).flatMap(lines).flatMap((line, index): Line => (index ? [{ type: 'text', text: ' ' }, ...line] : line)))
        .filter((item) => item.length);
      return { type: node.type === 'bulletList' ? 'ul' : 'ol', items };
    }
    if (node.type === 'blockquote') return { type: 'quote', lines: (node.content ?? []).flatMap(lines) };
    return { type: 'p', lines: lines(node) };
  });
  return stringifyRichText(blocks);
}

type Run = { text: string; marks: string[] };

/** A paragraph's lines, with each piece of text keyed by its marks: `strong`, `em`, or `link:<href>`. */
function lines(paragraph: JSONContent): Line[] {
  const runs: Run[][] = [[]];
  for (const node of paragraph.content ?? []) {
    if (node.type === 'hardBreak') runs.push([]);
    else if (node.type === 'text' && node.text) {
      const marks = (node.marks ?? []).flatMap((mark) => {
        if (mark.type === 'bold') return ['strong'];
        if (mark.type === 'italic') return ['em'];
        const href = mark.type === 'link' ? safeHref(String(mark.attrs?.href ?? '')) : null;
        return href ? [`link:${href}`] : [];
      });
      runs.at(-1)!.push({ text: node.text, marks });
    }
  }
  return runs.map(group);
}

/** Nests marked text, wrapping first with the mark that runs furthest, so a bold phrase containing a link stays one span. */
function group(runs: Run[]): Inline[] {
  const out: Inline[] = [];
  for (let i = 0; i < runs.length; ) {
    const { text, marks } = runs[i];
    if (!marks.length) {
      out.push({ type: 'text', text });
      i += 1;
      continue;
    }
    const reach = (mark: string) => {
      let end = i;
      while (end < runs.length && runs[end].marks.includes(mark)) end += 1;
      return end;
    };
    const mark = marks.reduce((best, each) => (reach(each) > reach(best) ? each : best));
    const end = reach(mark);
    const children = group(runs.slice(i, end).map((run) => ({ text: run.text, marks: run.marks.filter((each) => each !== mark) })));
    out.push(mark.startsWith('link:') ? { type: 'link', href: mark.slice(5), children } : { type: mark === 'strong' ? 'strong' : 'em', children });
    i = end;
  }
  return out;
}
