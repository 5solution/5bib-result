'use client';

interface Props {
  message: string;
  themeColor: string;
}

/**
 * F-017 Phase 1 — plain text only. Markdown / rich-text deferred to Phase 2
 * (see TD-F017-MARKDOWN-MESSAGE in 03 doc).
 */
export function CustomMessageSection({ message, themeColor }: Props) {
  if (!message || !message.trim()) return null;
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: themeColor + '10', borderColor: themeColor, borderWidth: 1 }}
      data-testid="custom-message-section"
    >
      <p className="text-base leading-relaxed text-stone-800 whitespace-pre-wrap">{message}</p>
    </div>
  );
}
