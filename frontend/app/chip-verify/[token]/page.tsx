import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { ChipVerifyKioskClient } from './components/ChipVerifyKioskClient';

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ device?: string }>;
}

/**
 * Server Component — validate token format + warm public stats endpoint.
 * Defers full data loading + interaction to ChipVerifyKioskClient (Client).
 *
 * Per Next.js 16: params + searchParams are async (Promise) — must await.
 */
export default async function ChipVerifyPage({
  params,
  searchParams,
}: Props) {
  const { token } = await params;
  const { device } = await searchParams;

  // Token format guard (defense in depth — BE guard also validates)
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
    notFound();
  }

  // Touch headers() so Next renders dynamically (token-based, never cache).
  await headers();

  return (
    <ChipVerifyKioskClient
      token={token}
      defaultDevice={typeof device === 'string' ? device.slice(0, 64) : ''}
    />
  );
}
