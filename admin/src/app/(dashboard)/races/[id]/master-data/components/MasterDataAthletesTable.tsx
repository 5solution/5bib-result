'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listMasterDataAthletes } from '@/lib/race-master-data-api';

interface Props {
  mysqlRaceId: number;
}

const PAGE_SIZE = 50;

export function MasterDataAthletesTable({ mysqlRaceId }: Props) {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['master-data-athletes', mysqlRaceId, page, search],
    queryFn: () =>
      listMasterDataAthletes(mysqlRaceId, {
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const totalPages = list.data
    ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE))
    : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Athletes ({list.data?.total ?? 0})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <Input
            placeholder="Search by BIB or name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {list.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : list.data && list.data.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BIB</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Racekit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((a) => (
                  <TableRow key={a.athletes_id}>
                    <TableCell className="font-mono">{a.bib_number ?? '—'}</TableCell>
                    <TableCell>{a.display_name ?? '—'}</TableCell>
                    <TableCell>{a.course_name ?? '—'}</TableCell>
                    <TableCell>{a.gender ?? '—'}</TableCell>
                    <TableCell>{a.last_status ?? '—'}</TableCell>
                    <TableCell>
                      {a.racekit_received ? '✓' : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next →
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-stone-500">
            Chưa có athlete nào. Click "Full sync now" để pull từ MySQL legacy.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
