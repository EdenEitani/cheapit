import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CheapIt — Hotel Price Monitor',
  description: 'Track hotel bookings and get alerted when prices drop',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 font-sans">{children}</body>
    </html>
  )
}
