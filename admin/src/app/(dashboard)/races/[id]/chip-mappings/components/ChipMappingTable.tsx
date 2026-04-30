'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ChipMappingItemDto,
  deleteChipMapping,
  listChipMappings,
  updateChipMapping,
} from '@/lib/chip-verification-api';

const PAGE_SIZE = 50;

interface Props {
  raceId: number;
}

export function ChipMappingTable({ raceId }: Props) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchActive, setSearchActive] = useState('');
  const [editing, setEditing] = useState<ChipMappingItemDto | null>(null);
  const [editForm, setEditForm] = useState<{
    chip_id: string;
    bib_number: string;
    status: 'ACTIVE' | 'DISABLED';
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['chip-mappings', raceId, page, searchActive],
    queryFn: () =>
      listChipMappings(raceId, page, PAGE_SIZE, searchActive || undefined),
    staleTime: 5_000,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof updateChipMapping>[2];
    }) => updateChipMapping(raceId, id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chip-mappings', raceId] });
      queryClient.invalidateQueries({ queryKey: ['chip-stats', raceId] });
      setEditing(null);
      setEditForm(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteChipMapping(raceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chip-mappings', raceId] });
      queryClient.invalidateQueries({ queryKey: ['chip-stats', raceId] });
      setDeletingId(null);
    },
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchActive(searchInput.trim());
    setPage(1);
  };

  const totalPages = list.data
    ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE))
    : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chip mappings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            placeholder="Tìm chip_id hoặc bib_number (prefix)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-md"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
          {searchActive && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setSearchActive('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {list.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : list.isError ? (
          <p className="text-sm text-red-600">
            Lỗi tải mappings: {(list.error as Error).message}
          </p>
        ) : list.data && list.data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {searchActive
              ? 'Không tìm thấy mapping khớp.'
              : 'Chưa có mapping nào — import CSV ở section trên.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chip ID</TableHead>
                  <TableHead>BIB</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data?.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">
                      {m.chip_id}
                    </TableCell>
                    <TableCell className="font-semibold">{m.bib_number}</TableCell>
                    <TableCell>
                      {m.status === 'ACTIVE' ? (
                        <Badge className="bg-green-600">ACTIVE</Badge>
                      ) : (
                        <Badge variant="outline">DISABLED</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.updated_at).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(m);
                          setEditForm({
                            chip_id: m.chip_id,
                            bib_number: m.bib_number,
                            status: m.status,
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => setDeletingId(m.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {list.data && list.data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} · Total{' '}
              {list.data.total.toLocaleString('vi-VN')}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit chip mapping</DialogTitle>
          </DialogHeader>
          {editing && editForm && (
            <div className="space-y-3">
              <div>
                <Label>Chip ID</Label>
                <Input
                  value={editForm.chip_id}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      chip_id: e.target.value.toUpperCase().trim(),
                    })
                  }
                />
              </div>
              <div>
                <Label>BIB number</Label>
                <Input
                  value={editForm.bib_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bib_number: e.target.value.trim() })
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="mt-1 w-full rounded border bg-background p-2"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      status: e.target.value as 'ACTIVE' | 'DISABLED',
                    })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </div>
              {update.isError && (
                <p className="text-sm text-red-600">
                  {(update.error as Error).message}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setEditForm(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editing || !editForm) return;
                update.mutate({
                  id: editing.id,
                  body: {
                    chip_id: editForm.chip_id,
                    bib_number: editForm.bib_number,
                    status: editForm.status,
                  },
                });
              }}
              disabled={update.isPending}
            >
              {update.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soft-delete mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              Mapping sẽ bị soft-delete (giữ history). Có thể re-create với cùng
              chip_id sau. Tiếp tục?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && remove.mutate(deletingId)}
              disabled={remove.isPending}
            >
              {remove.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
