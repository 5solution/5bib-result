import { redirect } from "next/navigation";

export default async function EventIndex({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<never> {
  const { eventId } = await params;
  redirect(`/team-management/${eventId}/dashboard`);
}
