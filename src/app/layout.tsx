import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Slime Soccer',
  description: 'Real-time PVP slime soccer — Telegram Mini App',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#2E1E72] text-white font-cartoon overflow-hidden">
        {children}
      </body>
    </html>
  )
}
