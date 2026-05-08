'use client';

/**
 * F-014 — Race sponsors table.
 *
 * Verbatim port of legacy sponsors tab (lines 1540–1614).
 * Wires CRUD via existing `sponsorsControllerCreate/Update/Remove` SDK
 * + `sponsorsControllerFindByRaceId` for list.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/api';
import {
  sponsorsControllerCreate,
  sponsorsControllerFindByRaceId,
  sponsorsControllerRemove,
  sponsorsControllerUpdate,
} from '@/lib/api-generated';
import { SponsorDialog, type SponsorFormState } from './SponsorDialog';
import type { RaceSponsor } from '../section-shared.types';

interface SponsorsTableProps {
  raceId: string;
}

export function SponsorsTable({ raceId }: SponsorsTableProps) {
  const { token } = useAuth();
  const [sponsors, setSponsors] = useState<RaceSponsor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RaceSponsor | null>(null);
  const [form, setForm] = useState<SponsorFormState>({
    name: '',
    logoUrl: '',
    website: '',
    level: 'silver',
    order: 0,
  });
  const [saving, setSaving] = useState(false);

  const fetchSponsors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error } = await sponsorsControllerFindByRaceId({
        path: { raceId },
        ...authHeaders(token),
      });
      if (!error) {
        const body = data as { data?: RaceSponsor[] } | RaceSponsor[];
        setSponsors(
          Array.isArray(body)
            ? body
            : (body as { data?: RaceSponsor[] }).data ?? [],
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token, raceId]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', logoUrl: '', website: '', level: 'silver', order: 0 });
    setOpen(true);
  }

  function openEdit(s: RaceSponsor) {
    setEditing(s);
    setForm({
      name: s.name,
      logoUrl: s.logoUrl,
      website: s.website || '',
      level: s.level,
      order: s.order,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      const payload = { ...form, raceId };
      if (editing) {
        const { error } = await sponsorsControllerUpdate({
          path: { id: editing._id },
          body: payload as unknown as Parameters<typeof sponsorsControllerUpdate>[0]['body'],
          ...authHeaders(token),
        });
        if (error) throw new Error('Update failed');
        toast.success('Đã cập nhật nhà tài trợ');
      } else {
        const { error } = await sponsorsControllerCreate({
          body: payload as unknown as Parameters<typeof sponsorsControllerCreate>[0]['body'],
          ...authHeaders(token),
        });
        if (error) throw new Error('Create failed');
        toast.success('Đã thêm nhà tài trợ');
      }
      setOpen(false);
      fetchSponsors();
    } catch {
      toast.error('Lưu nhà tài trợ thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      const { error } = await sponsorsControllerRemove({
        path: { id },
        ...authHeaders(token),
      });
      if (error) throw new Error('Delete failed');
      toast.success('Đã xóa nhà tài trợ');
      fetchSponsors();
    } catch {
      toast.error('Xóa nhà tài trợ thất bại');
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Nhà tài trợ giải đấu</CardTitle>
            <CardDescription>
              Quản lý nhà tài trợ riêng cho giải này
            </CardDescription>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus className="size-4 mr-1" /> Thêm
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : sponsors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Chưa có nhà tài trợ nào cho giải này
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Logo</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Cấp độ</TableHead>
                  <TableHead>Thứ tự</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsors.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell>
                      {s.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={s.logoUrl}
                          alt={s.name}
                          className="h-8 w-auto max-w-[120px] object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                        style={
                          s.level === 'diamond'
                            ? {
                                background: '#ede9fe',
                                color: '#5b21b6',
                                borderColor: '#c4b5fd',
                              }
                            : s.level === 'gold'
                              ? {
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  borderColor: '#fcd34d',
                                }
                              : {
                                  background: '#f3f4f6',
                                  color: '#6b7280',
                                  borderColor: '#d1d5db',
                                }
                        }
                      >
                        {s.level === 'diamond'
                          ? 'Kim cương'
                          : s.level === 'gold'
                            ? 'Vàng'
                            : 'Bạc'}
                      </span>
                    </TableCell>
                    <TableCell>{s.order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(s)}
                          title="Sửa"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(s._id)}
                          title="Xóa"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SponsorDialog
        open={open}
        onOpenChange={setOpen}
        isEdit={!!editing}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={handleSave}
      />
    </>
  );
}

export default SponsorsTable;
