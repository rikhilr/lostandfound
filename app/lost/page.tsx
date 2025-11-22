'use client'

import { useState } from 'react'
import ResultCard from '@/components/ResultCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Search, Sparkles, AlertCircle, FileText, MapPin, Bell, X } from 'lucide-react'
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
  
  // Claim State
  const [claimStatus, setClaimStatus] = useState<{ [key: string]: 'success' | 'error' | null }>({})

  // Report State
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportDescription, setReportDescription] = useState('')
  const [reportLocation, setReportLocation] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [reportImages, setReportImages] = useState<File[]>([])

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
        body: JSON.stringify({ 
          description,
          location: searchLocation 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setResults(data.results || [])
      if (data.results?.length === 0) {
        toast({
          title: "No Matches Found",
          description: "Try a more detailed description or report your item as lost.",
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

  const handleReportLost = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!reportDescription || !contactInfo) {
      toast({
        title: "Missing Information",
        description: "Description and contact info are required.",
        variant: "destructive",
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append('description', reportDescription)
      formData.append('location', reportLocation)
      formData.append('contact_info', contactInfo)
      formData.append('alert_enabled', alertEnabled.toString())
      
      // Add images
      reportImages.forEach((image) => {
        formData.append('images', image)
      })

      const response = await fetch('/api/report-lost', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to report item')

      toast({
        title: "Item Reported",
        description: alertEnabled 
          ? "We'll notify you if a matching item is found!" 
          : "Your item has been reported.",
      })
      setShowReportForm(false)
      // Reset form
      setReportDescription('')
      setReportLocation('')
      setContactInfo('')
      setAlertEnabled(true)
      setReportImages([])
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not report item. Please try again.",
        variant: "destructive",
      })
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
      toast({
        title: "Item Claimed! 🎉",
        description: (
          <div className="mt-2">
            <p className="mb-2">Contact the finder:</p>
            <a 
              href={`mailto:${data.finderEmail || data.finderContact}?subject=Claiming my lost item&body=Hi, I believe this is my lost item. Please let me know how we can arrange pickup.`}
              className="text-primary underline font-medium"
            >
              {data.finderContact}
            </a>
          </div>
        ),
        duration: 10000,
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
          {showReportForm ? 'Report Lost Item' : 'Search for Lost Item'}
        </h1>
        <p className="text-lg text-muted-foreground">
          {showReportForm 
            ? 'Tell us what you lost so we can notify you when it\'s found'
            : 'Describe what you lost and let AI find it for you'}
        </p>
      </div>

      <Card className="border-2 mb-12">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {showReportForm ? <FileText className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              {showReportForm ? 'Item Details' : 'Search Description'}
            </CardTitle>
          </div>
          <CardDescription>
            {showReportForm
              ? "Create a persistent report. We'll assume you've already searched above."
              : "Be as detailed as possible. Our AI will match your description to found items."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showReportForm ? (
            <form onSubmit={handleReportLost} className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="report-desc">Item Description</Label>
                <Textarea 
                  id="report-desc" 
                  value={reportDescription} 
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="e.g., A black leather wallet with a red stripe..."
                  rows={4}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="report-location">Lost Location (Optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="report-location"
                    value={reportLocation}
                    onChange={(e) => setReportLocation(e.target.value)}
                    placeholder="e.g. Central Park, Cafe Nero..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Email/Phone</Label>
                <Input 
                  id="contact" 
                  placeholder="email@example.com"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  We'll use this to contact you if someone finds your item.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="images">Images (Optional)</Label>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    setReportImages(files)
                  }}
                />
                {reportImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {reportImages.map((file, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${idx + 1}`}
                          className="h-20 w-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = reportImages.filter((_, i) => i !== idx)
                            setReportImages(newImages)
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

              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="alert-toggle" className="flex items-center gap-2">
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

              <Button type="submit" size="lg" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Submit Lost Item Report
              </Button>
            </form>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {results.length > 0 && !showReportForm && (
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

      {results.length === 0 && !isSearching && !showReportForm && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No search results yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Enter a detailed description above and click search to find matching items.
            </p>
            <Button variant="outline" onClick={() => setShowReportForm(true)}>
              Report Missing Item
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}