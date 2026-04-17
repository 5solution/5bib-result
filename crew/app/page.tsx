import Link from "next/link";
import { listPublicEvents, type PublicEvent } from "@/lib/api";

export const revalidate = 60;

export default async function HomePage() {
  let events: PublicEvent[] = [];
  let error: string | null = null;
  try {
    events = await listPublicEvents();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-extrabold">Tham gia đội ngũ 5BIB</h1>
        <p className="text-[color:var(--color-muted)]">
          Đăng ký làm Leader / Crew / Tình nguyện viên cho các sự kiện chạy bộ.
          Sau khi đăng ký, bạn sẽ nhận email xác nhận kèm mã QR check-in.
        </p>
      </section>

      {error ? (
        <div className="card border-red-300 bg-red-50 text-sm text-red-700">
          Không tải được danh sách sự kiện: {error}
        </div>
      ) : null}

      {events.length === 0 && !error ? (
        <div className="card text-center text-[color:var(--color-muted)]">
          Chưa có sự kiện nào đang mở đăng ký. Hãy quay lại sau!
        </div>
      ) : null}

      <div className="space-y-4">
        {events.map((e) => {
          const totalSlots = e.roles.reduce((s, r) => s + r.max_slots, 0);
          const filled = e.roles.reduce((s, r) => s + r.filled_slots, 0);
          return (
            <Link
              key={e.id}
              href={`/events/${e.id}/register`}
              className="card block transition hover:border-[color:var(--color-accent)] hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{e.event_name}</h2>
                  {e.location ? (
                    <p className="text-sm text-[color:var(--color-muted)]">
                      {e.location}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm">
                    {e.event_start_date} → {e.event_end_date}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">
                    {filled} / {totalSlots}
                  </div>
                  <div className="text-xs text-[color:var(--color-muted)]">
                    slot đã duyệt
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {e.roles.map((r) => (
                  <span
                    key={r.id}
                    className={`chip ${r.is_full ? "chip-rejected" : "chip-approved"}`}
                  >
                    {r.role_name} · {r.max_slots - r.filled_slots} trống
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
