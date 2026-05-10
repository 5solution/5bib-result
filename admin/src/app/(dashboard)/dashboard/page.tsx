"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, FileDown } from "lucide-react";
import { CreateRaceDialog } from "@/components/dialogs/CreateRaceDialog";
import { KPIStrip } from "./components/KPIStrip";
import { LiveRacesSection } from "./components/LiveRacesSection";
import { UpcomingRacesList } from "./components/UpcomingRacesList";
import { PendingTasksPanel } from "./components/PendingTasksPanel";
import { RecentActivityTimeline } from "./components/RecentActivityTimeline";
import { SystemStatusFooter } from "./components/SystemStatusFooter";

/**
 * F-023 — Admin Dashboard Redesign (màn 01).
 *
 * Orchestrator render 6 widget mới + greeting header + button "Tạo giải mới"
 * (popup CreateRaceDialog tách từ races/page.tsx). Tuân thủ F-022 design tokens
 * (warm stone bg, blue primary, magenta live, JetBrains Mono cho currency).
 */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Chào buổi sáng";
  if (h >= 11 && h < 13) return "Chào buổi trưa";
  if (h >= 13 && h < 18) return "Chào buổi chiều";
  if (h >= 18 && h < 22) return "Chào buổi tối";
  return "Chúc ngủ ngon";
}

function formatToday(): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const greeting = getGreeting();
  const today = formatToday();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900">
            Tổng quan
          </h1>
          <p className="text-sm text-stone-500">
            {greeting}. Hôm nay {today}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <FileDown className="size-4 mr-1.5" />
            Xuất báo cáo
          </Button>
          <CreateRaceDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4 mr-1.5" />
                Tạo giải mới
              </Button>
            }
            onSuccess={(raceId) => {
              if (raceId) router.push(`/races/${raceId}`);
            }}
          />
        </div>
      </div>

      {/* B. KPI strip */}
      <KPIStrip />

      {/* C. Live races highlight */}
      <LiveRacesSection />

      {/* D. Upcoming races */}
      <UpcomingRacesList />

      {/* E. Pending tasks */}
      <PendingTasksPanel />

      {/* F. Recent activity timeline */}
      <RecentActivityTimeline />

      {/* G. System status footer */}
      <SystemStatusFooter />
    </div>
  );
}
