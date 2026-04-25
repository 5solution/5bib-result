import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng ký thành công — 5BIB Crew",
};

/**
 * Post-registration success page.
 * Receives ?status=pending_approval|waitlisted from the register form
 * via router.push so we can show context-specific messaging.
 */
export default async function RegisterSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const status = sp.status ?? "pending_approval";
  const isWaitlisted = status === "waitlisted";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 slide-up">
      <div className="card w-full max-w-sm space-y-5 text-center">
        {/* Icon */}
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ background: isWaitlisted ? "#fef3c7" : "#dcfce7" }}
        >
          {isWaitlisted ? "⏳" : "✅"}
        </div>

        {/* Heading */}
        <div className="space-y-1.5">
          <h1
            className="font-display text-2xl font-bold"
            style={{ color: "#111827" }}
          >
            {isWaitlisted ? "Đã vào danh sách chờ!" : "Đăng ký thành công!"}
          </h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            {isWaitlisted
              ? "Vị trí bạn chọn đã đầy. Bạn đã được đưa vào danh sách chờ — nếu có chỗ trống, hệ thống sẽ tự động duyệt và gửi email thông báo cho bạn."
              : "Ban tổ chức sẽ xem xét đơn của bạn và gửi email hướng dẫn các bước tiếp theo sau khi được duyệt."}
          </p>
        </div>

        {/* What happens next */}
        <div
          className="rounded-xl border p-4 text-left space-y-2 text-sm"
          style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}
        >
          <p className="font-semibold text-gray-800">Tiếp theo bạn sẽ nhận:</p>
          <ol className="space-y-1.5 text-gray-600 list-none">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-green-600">1.</span>
              <span>Email xác nhận duyệt đơn từ ban tổ chức</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-green-600">2.</span>
              <span>Link ký hợp đồng tham gia (nếu có)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-green-600">3.</span>
              <span>Mã QR check-in trước ngày sự kiện</span>
            </li>
          </ol>
        </div>

        <p className="text-xs" style={{ color: "#9ca3af" }}>
          Kiểm tra hộp thư đến (và thư mục spam) của email bạn đăng ký.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="w-full rounded-xl py-3 text-center text-sm font-semibold text-white"
            style={{ background: "#1d4ed8" }}
          >
            Về trang chủ
          </Link>
          <Link
            href={`/events/${id}/register`}
            className="w-full rounded-xl border py-3 text-center text-sm font-medium"
            style={{ borderColor: "#d1d5db", color: "#374151" }}
          >
            Đăng ký thêm vai trò khác
          </Link>
        </div>
      </div>
    </div>
  );
}
