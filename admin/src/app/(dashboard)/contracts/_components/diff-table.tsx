"use client";

/**
 * F-024 Diff Table — contract vs actual side-by-side, color coded.
 *
 * BR-CM-09: acceptance report có thể có thêm/bớt item so với contract. Hiển thị
 * 3 cột: HĐ / Thực tế / Chênh lệch. Color: green (giảm), red (tăng), neutral (=).
 *
 * Matching: theo `stt`. Item only in HĐ → đối ứng "—" cột actual; item only in
 * actual → "—" cột HĐ. Total row ở dưới.
 */
import { formatVND, type LineItemView, type AcceptanceActualItem } from "@/lib/contracts-api";

type Props = {
  contractItems: LineItemView[];
  actualItems: AcceptanceActualItem[];
};

export function DiffTable({ contractItems, actualItems }: Props) {
  const maxLen = Math.max(contractItems.length, actualItems.length);
  const rows = Array.from({ length: maxLen }, (_, i) => ({
    c: contractItems[i],
    a: actualItems[i],
  }));

  const contractTotal = contractItems.reduce((s, it) => s + (it.amount || 0), 0);
  const actualTotal = actualItems.reduce((s, it) => s + (it.amount || 0), 0);
  const diff = actualTotal - contractTotal;
  const diffColor =
    diff > 0 ? "text-red-700" : diff < 0 ? "text-green-700" : "text-stone-700";

  return (
    <div className="rounded-lg border border-[var(--border,#E7E2D9)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* UX-25: legend caption màu code */}
          <caption className="caption-top px-2 py-2 text-left text-xs text-[var(--text-muted,#78716C)]">
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm bg-green-600" />
                <span className="text-green-700">Xanh = giảm so với HĐ</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm bg-red-600" />
                <span className="text-red-700">Đỏ = tăng</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-sm bg-stone-400" />
                <span>Xám = không đổi</span>
              </span>
            </span>
          </caption>
          <thead className="bg-[#F3F0EB] text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted,#78716C)]">
            <tr>
              <th className="px-2 py-2 text-left">STT</th>
              <th className="px-2 py-2 text-left">Hợp đồng (Mô tả · SL · Đơn giá · Thành tiền)</th>
              <th className="px-2 py-2 text-left">Thực tế</th>
              <th className="px-2 py-2 text-right">Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 text-center text-[var(--text-muted,#78716C)]"
                >
                  Chưa có dữ liệu
                </td>
              </tr>
            )}
            {rows.map(({ c, a }, i) => {
              const cAmount = c?.amount ?? 0;
              const aAmount = a?.amount ?? 0;
              const rowDiff = aAmount - cAmount;
              const tone =
                rowDiff > 0
                  ? "text-red-700"
                  : rowDiff < 0
                    ? "text-green-700"
                    : "text-stone-500";
              return (
                <tr
                  key={i}
                  className="border-t border-[var(--border,#E7E2D9)]"
                >
                  <td className="px-2 py-2 font-mono">{i + 1}</td>
                  <td className="px-2 py-2">
                    {c ? (
                      <>
                        <div className="font-medium">{c.description}</div>
                        <div className="font-mono text-xs text-[var(--text-muted,#78716C)]">
                          {c.quantity} {c.unit} × {formatVND(c.unitPrice)} ={" "}
                          {formatVND(cAmount)}
                        </div>
                      </>
                    ) : (
                      <span className="text-[var(--text-muted,#78716C)]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {a ? (
                      <>
                        <div className="font-medium">{a.description}</div>
                        <div className="font-mono text-xs text-[var(--text-muted,#78716C)]">
                          {a.quantity} {a.unit} × {formatVND(a.unitPrice)} ={" "}
                          {formatVND(aAmount)}
                        </div>
                      </>
                    ) : (
                      <span className="text-[var(--text-muted,#78716C)]">—</span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono font-semibold ${tone}`}>
                    {rowDiff > 0 ? "+" : ""}
                    {formatVND(rowDiff)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-[#F3F0EB] text-sm font-semibold">
            <tr className="border-t border-[var(--border,#E7E2D9)]">
              <td className="px-2 py-3" colSpan={1}>
                Tổng
              </td>
              <td className="px-2 py-3 font-mono">
                {formatVND(contractTotal)}
              </td>
              <td className="px-2 py-3 font-mono">{formatVND(actualTotal)}</td>
              <td className={`px-2 py-3 text-right font-mono ${diffColor}`}>
                {diff > 0 ? "+" : ""}
                {formatVND(diff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
