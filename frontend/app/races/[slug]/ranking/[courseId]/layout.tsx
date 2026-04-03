import type { Metadata } from 'next';
import { fetchRaceBySlug, getCourseImage } from '@/lib/metadata';

type Props = {
  params: Promise<{ slug: string; courseId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, courseId } = await params;
  const race = await fetchRaceBySlug(slug);

  if (!race) {
    return { title: '5BIB - Xếp hạng' };
  }

  const raceName = race.title || race.name || slug;
  const course = (race.courses || []).find(
    (c: any) => (c.courseId || c.id) === courseId,
  );
  const courseName = course?.name || course?.distance || courseId;
  const title = `5BIB - ${courseName} - ${raceName}`;
  const description = `Bảng xếp hạng cự ly ${courseName} tại giải ${raceName}`;
  const image = getCourseImage(course, race);

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

export default function CourseRankingLayout({ children }: Props) {
  return children;
}
