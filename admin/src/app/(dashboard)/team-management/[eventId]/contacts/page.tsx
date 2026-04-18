"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, EyeOff, Eye, Phone } from "lucide-react";
import {
  createEventContact,
  deleteEventContact,
  listEventContacts,
  toggleEventContactActive,
  updateEventContact,
} from "./_api";
import {
  CONTACT_TYPE_META,
  CONTACT_TYPE_ORDER,
  type ContactType,
  type EventContact,
  type UpsertContactInput,
} from "./_types";
import ContactDialog from "./_contact-dialog";

export default function ContactsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params.eventId);
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [contacts, setContacts] = useState<EventContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EventContact | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EventContact | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(eventId)) return;
    try {
      setError(null);
      const data = await listEventContacts(token, eventId);
      setContacts(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token, eventId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map: Record<ContactType, EventContact[]> = {
      medical: [],
      rescue: [],
      police: [],
      btc: [],
      other: [],
    };
    if (contacts) {
      for (const c of contacts) map[c.contact_type].push(c);
      for (const t of CONTACT_TYPE_ORDER) {
        map[t].sort((a, b) => {
          // Active first, then sort_order, then id
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          return a.id - b.id;
        });
      }
    }
    return map;
  }, [contacts]);

  async function handleSubmit(input: UpsertContactInput): Promise<void> {
    if (!token) return;
    if (editTarget) {
      await updateEventContact(token, editTarget.id, input);
      toast.success("Đã cập nhật liên lạc");
    } else {
      await createEventContact(token, eventId, input);
      toast.success("Đã thêm liên lạc");
    }
    setDialogOpen(false);
    setEditTarget(null);
    await load();
  }

  async function handleToggle(c: EventContact): Promise<void> {
    if (!token) return;
    try {
      await toggleEventContactActive(token, c.id);
      toast.success(c.is_active ? "Đã ẩn liên lạc" : "Đã hiện liên lạc");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!token || !confirmDelete) return;
    try {
      await deleteEventContact(token, confirmDelete.id);
      toast.success("Đã xoá liên lạc");
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (authLoading || !isAuthenticated) return <Skeleton className="h-64" />;

  const total = contacts?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-gradient">
            📞 Liên lạc khẩn cấp
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cấu hình số điện thoại BTC, Y tế, Cứu hộ, Công an cho sự kiện. Tất cả
            TNV/Crew có token hợp lệ đều thấy — bất kể trạng thái đăng ký.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Thêm liên lạc
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {contacts === null ? (
        <Skeleton className="h-64" />
      ) : total === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Chưa có liên lạc khẩn cấp. Bấm &quot;Thêm liên lạc&quot; để cấu hình.
        </div>
      ) : (
        <div className="space-y-6">
          {CONTACT_TYPE_ORDER.map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const meta = CONTACT_TYPE_META[type];
            return (
              <section key={type} className="space-y-2">
                <h2
                  className="text-sm font-bold tracking-wider uppercase flex items-center gap-2"
                  style={{ color: meta.color }}
                >
                  <span>{meta.icon}</span>
                  {meta.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </h2>
                <div
                  className="rounded-xl border divide-y"
                  style={{ borderColor: meta.border, background: "#ffffff" }}
                >
                  {items.map((c) => (
                    <ContactRow
                      key={c.id}
                      contact={c}
                      onEdit={() => {
                        setEditTarget(c);
                        setDialogOpen(true);
                      }}
                      onToggle={() => {
                        void handleToggle(c);
                      }}
                      onDelete={() => setConfirmDelete(c)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ContactDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditTarget(null);
        }}
        editTarget={editTarget}
        onSubmit={handleSubmit}
      />

      {confirmDelete ? (
        <ConfirmDeleteModal
          contact={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            void handleDelete();
          }}
        />
      ) : null}
    </div>
  );
}

function ContactRow({
  contact,
  onEdit,
  onToggle,
  onDelete,
}: {
  contact: EventContact;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const muted = !contact.is_active;
  return (
    <div
      className="flex items-start gap-3 p-3"
      style={{ opacity: muted ? 0.55 : 1 }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{contact.contact_name}</span>
          {muted ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">
              Đã ẩn
            </span>
          ) : null}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-mono">
            #{contact.sort_order}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1 font-mono">
            <Phone className="size-3" />
            {contact.phone}
          </span>
          {contact.phone2 ? (
            <span className="inline-flex items-center gap-1 font-mono text-gray-500">
              <Phone className="size-3" />
              {contact.phone2} <span className="text-gray-400">(phụ)</span>
            </span>
          ) : null}
        </div>
        {contact.note ? (
          <p className="mt-1 text-xs italic text-gray-500 line-clamp-2">
            {contact.note}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" title="Sửa" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title={contact.is_active ? "Ẩn" : "Hiện"}
          onClick={onToggle}
        >
          {contact.is_active ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
        <Button size="sm" variant="ghost" title="Xoá" onClick={onDelete}>
          <Trash2 className="size-4 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  contact,
  onCancel,
  onConfirm,
}: {
  contact: EventContact;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-2">Xoá liên lạc này?</h3>
        <p className="text-sm text-gray-600 mb-4">
          <b>{contact.contact_name}</b> — {contact.phone}
          <br />
          Hành động này không thể hoàn tác.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            onClick={onConfirm}
            style={{ background: "#dc2626", color: "#ffffff" }}
          >
            Xoá
          </Button>
        </div>
      </div>
    </div>
  );
}
