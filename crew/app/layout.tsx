import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_CREW_ORIGIN ?? "https://crew.5bib.com",
  ),
  title: {
    default: "5BIB Crew — Đăng ký nhân sự sự kiện",
    template: "%s · 5BIB Crew",
  },
  description:
    "Nền tảng đăng ký Leader / Crew / Tình nguyện viên cho các sự kiện chạy bộ 5BIB",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    siteName: "5BIB Crew",
    locale: "vi_VN",
    images: ["/logo_5BIB_white.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logo_5BIB_white.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0066FF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "#ffffff" }}>
        <header
          className="sticky top-0 z-50 border-b"
          style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <a href="/" className="flex items-center gap-3">
              <span
                className="grid size-9 place-items-center rounded-lg"
                style={{ background: "#2563eb" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo_5BIB_white.png"
                  alt="5BIB"
                  className="size-7 object-contain"
                />
              </span>
              <div>
                <p
                  className="font-display text-sm font-bold leading-tight"
                  style={{ color: "#111827" }}
                >
                  5BIB Crew
                </p>
                <p
                  className="text-[11px] leading-tight"
                  style={{ color: "#6b7280" }}
                >
                  Đăng ký tình nguyện viên
                </p>
              </div>
            </a>
            <nav className="text-sm" style={{ color: "#6b7280" }}>
              <a href="/" className="hover:underline">
                Sự kiện
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6 pb-24">{children}</main>
        <footer
          className="mx-auto max-w-3xl px-4 py-8 text-center text-xs"
          style={{ color: "var(--5bib-text-muted)" }}
        >
          © 2026 5BIB ·{" "}
          <a href="https://5bib.com" className="underline">
            5bib.com
          </a>
        </footer>
      </body>
    </html>
  );
}
