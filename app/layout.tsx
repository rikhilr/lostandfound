import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Search, Upload } from 'lucide-react'

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
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Search className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Lost & Found
              </span>
            </Link>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link href="/found" className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Report Found</span>
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/lost" className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span>Search Lost</span>
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

