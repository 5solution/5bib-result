/**
 * F-007 BR-AF-19/20 — Breadcrumb component.
 *
 * Truncates label > 40 chars with ellipsis (full text in `<title>` tooltip).
 * On viewports < 375px the whole breadcrumb is hidden via `hidden xs:inline-flex`
 * (consumer wraps with back-arrow icon at narrower widths).
 *
 * Server Component — no interactivity beyond <Link>.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const MAX_LABEL_LEN = 40;

function truncate(label: string): string {
  if (label.length <= MAX_LABEL_LEN) return label;
  return `${label.slice(0, MAX_LABEL_LEN - 1)}…`;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden items-center gap-1.5 text-sm text-stone-500 sm:inline-flex"
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const display = truncate(item.label);
        const titleAttr = item.label.length > MAX_LABEL_LEN ? item.label : undefined;
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-medium text-stone-500 transition-colors hover:text-stone-900"
                title={titleAttr}
              >
                {display}
              </Link>
            ) : (
              <span
                className={isLast ? "font-semibold text-stone-900" : "text-stone-500"}
                title={titleAttr}
              >
                {display}
              </span>
            )}
            {!isLast ? <ChevronRight className="size-3.5 text-stone-400" aria-hidden /> : null}
          </span>
        );
      })}
    </nav>
  );
}
