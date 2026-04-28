"use client";

import { useEffect, useState } from "react";
import type { TableOfContentsItem } from "@/lib/types";

interface Props {
  items: TableOfContentsItem[];
}

export function TOC({ items }: Props) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Mục lục bài viết">
      <div className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--5s-text-muted)]">
        Trong bài viết
      </div>
      <ul className="grid list-none gap-1 border-l-2 border-[var(--5s-border)] p-0">
        {items.map((t) => {
          const active = activeId === t.id;
          return (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                className="-ml-0.5 block py-2 pl-3.5 pr-3 text-[13px] transition-colors"
                style={{
                  borderLeft: `2px solid ${active ? "var(--5s-blue)" : "transparent"}`,
                  color: active ? "var(--5s-blue)" : "var(--5s-text-muted)",
                  fontWeight: active ? 700 : 500,
                  paddingLeft: t.level === 3 ? 28 : 14,
                }}
              >
                {t.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
