"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { RegistrationDetailView } from "../_registration-detail";

export default function PersonnelDetailPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string; regId: string }>();
  const regId = Number(params.regId);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/team-management/${params.eventId}/registrations`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Quay lại
          </Button>
        </Link>
      </div>
      <RegistrationDetailView regId={regId} />
    </div>
  );
}
