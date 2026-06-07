"use client";

/**
 * 5BIB Admin Topbar — FEATURE-022 BR-DESIGN-11.
 *
 * - Height 60px white, border-bottom border-color.
 * - Trai: breadcrumb auto-derive tu pathname.
 * - Phai: GlobalSearch ⌘K + NotificationBell (placeholder) + page actions slot.
 *
 * Breadcrumb mapping route segment → label tieng Viet.
 * Mobile: Page actions slot dung de inject menu trigger tu (dashboard) layout.
 */

import { ChevronRight, Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { GlobalSearch } from "./GlobalSearch";
import { useBreadcrumbOverrides } from "./breadcrumb-context";

/**
 * Mapping route segment chinh → label tieng Viet.
 * Group nhe theo NAV_GROUPS. Segment khong khop → fallback giu nguyen segment.
 * `[id]` `[slug]` etc → hien thi nguyen.
 */
const ROUTE_LABEL_MAP: Record<string, string> = {
  dashboard: "Tổng quan",
  races: "Giải đấu",
  merchants: "Merchant",
  reconciliations: "Đối soát",
  analytics: "Analytics",
  "team-management": "Quản lý nhân sự",
  claims: "Khiếu nại",
  "timing-leads": "Timing Leads",
  articles: "Bài viết",
  "article-categories": "Danh mục",
  sponsors: "Nhà tài trợ",
  sponsored: "Banner Zone",
  certificates: "Certificates",
  "result-image-stats": "Ảnh kết quả",
  "bug-reports": "Báo lỗi",
  "api-keys": "API Keys",
  "sync-logs": "Nhật ký đồng bộ",
  "timing-alert-simulator": "Timing Simulator",
  "command-center": "Command Center",
  "course-map": "Course Map",
  "master-data": "Master Data",
  "result-kiosk": "Result Kiosk",
  "chip-verify": "Chip Verify",
  awards: "Trao giải",
  athletes: "VĐV",
  medical: "Y tế",
  results: "Kết quả",
  readiness: "Readiness",
  settings: "Cài đặt",
  // F-024 contracts module
  contracts: "Hợp đồng",
  partners: "Đối tác",
  services: "Danh mục dịch vụ",
  templates: "Mẫu hợp đồng",
  create: "Tạo mới",
  acceptance: "Nghiệm thu",
  payment: "Đề nghị thanh toán",
  new: "Thêm mới",
};

/**
 * Detect "dynamic ID" segment (Mongo ObjectId / UUID / numeric ID / random hex).
 * Used to fallback to "Chi tiết" thay vì show raw ID khi không có override.
 */
function looksLikeId(seg: string): boolean {
  if (/^[a-f0-9]{24}$/i.test(seg)) return true; // Mongo ObjectId
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(seg))
    return true; // UUID
  if (/^\d+$/.test(seg) && seg.length >= 4) return true; // numeric id
  if (/^[a-f0-9]{12,}$/i.test(seg)) return true; // long hex
  return false;
}

type Crumb = { label: string; href?: string };

function buildBreadcrumbs(
  pathname: string,
  overrides: Record<string, string>,
): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Tổng quan" }];
  const crumbs: Crumb[] = [];
  let acc = "";
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    let label: string;
    if (overrides[seg]) {
      label = overrides[seg];
    } else if (ROUTE_LABEL_MAP[seg]) {
      label = ROUTE_LABEL_MAP[seg];
    } else if (looksLikeId(seg)) {
      // Never expose raw ObjectId/UUID. Fallback "Chi tiết" until page registers override.
      label = "Chi tiết";
    } else {
      label = seg;
    }
    crumbs.push({
      label,
      href: idx < segments.length - 1 ? acc : undefined,
    });
  });
  return crumbs;
}

export function Topbar({
  leftSlot,
  pageActions,
}: {
  /** Optional left slot (vd mobile menu trigger trong (dashboard)/layout.tsx). */
  leftSlot?: React.ReactNode;
  /** Optional right slot cho page-specific actions. */
  pageActions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const overrides = useBreadcrumbOverrides();
  const crumbs = buildBreadcrumbs(pathname, overrides);

  return (
    <header
      data-admin-topbar
      className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 md:px-7"
    >
      {leftSlot}

      {/* Breadcrumb — chi hien tu md tro len de mobile co cho cho menu trigger. */}
      <nav
        aria-label="Đường dẫn"
        className="hidden min-w-0 items-center gap-1.5 text-[13px] text-[var(--admin-text-muted)] md:flex"
      >
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />}
            {c.href ? (
              <Link
                href={c.href}
                className="truncate transition-colors hover:text-[var(--admin-text)]"
              >
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-semibold text-[var(--admin-text)]">
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:block">
          <GlobalSearch />
        </div>
        <button
          type="button"
          aria-label="Thông báo"
          className="relative grid size-[34px] place-items-center rounded-input border border-[var(--admin-border)] bg-white text-[var(--admin-text-muted)] transition-colors hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
        >
          <Bell className="size-4" aria-hidden />
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-[7px] rounded-full border-2 border-white bg-[var(--admin-magenta)]"
          />
        </button>
        {pageActions}
      </div>
    </header>
  );
}
