import type { Metadata } from 'next';
import { fetchRaceBySlug, fetchAthleteDetail, getRaceImage } from '@/lib/metadata';

type Props = {
  params: Promise<{ slug: string; bib: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, bib } = await params;
  const race = await fetchRaceBySlug(slug);

  if (!race) {
    return { title: `5BIB - VĐV #${bib}` };
  }

  const raceName = race.title || race.name || slug;
  const raceId = race._id || race.id;
  const athlete = raceId ? await fetchAthleteDetail(raceId, bib) : null;

  const athleteName = athlete?.Name
    ? athlete.Name.toLowerCase()
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : `BIB ${bib}`;

  const courseId = athlete?.course_id;
  const course = courseId
    ? (race.courses || []).find((c: any) => (c.courseId || c.id) === courseId)
    : null;
  const courseName = course?.name || course?.distance || athlete?.distance || '';

  const title = `5BIB - ${raceName} - ${athleteName}`;
  const description = courseName
    ? `Kết quả ${athleteName} - cự ly ${courseName} tại giải ${raceName}`
    : `Kết quả ${athleteName} tại giải ${raceName}`;

  const image = course?.imageUrl || getRaceImage(race);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image }],
      siteName: '5BIB',
      locale: 'vi_VN',
      type: 'website',
    },
  };
}

export default function AthleteLayout({ children }: Props) {
  return children;
}
