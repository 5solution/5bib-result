/**
 * FEATURE-056 — Hero Photo Layer (background photo + faded watermark distance).
 *
 * Server Component — absolute-fill background renderer.
 * PAUSE-56-11 A: Reuses existing race banner image (NOT a new asset pipeline).
 */

export interface HeroPhotoLayerProps {
  bannerUrl?: string | null;
  watermarkText?: string;
}

export default function HeroPhotoLayer({
  bannerUrl,
  watermarkText,
}: HeroPhotoLayerProps) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {bannerUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/50 to-slate-900/40" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #1B2238 0%, #2A3354 100%)',
          }}
        />
      )}

      {watermarkText ? (
        <span
          className="absolute right-4 md:right-8 font-heading font-black select-none pointer-events-none"
          style={{
            top: '25%',
            fontSize: 'clamp(80px, 14vw, 220px)',
            color: 'rgba(255,255,255,0.06)',
            letterSpacing: '-0.05em',
            lineHeight: 0.85,
          }}
        >
          {watermarkText}
        </span>
      ) : null}
    </div>
  );
}
