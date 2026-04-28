// CJS interop — sanitize-html is a CommonJS module without default export.
// Articles module uses the same pattern; importing as ESM default breaks
// `sanitizeHtml.defaults` lookup at runtime.
import sanitizeHtml = require('sanitize-html');

/**
 * Strip ALL HTML/markup from user-submitted text fields. Bug reports never
 * render user input as HTML — the admin UI always shows plaintext — so the
 * safest move is allowlist-empty.
 */
export function sanitizeText(input: string | undefined | null): string {
  if (!input) return '';
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();
}
