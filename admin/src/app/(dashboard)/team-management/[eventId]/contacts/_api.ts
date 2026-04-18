// Inline fetch helpers for v1.5 Emergency Contacts admin endpoints.
// Kept local (not in team-api.ts) so we don't collide with the backend agent's
// SDK helpers. Once `listEventContacts` et al. exist in team-api.ts, migrate.

import type { EventContact, UpsertContactInput } from "./_types";

function authedHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body.message) {
      message = Array.isArray(body.message) ? body.message.join("; ") : body.message;
    }
  } catch {
    /* ignore */
  }
  throw new Error(message);
}

export async function listEventContacts(
  token: string,
  eventId: number,
): Promise<EventContact[]> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/contacts`,
    { headers: authedHeaders(token), cache: "no-store" },
  );
  await assertOk(res);
  const body = (await res.json()) as EventContact[] | { data: EventContact[] };
  return Array.isArray(body) ? body : body.data;
}

export async function createEventContact(
  token: string,
  eventId: number,
  input: UpsertContactInput,
): Promise<EventContact> {
  const res = await fetch(
    `/api/team-management/events/${eventId}/contacts`,
    {
      method: "POST",
      headers: authedHeaders(token),
      body: JSON.stringify(input),
    },
  );
  await assertOk(res);
  return res.json();
}

export async function updateEventContact(
  token: string,
  id: number,
  patch: Partial<UpsertContactInput>,
): Promise<EventContact> {
  const res = await fetch(`/api/team-management/contacts/${id}`, {
    method: "PATCH",
    headers: authedHeaders(token),
    body: JSON.stringify(patch),
  });
  await assertOk(res);
  return res.json();
}

export async function toggleEventContactActive(
  token: string,
  id: number,
): Promise<EventContact> {
  const res = await fetch(
    `/api/team-management/contacts/${id}/toggle-active`,
    { method: "PATCH", headers: authedHeaders(token) },
  );
  await assertOk(res);
  return res.json();
}

export async function deleteEventContact(
  token: string,
  id: number,
): Promise<void> {
  const res = await fetch(`/api/team-management/contacts/${id}`, {
    method: "DELETE",
    headers: authedHeaders(token),
  });
  await assertOk(res);
}
