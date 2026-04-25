"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import "@/lib/api";
import {
  getCertificateTemplate,
  type CertificateTemplate,
} from "@/lib/certificate-api";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

// Konva needs window — disable SSR for the editor.
const TemplateEditor = dynamic(
  () => import("@/components/certificates/TemplateEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-[60vh] w-56" />
          <Skeleton className="h-[60vh] flex-1" />
          <Skeleton className="h-[60vh] w-72" />
        </div>
      </div>
    ),
  },
);

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { token, isAuthenticated, isLoading } = useAuth();
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    let mounted = true;
    getCertificateTemplate(token, id)
      .then((t) => mounted && setTemplate(t))
      .catch((err) =>
        mounted && setError(err instanceof Error ? err.message : "Lỗi tải"),
      );
    return () => {
      mounted = false;
    };
  }, [token, id]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="space-y-3 max-w-xl">
        <Link
          href="/certificates"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" /> Quay lại
        </Link>
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  if (!template || !token) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  return <TemplateEditor template={template} token={token} />;
}
