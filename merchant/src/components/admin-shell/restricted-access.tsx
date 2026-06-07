"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

/**
 * RestrictedAccess — placeholder full-page hiển thị khi user thiếu quyền truy cập route.
 *
 * Dùng cho page-level RBAC gate (vd Analytics yêu cầu admin) song song với
 * sidebar nav filter trong `Sidebar.tsx`. Backend vẫn enforce qua
 * `LogtoAdminGuard` / `LogtoStaffGuard` — UI gate này chỉ là defense-in-depth + UX.
 */
export function RestrictedAccess({
  message,
  backHref = "/dashboard",
  backLabel = "Quay về Tổng quan",
}: {
  message?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-amber-100 text-amber-700">
        <ShieldAlert className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Không có quyền truy cập</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        {message ??
          "Bạn không có quyền truy cập trang này — chỉ admin xem được. Nếu cần quyền, liên hệ quản trị hệ thống để được cấp quyền `admin` trên Logto."}
      </p>
      <Link
        href={backHref}
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[var(--admin-blue)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
    </div>
  );
}
