import { getStatus } from "@/lib/api";

export default async function StatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let status;
  let errorMessage: string | null = null;
  try {
    status = await getStatus(token);
  } catch (e) {
    errorMessage = (e as Error).message;
  }

  if (errorMessage || !status) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold">Không tìm thấy thông tin</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          {errorMessage ?? "Link không hợp lệ hoặc đã hết hạn."}
        </p>
      </div>
    );
  }

  const statusChip =
    status.status === "approved"
      ? "chip chip-approved"
      : status.status === "waitlisted"
        ? "chip chip-waitlist"
        : "chip chip-rejected";

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{status.full_name}</h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              {status.role_name} · {status.event_name}
            </p>
          </div>
          <span className={statusChip}>
            {labelForStatus(status.status)}
            {status.status === "waitlisted" && status.waitlist_position
              ? ` · #${status.waitlist_position}`
              : ""}
          </span>
        </div>

        {status.qr_code ? (
          <div className="flex flex-col items-center gap-2 pt-3">
            <img
              src={status.qr_code}
              alt="QR check-in"
              width={220}
              height={220}
              className="rounded-lg border"
            />
            <p className="text-xs text-[color:var(--color-muted)]">
              Đưa mã QR này để check-in vào ngày vận hành.
            </p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Tình trạng hợp đồng</h2>
        <p className="text-sm">{labelForContract(status.contract_status)}</p>
      </section>

      {status.checked_in_at ? (
        <section className="card border-green-300 bg-green-50">
          <h2 className="font-semibold text-green-800">Đã check-in</h2>
          <p className="text-sm text-green-700">{new Date(status.checked_in_at).toLocaleString("vi-VN")}</p>
        </section>
      ) : null}
    </div>
  );
}

function labelForStatus(s: string): string {
  switch (s) {
    case "approved":
      return "Đã duyệt";
    case "waitlisted":
      return "Danh sách chờ";
    case "rejected":
      return "Từ chối";
    case "cancelled":
      return "Đã hủy";
    default:
      return s;
  }
}

function labelForContract(s: string): string {
  switch (s) {
    case "not_sent":
      return "Chưa gửi hợp đồng";
    case "sent":
      return "Đã gửi hợp đồng — chờ bạn ký";
    case "signed":
      return "Đã ký hợp đồng";
    case "expired":
      return "Link hợp đồng đã hết hạn";
    default:
      return s;
  }
}
