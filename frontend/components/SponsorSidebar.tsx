'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { useSponsors } from '@/lib/api-hooks'

interface Sponsor {
  _id: string
  name: string
  logoUrl: string
  website?: string
  level: 'silver' | 'gold' | 'diamond'
  order: number
}

const LOGO_SIZES: Record<Sponsor['level'], { width: number; height: number }> = {
  diamond: { width: 56, height: 56 },
  gold: { width: 44, height: 44 },
  silver: { width: 34, height: 34 },
}

export default function SponsorSidebar() {
  const { data: sponsorsRaw } = useSponsors()

  const sponsors = useMemo(() => {
    const list: Sponsor[] = (sponsorsRaw as any)?.data ?? sponsorsRaw ?? []
    if (!Array.isArray(list) || list.length === 0) return []
    const priority: Record<string, number> = { diamond: 0, gold: 1, silver: 2 }
    return [...list].sort(
      (a, b) => (priority[a.level] ?? 9) - (priority[b.level] ?? 9) || a.order - b.order,
    )
  }, [sponsorsRaw])

  if (sponsors.length === 0) return null

  // Duplicate the list so the marquee can loop seamlessly
  const duplicated = [...sponsors, ...sponsors]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sponsor-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}} />

      <aside
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center
                   w-[64px] max-h-[80vh] overflow-hidden rounded-l-lg
                   bg-black/30 backdrop-blur-sm border-l border-t border-b border-white/10"
      >
        <div
          className="flex flex-col items-center gap-3 py-3"
          style={{
            animation: `sponsor-scroll ${sponsors.length * 4}s linear infinite`,
          }}
        >
          {duplicated.map((sponsor, idx) => {
            const key = `${sponsor._id}-${idx}`
            const size = LOGO_SIZES[sponsor.level]
            const logoBox = (
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-md bg-white/90 p-1 transition-opacity hover:opacity-80"
                style={{ width: size.width, height: size.height }}
                title={sponsor.name}
              >
                <Image
                  src={sponsor.logoUrl}
                  alt={sponsor.name}
                  width={size.width - 8}
                  height={size.height - 8}
                  className="object-contain"
                  unoptimized
                />
              </div>
            )

            return sponsor.website ? (
              <a
                key={key}
                href={sponsor.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {logoBox}
              </a>
            ) : (
              <div key={key}>{logoBox}</div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
