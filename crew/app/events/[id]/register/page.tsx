import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEvent } from "@/lib/api";
import RegisterForm from "./register-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const eventId = Number(id);
  if (Number.isNaN(eventId)) return { title: "Sự kiện" };
  try {
    const ev = await getPublicEvent(eventId);
    const title = `Đăng ký nhân sự — ${ev.event_name}`;
    const description = ev.description
      ? `${ev.description}`
      : `Đăng ký vai trò Leader / Crew / TNV cho sự kiện ${ev.event_name} trên 5BIB.`;
    return {
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
    };
  } catch {
    return { title: "Sự kiện không tìm thấy" };
  }
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  if (Number.isNaN(eventId)) notFound();

  let event;
  try {
    event = await getPublicEvent(eventId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-5 slide-up">
      <section className="card">
        <h1
          className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ color: "#111827" }}
        >
          {event.event_name}
        </h1>
        {event.location ? (
          <p className="text-sm" style={{ color: "#6b7280" }}>{event.location}</p>
        ) : null}
        <p className="text-sm mt-1">
          {event.event_start_date} → {event.event_end_date}
        </p>
        {event.description ? (
          <p className="text-sm mt-3 whitespace-pre-line">{event.description}</p>
        ) : null}
      </section>

      {event.benefits_image_url ? (
        <section className="card overflow-hidden">
          <h2 className="font-semibold text-base mb-3" style={{ color: "#111827" }}>
            Quyền lợi khi tham gia
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.benefits_image_url}
            alt={`Quyền lợi khi tham gia ${event.event_name}`}
            className="w-full h-auto rounded-lg border"
            loading="lazy"
          />
        </section>
      ) : null}

      <RegisterForm event={event} />
    </div>
  );
}
