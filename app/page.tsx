import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Upload, Sparkles, Shield, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-muted/20">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,.1),rgba(255,255,255,0.5))]" />
        <div className="container relative flex flex-col items-center justify-center gap-8 px-4 py-24 md:py-32 lg:py-40">
          <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center animate-fade-in">
            <div className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-sm shadow-sm">
              <Sparkles className="mr-2 h-3 w-3 text-primary" />
              <span className="text-muted-foreground">Powered by AI</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              Never lose anything
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                ever again
              </span>
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground sm:text-xl">
              AI-powered matching technology reunites lost items with their owners.
              Upload found items or search for what you've lost—all in seconds.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="h-12 px-8 text-base">
                <Link href="/found">
                  <Upload className="mr-2 h-5 w-5" />
                  Report Found Item
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base">
                <Link href="/lost">
                  <Search className="mr-2 h-5 w-5" />
                  Search for Lost Item
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-24 md:py-32">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>AI-Powered Matching</CardTitle>
              <CardDescription>
                Advanced embeddings and vision AI automatically match lost items with found items
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Secure Verification</CardTitle>
              <CardDescription>
                Proof questions ensure only the rightful owner can claim their items
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 transition-all hover:shadow-lg">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Instant Results</CardTitle>
              <CardDescription>
                Get matches in seconds with our lightning-fast vector search technology
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t bg-muted/50 py-24 md:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-12">
              How It Works
            </h2>
            <div className="space-y-8 text-left">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Upload or Search</h3>
                  <p className="text-muted-foreground">
                    Found an item? Upload a photo. Lost something? Describe it in detail.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">AI Analysis</h3>
                  <p className="text-muted-foreground">
                    Our AI analyzes images, generates descriptions, and creates embeddings for matching.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Get Matched</h3>
                  <p className="text-muted-foreground">
                    Receive instant matches ranked by similarity. Answer a proof question to claim.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

