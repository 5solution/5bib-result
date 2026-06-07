"use client";

/**
 * F-069 M3 — Bảng danh sách config quyền BTC.
 * Cột: User / Email / BTC (badge tenantNames) / Số giải / Quyền / Trạng thái / Actions.
 * Render từ AccessConfigListItemDto (đã denormalized tenantNames + raceCount).
 */
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccessConfigListItemDto } from "@/lib/api-generated/types.gen";
import {
  formatMerchantStatus,
  formatRaceCount,
  statusKeyFromActive,
} from "@/lib/merchant-portal-labels";
import { PermissionBadges } from "./permission-badge";

type Props = {
  items: AccessConfigListItemDto[];
  onEdit: (item: AccessConfigListItemDto) => void;
  onDelete: (item: AccessConfigListItemDto) => void;
};

export function AccessListTable({ items, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border,#E7E2D9)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Người dùng</TableHead>
            <TableHead>BTC được xem</TableHead>
            <TableHead className="whitespace-nowrap">Số giải</TableHead>
            <TableHead>Quyền</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const statusKey = statusKeyFromActive(item.isActive);
            return (
              <TableRow key={item.id}>
                <TableCell className="max-w-[220px]">
                  <div className="truncate font-medium" title={item.userName}>
                    {item.userName}
                  </div>
                  <div
                    className="truncate text-xs text-[var(--text-muted,#78716C)]"
                    title={item.email}
                  >
                    {item.email}
                  </div>
                </TableCell>
                <TableCell className="max-w-[260px]">
                  {item.tenantNames.length === 0 ? (
                    <span className="text-xs text-[var(--text-muted,#78716C)]">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {item.tenantNames.map((name, i) => (
                        <Badge key={`${item.id}-${i}`} variant="outline">
                          <span className="max-w-[180px] truncate" title={name}>
                            {name}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatRaceCount(item.raceCount)}
                </TableCell>
                <TableCell>
                  <PermissionBadges permissions={item.permissions} />
                </TableCell>
                <TableCell>
                  <Badge variant={statusKey === "active" ? "default" : "secondary"}>
                    {formatMerchantStatus(statusKey)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(item)}
                      aria-label={`Sửa ${item.userName}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item)}
                      aria-label={`Gỡ quyền ${item.userName}`}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
