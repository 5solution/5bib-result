const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

export async function fetchRaceBySlug(slug: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/races/slug/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json ?? null;
  } catch {
    return null;
  }
}

export async function fetchAthleteDetail(raceId: string, bib: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/race-results/athlete/${raceId}/${bib}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json ?? null;
  } catch {
    return null;
  }
}

export function getRaceImage(race: any): string {
  return race?.imageUrl || race?.logoUrl || '/logo.png';
}

export function getCourseImage(course: any, race: any): string {
  return course?.imageUrl || getRaceImage(race);
}
