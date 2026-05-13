/**
 * FEATURE-027 — Rich Text section.
 *
 * Config: { title, html }
 *
 * Backend sanitizes HTML via sanitize-html (strip <script>, event handlers,
 * javascript: URIs) trên write path. Frontend trust backend output —
 * dùng `dangerouslySetInnerHTML` an toàn (defense in depth: nginx CSP).
 */

import type { SectionResponseDto } from "@/lib/api-generated";

type RichTextConfig = {
  title?: string;
  html?: string;
};

export function RichTextSection({ section }: { section: SectionResponseDto }) {
  const c = section.config as RichTextConfig;
  const html = c.html?.trim();
  if (!html) return null;

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-[min(var(--promo-max-width,1200px),720px)]">
        {c.title && (
          <h2 className="mb-6 font-[var(--promo-font)] text-2xl font-bold tracking-tight">
            {c.title}
          </h2>
        )}
        <div
          className="prose prose-stone max-w-none prose-headings:font-[var(--promo-font)] prose-a:text-[var(--promo-primary)]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
