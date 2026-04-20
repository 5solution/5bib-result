import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from 'next/font/google'
import { Toaster } from 'sonner'
import { ClerkProvider } from '@clerk/nextjs'
import { viVN } from '@clerk/localizations'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { QueryProvider } from '@/lib/query-provider'
import I18nProvider from '@/components/I18nProvider'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
})

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-heading',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://result.5bib.com'),
  title: '5BIB - Kết quả giải chạy trực tiếp',
  description: 'Theo dõi kết quả, xếp hạng và thành tích của bạn trên nền tảng 5BIB',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: '5BIB - Kết quả giải chạy trực tiếp',
    description: 'Theo dõi kết quả, xếp hạng và thành tích của bạn trên nền tảng 5BIB',
    images: [{ url: '/logo.png', width: 1024, height: 1024 }],
    siteName: '5BIB',
    locale: 'vi_VN',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '5BIB',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#1e1b4b',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      localization={viVN}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/account"
    >
      <html lang="vi" className={`${plusJakarta.variable} ${beVietnamPro.variable}`}>
        <body className="font-sans antialiased bg-[var(--5bib-bg)] text-[var(--5bib-text)] min-h-screen flex flex-col">
          <I18nProvider>
          <QueryProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </QueryProvider>
          </I18nProvider>
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
    </ClerkProvider>
  )
}
