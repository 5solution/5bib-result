import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Standalone kiosk layout — no global header/footer of result.5bib.com.
 * BR-10 + token URL leak: meta robots noindex; route response headers
 * are also set server-side by the backend.
 */
export const metadata: Metadata = {
  title: '5BIB Chip Verify — Bàn 2 Kiosk',
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ChipVerifyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 antialiased">
      {children}
    </div>
  );
}
