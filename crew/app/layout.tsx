import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "5BIB Crew — Đăng ký nhân sự sự kiện",
  description:
    "Nền tảng đăng ký Leader / Crew / Tình nguyện viên cho các sự kiện chạy bộ 5BIB",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <a href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-[color:var(--color-accent)] text-white">
                5B
              </span>
              <span>5BIB Crew</span>
            </a>
            <nav className="text-sm text-[color:var(--color-muted)]">
              <a href="/" className="hover:underline">
                Sự kiện
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6 pb-24">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-[color:var(--color-muted)]">
          © 2026 5BIB · <a href="https://5bib.com" className="underline">5bib.com</a>
        </footer>
      </body>
    </html>
  );
}
