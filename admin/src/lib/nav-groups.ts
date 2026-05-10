/**
 * 5BIB Admin Sidebar Navigation Groups
 *
 * FEATURE-022 BR-DESIGN-10 — 4 nhom chuan:
 *   - Van hanh (8 muc)
 *   - Noi dung (6 muc)
 *   - Ho tro (1 muc)
 *   - He thong (2 muc + 1 simulator giu nguyen tu code cu)
 *
 * Doi chieu shell.jsx NAV_GROUPS. Moi item co route href tuong duong codebase
 * hien tai (xac nhan tat ca route deu exist trong (dashboard)/ folder).
 *
 * isComingSoon: false cho tat ca — route deu tu cap.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Trophy,
  Store,
  ReceiptText,
  BarChart2,
  Users,
  FileWarning,
  Timer,
  FileText,
  Tags,
  Handshake,
  Megaphone,
  Award,
  Image as ImageIcon,
  Bug,
  KeyRound,
  RefreshCw,
  Film,
} from "lucide-react";

export type NavItem = {
  /** Stable id, dung trong shell.jsx reference. */
  id: string;
  /** Route Next.js App Router. */
  href: string;
  /** Nhan tieng Viet hien thi. */
  label: string;
  /** Lucide icon component. */
  icon: LucideIcon;
  /** Optional badge text (vd "NEW"). */
  badge?: string;
  /** Optional pending dot indicator (vd Khieu nai co pending). */
  dot?: boolean;
  /** Optional count number (vd "Giai dau (47)" — fetch dynamic, default undefined). */
  count?: number;
  /** Route chua co page → render placeholder Coming soon (BR-DESIGN-10). */
  isComingSoon?: boolean;
};

export type NavGroup = {
  /** Nhan UPPERCASE hien thi tren section header. */
  label: string;
  /** Items trong nhom. */
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Vận hành",
    items: [
      { id: "dashboard", href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { id: "races", href: "/races", label: "Giải đấu", icon: Trophy },
      { id: "merchants", href: "/merchants", label: "Merchant", icon: Store },
      { id: "reconciliations", href: "/reconciliations", label: "Đối soát", icon: ReceiptText },
      { id: "analytics", href: "/analytics", label: "Analytics", icon: BarChart2 },
      { id: "team", href: "/team-management", label: "Quản lý nhân sự", icon: Users },
      { id: "claims", href: "/claims", label: "Khiếu nại", icon: FileWarning, dot: true },
      { id: "timing-leads", href: "/timing-leads", label: "Timing Leads", icon: Timer },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { id: "articles", href: "/articles", label: "Bài viết", icon: FileText, badge: "NEW" },
      { id: "categories", href: "/article-categories", label: "Danh mục", icon: Tags },
      { id: "sponsors", href: "/sponsors", label: "Nhà tài trợ", icon: Handshake },
      { id: "banner", href: "/sponsored", label: "Banner Zone", icon: Megaphone },
      { id: "certificates", href: "/certificates", label: "Certificates", icon: Award },
      { id: "result-images", href: "/result-image-stats", label: "Ảnh kết quả", icon: ImageIcon },
    ],
  },
  {
    label: "Hỗ trợ",
    items: [
      { id: "bug-reports", href: "/bug-reports", label: "Báo lỗi", icon: Bug, badge: "NEW" },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { id: "api-keys", href: "/api-keys", label: "API Keys", icon: KeyRound },
      { id: "sync-logs", href: "/sync-logs", label: "Nhật ký đồng bộ", icon: RefreshCw },
      { id: "timing-simulator", href: "/timing-alert-simulator", label: "Timing Simulator", icon: Film },
    ],
  },
];
