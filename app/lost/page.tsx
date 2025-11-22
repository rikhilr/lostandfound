'use client'

import { useState } from 'react'
import ResultCard from '@/components/ResultCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Search, Sparkles, AlertCircle, MapPin, Bell, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

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
  
  // Search State
  const [description, setDescription] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  
  // Alert State
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [contactInfo, setContactInfo] = useState('')
  const [alertImages, setAlertImages] = useState<File[]>([])
  
  // Claim State
  const [claimStatus, setClaimStatus] = useState<{ [key: string]: 'success' | 'error' | null }>({})

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setResults([])

    const trimmedDescription = description.trim()
    
    if (!trimmedDescription) {
      toast({
        title: "Missing Description",
        description: "Please describe your lost item",
        variant: "destructive",
      })
      return
    }

    // Security: Validate minimum length on frontend
    if (trimmedDescription.length < 5) {
      toast({
        title: "Description Too Short",
        description: "Please provide at least 5 characters with more details about your lost item.",
        variant: "destructive",
      })
      return
    }

    // Security: Require at least 2 meaningful words
    const words = trimmedDescription.split(/\s+/).filter(word => word.length > 2)
    if (words.length < 2) {
      toast({
        title: "Description Too Vague",
        description: "Please provide a more detailed description with at least 2 meaningful words.",
        variant: "destructive",
      })
      return
    }

    if (alertEnabled && !contactInfo.trim()) {
      toast({
        title: "Missing Contact Information",
        description: "Please provide your contact info to enable alerts",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)

    try {
      // 1. Perform search
      const searchResponse = await fetch('/api/search-lost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          description,
          location: searchLocation 
        }),
      })

      const searchData = await searchResponse.json()

      if (!searchResponse.ok) {
        throw new Error(searchData.error || 'Search failed')
      }

      setResults(searchData.results || [])

      // 2. If alert is enabled, create a lost item report
      if (alertEnabled && contactInfo.trim()) {
        try {
          const formData = new FormData()
          formData.append('description', description)
          formData.append('location', searchLocation)
          formData.append('contact_info', contactInfo)
          formData.append('alert_enabled', 'true')
          
          alertImages.forEach((image) => {
            formData.append('images', image)
          })

          const alertResponse = await fetch('/api/report-lost', {
            method: 'POST',
            body: formData,
          })

          if (alertResponse.ok) {
            const alertData = await alertResponse.json()
            const notificationUrl = alertData.notificationUrl
            
            if (notificationUrl) {
              // Copy URL to clipboard
              const fullUrl = `${window.location.origin}${notificationUrl}`
              navigator.clipboard.writeText(fullUrl).catch(() => {})
              
              toast({
                title: "Alert Set! 🔔",
                description: `We'll notify you if someone finds a matching item. Your notification link has been copied to clipboard - save it to check for matches!`,
                duration: 10000,
              })
            } else {
              toast({
                title: "Alert Set! 🔔",
                description: "We'll notify you if someone finds a matching item.",
              })
            }
          }
        } catch (alertErr) {
          console.error('Failed to set alert:', alertErr)
          // Don't fail the search if alert creation fails
        }
      }

      if (searchData.results?.length === 0) {
        toast({
          title: alertEnabled ? "No Matches Found - Alert Set" : "No Matches Found",
          description: alertEnabled 
            ? "We'll notify you if a matching item is found."
            : "Try a more detailed description or enable alerts to get notified.",
          variant: "default",
        })
      } else {
        toast({
          title: "Search Complete",
          description: `Found ${searchData.results?.length || 0} potential match${searchData.results?.length !== 1 ? 'es' : ''}${alertEnabled ? ' - Alert also set!' : ''}`,
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


  const handleClaim = async (itemId: string, claimerContact: string) => {
    try {
      const response = await fetch('/api/claim-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          claimerContact,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Claim failed')
      }

      setClaimStatus({ ...claimStatus, [itemId]: 'success' })
      // Show a simple success message with contact info
      toast({
        title: "Item Claimed!",
        description: `Contact the finder at: ${data.finderContact}`,
        duration: 5000,
      })
    } catch (err) {
      setClaimStatus({ ...claimStatus, [itemId]: 'error' })
      toast({
        title: "Claim Failed",
        description: err instanceof Error ? err.message : 'Please try again.',
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
            Search Description
          </CardTitle>
          <CardDescription>
            Be as detailed as possible. Our AI will match your description to found items.
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
                placeholder="e.g., A black leather wallet with a red stripe, containing a driver's license..."
                rows={5}
                className="resize-none"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-location">Location Lost (Optional)</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-location"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder="e.g. Central Park, Subway..."
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Adding a location helps AI filter relevant items
              </p>
            </div>

            {/* Alert Toggle Section */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="alert-toggle" className="flex items-center gap-2 cursor-pointer">
                  <Bell className="h-4 w-4" />
                  Alert me if found
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified automatically when someone finds a matching item
                </p>
              </div>
              <Switch
                id="alert-toggle"
                checked={alertEnabled}
                onCheckedChange={setAlertEnabled}
              />
            </div>

            {/* Conditional fields when alert is enabled */}
            {alertEnabled && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Email/Phone *</Label>
                  <Input 
                    id="contact" 
                    placeholder="email@example.com or phone number"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    required={alertEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll use this to contact you if someone finds your item.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert-images">Images (Optional)</Label>
                  <Input
                    id="alert-images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      setAlertImages(files)
                    }}
                  />
                  {alertImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {alertImages.map((file, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${idx + 1}`}
                            className="h-20 w-20 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = alertImages.filter((_, i) => i !== idx)
                              setAlertImages(newImages)
                            }}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Upload multiple images to help identify your item
                  </p>
                </div>
              </div>
            )}

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
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Enter a detailed description above and click search to find matching items. Enable "Alert me if found" to get notified when someone finds your item.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}