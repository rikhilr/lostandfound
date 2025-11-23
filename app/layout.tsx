import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Space_Grotesk } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Lost & Found - AI-Powered Item Recovery',
  description: 'Find your lost items or report found items with AI-powered matching',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <body className={`antialiased ${spaceGrotesk.variable} font-sans`}>
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-semibold">
              Lost & Found
            </Link>
            <div className="flex items-center space-x-6">
              <Button variant="ghost" asChild className="hover:bg-muted">
                <Link href="/found">
                  Report Found
                </Link>
              </Button>
              <Button variant="ghost" asChild className="hover:bg-muted">
                <Link href="/lost">
                  Search Lost
                </Link>
              </Button>
            </div>
          </div>
        </nav>
        <main className="min-h-screen">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}

