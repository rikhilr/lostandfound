'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MapPin, Calendar, Shield, CheckCircle2, Mail, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultCardProps {
  item: {
    id: string
    image_url?: string
    image_urls?: string[]
    auto_title: string
    auto_description: string
    location: string
    created_at: string
    tags?: string[]
  }
  onClaim: (itemId: string, claimerContact: string) => void
}

export default function ResultCard({ item, onClaim }: ResultCardProps) {
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [claimerContact, setClaimerContact] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isClaimed, setIsClaimed] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const images = item.image_urls || (item.image_url ? [item.image_url] : [])
  const primaryImage = images[0] || item.image_url || ''

  const handleClaim = async () => {
    if (!claimerContact.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      await onClaim(item.id, claimerContact)
      setIsClaimed(true)
      if (showClaimForm) {
        setShowClaimForm(false)
        setClaimerContact('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <>
      <Card className="group overflow-hidden border-2 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer" onClick={() => setShowDetails(true)}>
        <div className="relative h-64 w-full overflow-hidden bg-muted">
          {!imageError && primaryImage ? (
            <>
              <Image
                src={primaryImage}
                alt={item.auto_title}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                onError={() => setImageError(true)}
                unoptimized
              />
              {images.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {images.length} photos
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Image unavailable</p>
              </div>
            </div>
          )}
        </div>
        <CardHeader>
          <CardTitle className="line-clamp-2">{item.auto_title}</CardTitle>
          <CardDescription className="line-clamp-2">{item.auto_description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{item.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {isClaimed ? (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              variant="default"
              disabled
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Claimed
            </Button>
          ) : !showClaimForm ? (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                setShowClaimForm(true)
              }}
              className="w-full"
              variant="default"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              This Might Be Mine
            </Button>
          ) : (
            <div 
              className="space-y-4 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Your Contact Information</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      We'll share your contact info with the finder so they can reach out to you.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`contact-${item.id}`}>Email or Phone</Label>
                <Input
                  id={`contact-${item.id}`}
                  type="text"
                  value={claimerContact}
                  onChange={(e) => setClaimerContact(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  placeholder="your@email.com or phone number"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClaim()
                  }}
                  disabled={isSubmitting || !claimerContact.trim()}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4 animate-pulse" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Claim Item
                    </>
                  )}
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowClaimForm(false)
                    setClaimerContact('')
                  }}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
      </CardContent>
    </Card>

    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.auto_title}</DialogTitle>
          <DialogDescription>{item.auto_description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="relative">
              <div className="relative aspect-video w-full bg-muted rounded-lg overflow-hidden">
                <Image
                  src={images[currentImageIndex]}
                  alt={`${item.auto_title} - Image ${currentImageIndex + 1}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
                {images.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
              
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={cn(
                        "relative flex-shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition-all",
                        idx === currentImageIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <Image
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Location:</span>
              <span className="font-medium">{item.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Found:</span>
              <span className="font-medium">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {item.tags && item.tags.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Tags: </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {item.tags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-1 bg-muted rounded-md text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Claim Button */}
          {isClaimed ? (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
              disabled
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Claimed
            </Button>
          ) : (
            <Button
              onClick={() => {
                setShowDetails(false)
                setShowClaimForm(true)
              }}
              className="w-full"
              size="lg"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              This Might Be Mine
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

