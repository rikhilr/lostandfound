import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import Image from 'next/image' // 1. Import the Image component
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Space_Grotesk } from 'next/font/google'
import Script from "next/script";

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GetHub',
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
      <Script
    src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&libraries=places`}
    strategy="afterInteractive"
    
  />
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="container flex h-16 items-center justify-between">
            
            {/* 2. Updated Logo Section */}
            <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
              <Image 
                src="/logo.png" 
                alt="GetHub Logo" 
                width={32} 
                height={32} 
                className="rounded-full dark:invert" // Optional: Inverts colors in dark mode if the logo is black with transparent bg
              />
              <span>GetHub</span>
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