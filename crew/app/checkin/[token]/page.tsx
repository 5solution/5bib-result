import type { Metadata } from "next";
import { getStatus } from "@/lib/api";
import CheckinButton from "./checkin-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const s = await getStatus(token);
    const title = `Check-in — ${s.full_name} · ${s.event_name}`;
    const description = `Check-in tại điểm tập trung sự kiện ${s.event_name}. Vai trò: ${s.role_name}.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Check-in",
      robots: { index: false, follow: false },
    };
  }
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let alreadyCheckedInAt: string | null = null;
  let fullName: string | undefined;
  let roleName: string | undefined;
  try {
    const status = await getStatus(token);
    alreadyCheckedInAt = status.checked_in_at;
    fullName = status.full_name;
    roleName = status.role_name;
  } catch {
    // Let the button page handle the error on submit — token may be
    // valid for check-in but status request had a blip.
  }

  if (alreadyCheckedInAt) {
    return (
      <div className="space-y-4">
        <section className="card border-green-300 bg-green-50">
          <h1 className="text-2xl font-bold text-green-800">
            ✅ Đã check-in lúc{" "}
            {new Date(alreadyCheckedInAt).toLocaleString("vi-VN")}
          </h1>
          {fullName ? (
            <p className="mt-2 text-sm text-green-700">
              {fullName}
              {roleName ? ` · ${roleName}` : ""}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-green-700">
            Không cần check-in lại. Hẹn gặp bạn tại sự kiện!
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 slide-up">
      <section className="card">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gradient">
          Check-in bằng vị trí
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Bấm nút dưới để trình duyệt chia sẻ vị trí GPS hiện tại. Hệ thống sẽ
          so sánh với địa điểm sự kiện và ghi nhận check-in nếu bạn đang ở
          trong phạm vi cho phép.
        </p>
      </section>
      <CheckinButton token={token} />
    </div>
  );
}
