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
  FileSignature,
  Building2,
  Package,
  ScrollText,
  Coins,
  Sparkles,
  UsersRound,
  DatabaseZap,
  ShieldCheck,
  Globe,
  Link2,
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
  /**
   * RBAC gate:
   *   - "admin"             → chi admin/super_admin xem duoc
   *   - "finance"           → finance + admin xem (F-078 BR-78-10)
   *   - "staff-or-finance"  → staff + finance + admin xem (F-078 hotfix3 — cho
   *                            module dual-tier vd Hop dong access ca 2 role)
   *   - undefined           → CHI staff tro len thay duoc (default 5BIB
   *                            internal nav = operational items, ko cho finance
   *                            thuan tuy nhin). Finance items phai tag explicit.
   */
  requireRole?: "admin" | "finance" | "staff-or-finance";
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
      {
        id: "merchant-portal",
        href: "/merchant-portal",
        label: "Quyền BTC xem báo cáo",
        icon: ShieldCheck,
        badge: "NEW",
        requireRole: "admin",
      },
      { id: "reconciliations", href: "/reconciliations", label: "Đối soát", icon: ReceiptText },
      { id: "analytics", href: "/analytics", label: "Analytics", icon: BarChart2, requireRole: "admin" },
      { id: "team", href: "/team-management", label: "Quản lý nhân sự", icon: Users },
      { id: "claims", href: "/claims", label: "Khiếu nại", icon: FileWarning, dot: true },
      { id: "timing-leads", href: "/timing-leads", label: "Timing Leads", icon: Timer },
      { id: "igloo-insurance", href: "/insurance", label: "Bảo hiểm Igloo", icon: ShieldCheck, requireRole: "admin" },
      // F-048 Phase 3 — Athlete identity clusters management
      {
        id: "identity-clusters",
        href: "/athletes/identity-clusters",
        label: "Nhận dạng VĐV",
        icon: UsersRound,
        badge: "NEW",
        requireRole: "admin",
      },
      {
        id: "bulk-sync-control",
        href: "/race-master-data/sync-control",
        label: "Bulk Sync",
        icon: DatabaseZap,
        badge: "NEW",
        requireRole: "admin",
      },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { id: "articles", href: "/articles", label: "Bài viết", icon: FileText, badge: "NEW" },
      { id: "categories", href: "/article-categories", label: "Danh mục", icon: Tags },
      { id: "sponsors", href: "/sponsors", label: "Nhà tài trợ", icon: Handshake },
      { id: "banner", href: "/sponsored", label: "Banner Zone", icon: Megaphone },
      { id: "promo-hub", href: "/promo-hub", label: "Trang quảng bá", icon: Sparkles, badge: "NEW", requireRole: "admin" },
      { id: "landing", href: "/landing", label: "Trang giải chạy", icon: Globe, badge: "NEW", requireRole: "admin" },
      { id: "short-links", href: "/short-links", label: "Link rút gọn", icon: Link2, badge: "NEW", requireRole: "admin" },
      { id: "certificates", href: "/certificates", label: "Certificates", icon: Award },
      { id: "crew-certificates", href: "/crew-certificates", label: "GCN Crew", icon: Award, badge: "NEW", requireRole: "admin" },
      { id: "result-images", href: "/result-image-stats", label: "Ảnh kết quả", icon: ImageIcon },
    ],
  },
  {
    label: "Hợp đồng",
    items: [
      // F-078 hotfix3 — Tag explicit "staff-or-finance" để Hiền (finance only)
      // thấy items dù KHÔNG có staff role. Tâm/Hằng (staff) + Danny (admin) cũng thấy.
      { id: "contracts", href: "/contracts", label: "Danh sách hợp đồng", icon: FileSignature, badge: "NEW", requireRole: "staff-or-finance" },
      { id: "contracts-partners", href: "/contracts/partners", label: "Đối tác", icon: Building2, requireRole: "staff-or-finance" },
      { id: "contracts-services", href: "/contracts/services", label: "Danh mục dịch vụ", icon: Package, requireRole: "staff-or-finance" },
      { id: "contracts-templates", href: "/contracts/templates", label: "Mẫu hợp đồng", icon: ScrollText, requireRole: "staff-or-finance" },
    ],
  },
  {
    label: "Tài chính",
    items: [
      // F-078 BR-78-27 — 3 items đổi requireRole "admin" → "finance".
      // Hiển thị cho finance/admin; staff-only KHÔNG thấy nav (defense-in-depth UX).
      {
        id: "finance-pnl-dashboard",
        href: "/finance",
        label: "Tổng quan P&L",
        icon: BarChart2,
        requireRole: "finance",
        badge: "NEW",
      },
      {
        id: "finance-pnl-contract",
        href: "/finance/contracts",
        label: "P&L theo HĐ",
        icon: Coins,
        requireRole: "finance",
      },
      // F-076 — MISA Meinvoice daily reconcile + alert.
      // F-078: requireRole "admin" → "finance" cho Hiền (kế toán) access.
      {
        id: "invoice-reconcile",
        href: "/invoice-reconcile",
        label: "Đối soát hóa đơn MISA",
        icon: ShieldCheck,
        requireRole: "finance",
        badge: "NEW",
      },
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
