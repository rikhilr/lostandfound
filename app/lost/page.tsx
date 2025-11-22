'use client'

import { useState } from 'react'
import ResultCard from '@/components/ResultCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Search, Sparkles, AlertCircle } from 'lucide-react'

interface SearchResult {
  id: string
  image_url: string
  auto_title: string
  auto_description: string
  location: string
  created_at: string
  proof_question: string
  similarity: number
}

export default function LostPage() {
  const { toast } = useToast()
  const [description, setDescription] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [claimStatus, setClaimStatus] = useState<{ [key: string]: 'success' | 'error' | null }>({})

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setResults([])

    if (!description.trim()) {
      toast({
        title: "Missing Description",
        description: "Please describe your lost item",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)

    try {
      const response = await fetch('/api/search-lost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setResults(data.results || [])
      if (data.results?.length === 0) {
        toast({
          title: "No Matches Found",
          description: "Try a more detailed description to improve results",
          variant: "default",
        })
      } else {
        toast({
          title: "Search Complete",
          description: `Found ${data.results?.length || 0} potential match${data.results?.length !== 1 ? 'es' : ''}`,
        })
      }
    } catch (err) {
      toast({
        title: "Search Error",
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleClaim = async (itemId: string, proofAnswer: string) => {
    try {
      const response = await fetch('/api/claim-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          proofAnswer,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Claim failed')
      }

      setClaimStatus({ ...claimStatus, [itemId]: 'success' })
      toast({
        title: "Match Confirmed! 🎉",
        description: data.contactInfo || 'Contact information will be sent to your email.',
      })
    } catch (err) {
      setClaimStatus({ ...claimStatus, [itemId]: 'error' })
      toast({
        title: "Verification Failed",
        description: err instanceof Error ? err.message : 'Please check your answer and try again.',
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container max-w-7xl py-12 md:py-24">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
          Search for Lost Item
        </h1>
        <p className="text-lg text-muted-foreground">
          Describe what you lost and let AI find it for you
        </p>
      </div>

      <Card className="border-2 mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Item Description
          </CardTitle>
          <CardDescription>
            Be as detailed as possible. Our AI will match your description to found items using advanced embeddings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Describe Your Lost Item</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., A black leather wallet with a red stripe, containing a driver's license and credit cards. The wallet has a zipper closure and a small logo on the front..."
                rows={6}
                className="resize-none"
                required
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Include details like color, size, brand, unique features, and contents
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSearching}
              size="lg"
              className="w-full"
            >
              {isSearching ? (
                <>
                  <Search className="mr-2 h-4 w-4 animate-pulse" />
                  Searching with AI...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search for Matches
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight">
              {results.length} Potential Match{results.length !== 1 ? 'es' : ''} Found
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Ranked by similarity
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((item, index) => (
              <div key={item.id} style={{ animationDelay: `${index * 100}ms` }} className="animate-fade-in">
                <ResultCard
                  item={item}
                  onClaim={handleClaim}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !isSearching && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No search results yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Enter a detailed description above and click search to find matching items
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

