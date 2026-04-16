"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { opsEventsApi, type OpsEvent } from "@/lib/ops-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ExternalLink } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Nhasp", className: "bg-gray-100 text-gray-700" },
  LIVE: { label: "Live", className: "bg-green-100 text-green-700" },
  ENDED: { label: "Ket thuc", className: "bg-orange-100 text-orange-700" },
};

export default function OpsEventsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState("");
  const [locationName, setLocationName] = useState("");

  const loadEvents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await opsEventsApi.list(token);
      setEvents(res.items);
    } catch (err) {
      toast.error(`Load events that bai: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  async function handleCreate() {
    if (!token || !name || !slug || !date || !locationName) return;
    setCreating(true);
    try {
      await opsEventsApi.create(token, {
        name,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        date: new Date(date).toISOString(),
        location: { name: locationName },
      });
      toast.success("Tao event thanh cong");
      setDialogOpen(false);
      setName("");
      setSlug("");
      setDate("");
      setLocationName("");
      await loadEvents();
    } catch (err) {
      toast.error(`Loi: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Race Ops — Events
          </h1>
          <p className="text-sm text-muted-foreground">
            Quan ly su kien van hanh
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 size-4" />
            Tao Event
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tao Event Moi</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Ten event</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="HHTT2026"
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug (URL-safe)</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="hhtt2026"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ngay to chuc</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Dia diem</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Quang truong Ho Chi Minh, TP Vinh"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={creating || !name || !slug || !date || !locationName}
              >
                {creating ? "Dang tao..." : "Tao"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            Chua co event nao. Tao event dau tien!
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ten</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Ngay</TableHead>
                <TableHead>Dia diem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => {
                const badge = STATUS_BADGE[ev.status] ?? STATUS_BADGE.DRAFT;
                return (
                  <TableRow
                    key={ev.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/ops-events/${ev.id}`)}
                  >
                    <TableCell className="font-medium">{ev.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.slug}
                    </TableCell>
                    <TableCell>
                      {new Date(ev.date).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>{ev.location?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm">
                        <ExternalLink className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
