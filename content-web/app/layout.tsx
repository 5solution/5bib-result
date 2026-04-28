import type { Metadata } from "next";
import Script from "next/script";
import { Be_Vietnam_Pro, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Trung tâm trợ giúp 5BIB",
    template: "%s · 5BIB Help Center",
  },
  description:
    "Hướng dẫn, tin tức và mọi thứ bạn cần để chạy giải tự tin hơn — từ đăng ký đến nhận BIB và certificate.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "5BIB Help Center",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${plusJakarta.variable} ${jbMono.variable}`}
    >
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        {/* Zalo OA chat widget — sitewide */}
        <div
          className="zalo-chat-widget"
          data-oaid="1496901851017205971"
          data-welcome-message="Rất vui khi được hỗ trợ bạn!"
          data-autopopup="0"
          data-width=""
          data-height=""
        />
        <Script
          src="https://sp.zalo.me/plugins/sdk.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
