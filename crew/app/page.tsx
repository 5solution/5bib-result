import Link from "next/link";
import { listPublicEvents, type PublicEvent } from "@/lib/api";

export const revalidate = 60;

// Role tag + slot label per DesignCorrection v2: neutral slate tag, only
// slot count carries urgency color.
function RoleTag({ role }: { role: PublicEvent["roles"][number] }) {
  const available =
    role.max_slots > 0 ? role.max_slots - role.filled_slots : null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
      style={{
        background: "#f1f5f9",
        color: "#374151",
        borderColor: "#e2e8f0",
      }}
    >
      {role.role_name}
      <span style={{ color: "#cbd5e1" }}>·</span>
      <SlotLabel
        available={available}
        waitlist={role.waitlist_enabled}
      />
    </span>
  );
}

function SlotLabel({
  available,
  waitlist,
}: {
  available: number | null;
  waitlist: boolean;
}) {
  if (available === null)
    return <span style={{ color: "#6b7280" }}>Không giới hạn</span>;
  if (available <= 0 && waitlist)
    return (
      <span style={{ color: "#d97706", fontWeight: 600 }}>Waitlist</span>
    );
  if (available <= 0)
    return <span style={{ color: "#dc2626", fontWeight: 600 }}>Hết chỗ</span>;
  return <span style={{ color: "#6b7280" }}>{available} trống</span>;
}

export default async function HomePage() {
  let events: PublicEvent[] = [];
  let error: string | null = null;
  try {
    events = await listPublicEvents();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-6 slide-up">
      <section className="space-y-2">
        <h1
          className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight"
          style={{ color: "#111827" }}
        >
          Tham gia đội ngũ 5BIB
        </h1>
        <p style={{ color: "#6b7280" }}>
          Đăng ký làm Leader / Crew / Tình nguyện viên cho các sự kiện chạy bộ.
          Sau khi đăng ký, bạn sẽ nhận email xác nhận kèm mã QR check-in.
        </p>
        <p className="text-sm">
          <Link
            href="/recover"
            className="text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            Mất link truy cập? Khôi phục bằng email →
          </Link>
        </p>
      </section>

      {error ? (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{
            background: "#fee2e2",
            borderColor: "#fca5a5",
            color: "#b91c1c",
          }}
        >
          Không tải được danh sách sự kiện: {error}
        </div>
      ) : null}

      {events.length === 0 && !error ? (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{
            background: "#ffffff",
            borderColor: "#e5e7eb",
            color: "#6b7280",
          }}
        >
          Chưa có sự kiện nào đang mở đăng ký. Hãy quay lại sau!
        </div>
      ) : null}

      <div className="space-y-4 stagger-in">
        {events.map((e) => {
          const totalSlots = e.roles.reduce((s, r) => s + r.max_slots, 0);
          const filled = e.roles.reduce((s, r) => s + r.filled_slots, 0);
          return (
            <Link
              key={e.id}
              href={`/events/${e.id}/register`}
              className="block rounded-2xl border p-5 transition-shadow hover:shadow-md"
              style={{
                background: "#ffffff",
                borderColor: "#e5e7eb",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ color: "#111827" }}
                  >
                    {e.event_name}
                  </h2>
                  {e.location ? (
                    <p className="text-sm" style={{ color: "#6b7280" }}>
                      {e.location}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm" style={{ color: "#374151" }}>
                    {e.event_start_date} → {e.event_end_date}
                  </p>
                </div>
                <span
                  className="text-sm font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
                  style={{ background: "#eff6ff", color: "#2563eb" }}
                >
                  {filled}/{totalSlots} slot đã duyệt
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {e.roles.map((r) => (
                  <RoleTag key={r.id} role={r} />
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
