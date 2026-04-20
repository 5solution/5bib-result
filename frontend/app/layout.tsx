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
      appearance={{
        layout: {
          logoImageUrl: '/logo.png',
          logoLinkUrl: '/',
          socialButtonsVariant: 'iconButton',
        },
        variables: {
          colorPrimary: '#1d4ed8',
          colorText: '#1c1917',
          colorTextSecondary: '#64748b',
          colorBackground: '#ffffff',
          colorInputBackground: '#f8fafc',
          colorInputText: '#0f172a',
          borderRadius: '0.75rem',
          fontFamily: 'var(--font-sans), system-ui, sans-serif',
          fontFamilyButtons: 'var(--font-sans), system-ui, sans-serif',
        },
        elements: {
          card: 'shadow-xl border border-slate-200',
          headerTitle: 'text-xl font-extrabold tracking-tight',
          formButtonPrimary:
            'bg-blue-700 hover:bg-blue-800 text-white font-semibold normal-case text-sm tracking-normal',
          socialButtonsBlockButton:
            'border-slate-200 hover:bg-slate-50 text-slate-700',
          footerActionLink: 'text-blue-700 hover:text-blue-800 font-semibold',
          formFieldInput:
            'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20',
          identityPreviewEditButton: 'text-blue-700 hover:text-blue-800',
          logoBox: 'h-10',
          logoImage: 'h-10 w-auto',
        },
      }}
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
