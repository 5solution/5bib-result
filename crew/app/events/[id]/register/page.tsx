import { notFound } from "next/navigation";
import { getPublicEvent } from "@/lib/api";
import RegisterForm from "./register-form";

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
    <div className="space-y-5">
      <section className="card">
        <h1 className="text-2xl font-bold">{event.event_name}</h1>
        {event.location ? (
          <p className="text-sm text-[color:var(--color-muted)]">{event.location}</p>
        ) : null}
        <p className="text-sm mt-1">
          {event.event_start_date} → {event.event_end_date}
        </p>
        {event.description ? (
          <p className="text-sm mt-3 whitespace-pre-line">{event.description}</p>
        ) : null}
      </section>

      <RegisterForm event={event} />
    </div>
  );
}
