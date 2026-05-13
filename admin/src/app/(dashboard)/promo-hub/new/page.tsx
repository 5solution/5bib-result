"use client";

/**
 * FEATURE-027 — Promo Hub "new" route.
 *
 * Promo Hub flow: list page có nút "Tạo trang mới" → tạo bản nháp → redirect
 * ngay sang `/promo-hub/[id]` để edit. Route này tồn tại chỉ để handle case
 * user gõ trực tiếp `/promo-hub/new` trên URL — redirect về list để dùng
 * flow chuẩn (tránh duplicate logic create).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function PromoHubNewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/promo-hub");
  }, [router]);
  return <Skeleton className="h-40 w-full" />;
}
