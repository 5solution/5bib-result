import type { Metadata } from 'next'
import { Inter, Be_Vietnam_Pro } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SponsorSidebar from '@/components/SponsorSidebar'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
})

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-heading',
})

export const metadata: Metadata = {
  title: '5BIB - Kết quả giải chạy trực tiếp',
  description: 'Theo dõi kết quả, xếp hạng và thành tích của bạn trên nền tảng 5BIB',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${beVietnamPro.variable}`}>
      <body className="font-sans antialiased bg-[var(--5bib-bg)] text-[var(--5bib-text)] min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <SponsorSidebar />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--5bib-surface)',
              color: 'var(--5bib-text)',
              border: '1px solid var(--5bib-border)',
            },
          }}
        />
      </body>
    </html>
  )
}
