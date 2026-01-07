import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import I18nProvider from '@/components/I18nProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: '5BIB Race Results - Live Leaderboard',
  description: 'Real-time race results and leaderboard for elite athletes',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.NodeNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-display antialiased`}>
        <I18nProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}
