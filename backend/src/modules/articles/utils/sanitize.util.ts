// CJS module — `import x from 'sanitize-html'` doesn't expose `.defaults`
// under NestJS SWC compile. Use TS native CJS import to get the full module.
import sanitizeHtml = require('sanitize-html');

const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)/i;
const VIMEO_RE = /^https?:\/\/player\.vimeo\.com\/video\//i;

/**
 * Sanitize Tiptap HTML output before storing.
 * Whitelists block-level + inline tags used by the editor.
 * For <iframe>: only YouTube/Vimeo embeds allowed.
 */
export function sanitizeArticleContent(html: string): string {
  if (!html) return '';

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'figure',
      'figcaption',
      'iframe',
      'h1',
      'h2',
      'h3',
      'video',
      'source',
    ]),
    allowedAttributes: {
      // `style` excluded globally — CSS-based XSS legacy (IE) + override editor styling.
      '*': ['class', 'id'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
      video: ['src', 'controls', 'poster', 'width', 'height'],
      source: ['src', 'type'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'youtube-nocookie.com', 'player.vimeo.com'],
    transformTags: {
      iframe: (tagName, attribs) => {
        const src = attribs.src ?? '';
        if (!YOUTUBE_RE.test(src) && !VIMEO_RE.test(src)) {
          return { tagName: 'div', attribs: {}, text: '' };
        }
        return {
          tagName: 'iframe',
          attribs: {
            ...attribs,
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowfullscreen: 'true',
          },
        };
      },
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          ...(attribs.href && /^https?:/i.test(attribs.href)
            ? { rel: 'noopener noreferrer', target: '_blank' }
            : {}),
        },
      }),
    },
    disallowedTagsMode: 'discard',
  });
}
