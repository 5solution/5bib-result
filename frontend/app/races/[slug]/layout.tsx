import type { Metadata } from 'next';
import { fetchRaceBySlug, getRaceImage } from '@/lib/metadata';

type Props = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const race = await fetchRaceBySlug(slug);

  if (!race) {
    return { title: '5BIB - Giải đấu' };
  }

  const raceName = race.title || race.name || slug;
  const title = `5BIB - ${raceName}`;
  const description = race.description || `Kết quả và xếp hạng giải ${raceName} trên nền tảng 5BIB`;
  const image = getRaceImage(race);

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

export default function RaceLayout({ children }: Props) {
  return children;
}
