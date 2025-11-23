'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Search, Upload, ArrowRight } from 'lucide-react'
import ScrollAnimation from '@/components/ScrollAnimation'
import MatchingAnimation from '@/components/MatchingAnimation'

export default function Home() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="flex flex-col bg-background">
      {/* Hero Section - Scale AI style two-column layout */}
      <section className="relative overflow-hidden min-h-[85vh] sm:min-h-[90vh] flex items-center border-b">
        <div className="container px-4 sm:px-6 py-16 sm:py-24 md:py-32">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center max-w-7xl mx-auto">
            {/* Left Column - Content */}
            <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="space-y-6">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-foreground">
                  Reconnect lost items
                  <br />
                  <span className="text-foreground/80">with their owners</span>
                </h1>
                <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-xl">
                  AI-powered matching technology finds what&apos;s lost. Upload found items or search for what you&apos;ve lost—all in seconds.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button 
                  size="lg" 
                  asChild 
                  className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base bg-foreground text-background hover:bg-foreground/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Link href="/found" className="flex items-center gap-2">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                    Report Found Item
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  asChild 
                  className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base border-2 hover:bg-muted transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Link href="/lost" className="flex items-center gap-2">
                    <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                    Search Lost Item
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative hidden lg:block">
              <div className="relative w-full aspect-square flex items-center justify-center">
                <div className="relative w-96 h-96">
                  <MatchingAnimation />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Clean and minimal */}
      <section className="container py-16 sm:py-24 md:py-32 border-b px-4">
        <div className="mx-auto max-w-5xl">
          <ScrollAnimation>
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                How it works
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground">
                Three simple steps to reconnect with your belongings
              </p>
            </div>
          </ScrollAnimation>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 1 */}
            <ScrollAnimation delay={100}>
              <div className="space-y-4 group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary text-xl font-bold border border-primary/20 group-hover:border-primary/40 transition-colors">
                  1
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold">Upload or Search</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Found an item? Take a photo. Lost something? Describe it with details.
                </p>
              </div>
            </ScrollAnimation>

            {/* Step 2 */}
            <ScrollAnimation delay={200}>
              <div className="space-y-4 group hover:scale-[1.02] transition-transform duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary text-xl font-bold border border-primary/20 group-hover:border-primary/40 transition-colors">
                  2
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold">AI Finds Matches</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Our system analyzes visual features and descriptions to find potential matches instantly.
                </p>
              </div>
            </ScrollAnimation>

            {/* Step 3 */}
            <ScrollAnimation delay={300}>
              <div className="space-y-4 group hover:scale-[1.02] transition-transform duration-300 sm:col-span-2 lg:col-span-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary text-xl font-bold border border-primary/20 group-hover:border-primary/40 transition-colors">
                  3
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold">Reconnect</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  View ranked matches and contact the finder or claim your item.
                </p>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>
    </div>
  )
}
