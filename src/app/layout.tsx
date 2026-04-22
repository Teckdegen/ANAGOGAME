import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Slime Soccer',
  description: 'Real-time PVP slime soccer — Telegram Mini App',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Portrait lock — shown when phone is vertical */}
        <div id="portrait-lock">
          <div className="rotate-icon">↻</div>
          <p>Rotate your phone to landscape to play!</p>
        </div>
        {children}
      </body>
    </html>
  )
}
