"use client";

/**
 * F-076 — MISA orphan collapse section.
 *
 * Default closed. Show count badge khi >0.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  formatVnd,
  type MisaOrphanRow,
} from "@/lib/invoice-reconcile-api";

interface Props {
  rows: MisaOrphanRow[];
}

export function MisaOrphanCollapse({ rows }: Props) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-stone-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-amber-700" />
          ) : (
            <ChevronRight className="h-4 w-4 text-amber-700" />
          )}
          <span className="text-sm font-semibold text-amber-900">
            MISA orphan: {rows.length} hóa đơn MISA xuất nhưng KHÔNG match
            orderId nào trong DB
          </span>
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left">RefID</th>
                <th className="px-3 py-2 text-left">InvNo</th>
                <th className="px-3 py-2 text-left">Series</th>
                <th className="px-3 py-2 text-left">InvDate</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Người mua</th>
                <th className="px-3 py-2 text-left">Item</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.refId} className="border-t border-stone-200">
                  <td className="px-3 py-2 font-mono text-xs">{row.refId}</td>
                  <td className="px-3 py-2 font-mono">{row.invNo}</td>
                  <td className="px-3 py-2 text-stone-600">
                    {row.invSeries ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-stone-600">
                    {row.invDate.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatVnd(row.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {row.buyerFullName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">
                    {row.itemName ?? row.itemCode ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
