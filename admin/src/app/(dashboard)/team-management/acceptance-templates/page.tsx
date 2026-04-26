"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Acceptance templates đã được merge vào /contract-templates (tab "Nghiệm thu").
 * Redirect để tránh dead link.
 */
export default function AcceptanceTemplatesRedirect(): null {
  const router = useRouter();
  useEffect(() => {
    router.replace("/team-management/contract-templates?tab=acceptance");
  }, [router]);
  return null;
}
