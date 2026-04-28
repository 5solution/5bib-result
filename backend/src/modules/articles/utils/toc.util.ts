import { TableOfContentsItemDto } from '../dto/article-response.dto';
import { generateSlug } from './slug.util';

const HEADING_RE = /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
const ID_ATTR_RE = /\bid=["']([^"']+)["']/i;

interface HeadingMatch {
  tag: 'h2' | 'h3';
  attrs: string;
  innerHtml: string;
  raw: string;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Walk the sanitized HTML, find all h2/h3 blocks, ensure each has an `id`,
 * and return the rewritten HTML + a flat TOC.
 */
export function buildTableOfContents(html: string): {
  html: string;
  toc: TableOfContentsItemDto[];
} {
  if (!html) return { html: '', toc: [] };

  const seenIds = new Set<string>();
  const toc: TableOfContentsItemDto[] = [];

  const rewritten = html.replace(HEADING_RE, (_match, tag: string, attrs: string | undefined, inner: string) => {
    const tagName = tag.toLowerCase() as 'h2' | 'h3';
    const text = stripTags(inner);
    if (!text) return _match;

    const existing = attrs ? ID_ATTR_RE.exec(attrs) : null;
    let id = existing?.[1];

    if (!id) {
      const base = generateSlug(text) || 'section';
      id = base;
      let counter = 2;
      while (seenIds.has(id)) {
        id = `${base}-${counter++}`;
      }
    }

    seenIds.add(id);
    toc.push({ id, text, level: tagName === 'h2' ? 2 : 3 });

    const cleanedAttrs = (attrs ?? '').replace(ID_ATTR_RE, '').trim();
    const newAttrs = cleanedAttrs ? `${cleanedAttrs} id="${id}"` : `id="${id}"`;
    return `<${tagName} ${newAttrs}>${inner}</${tagName}>`;
  });

  return { html: rewritten, toc };
}
