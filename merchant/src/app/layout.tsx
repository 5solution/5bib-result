import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { QueryProvider } from "@/lib/query-provider";
import { LangProvider } from "@/lib/mp/lang-context";
import { beVietnamPro, plusJakartaSans, jetBrainsMono, notoSansKhmer, notoSansLao } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "5BIB Merchant Portal",
  description: "Cổng báo cáo dành cho Ban tổ chức giải chạy — 5BIB Merchant Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable} ${notoSansKhmer.variable} ${notoSansLao.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <QueryProvider>
          <AuthProvider>
            <LangProvider>{children}</LangProvider>
          </AuthProvider>
        </QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
