'use client'

import { useState } from 'react'
import ImageUpload from '@/components/ImageUpload'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Upload, Sparkles, MapPin, AlertCircle } from 'lucide-react'

export default function FoundPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [location, setLocation] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (imageFiles.length === 0) {
      toast({
        title: "Missing Images",
        description: "Please upload at least one image of the found item",
        variant: "destructive",
      })
      return
    }

    if (!location.trim()) {
      toast({
        title: "Missing Location",
        description: "Please enter where you found the item",
        variant: "destructive",
      })
      return
    }

    if (!contactInfo.trim()) {
      toast({
        title: "Missing Contact Information",
        description: "Please provide your email or phone number so the owner can contact you",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      imageFiles.forEach((file) => {
        formData.append('images', file)
      })
      formData.append('location', location)
      formData.append('contact_info', contactInfo)

      const response = await fetch('/api/found-item', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit item')
      }

      if (data.matchAlert && data.matchAlert.foundMatch) {
        // Toast for Match Found (No Bounty)
        toast({
          title: "MATCH FOUND! 🎉",
          description: (
            <div className="mt-2 rounded-md bg-green-50 p-3 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center gap-2 font-bold text-green-800 dark:text-green-200 mb-1">
                <AlertCircle className="h-4 w-4" />
                Reported Missing!
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Someone has reported this item as lost.
                <br />
                <span className="font-medium mt-1 block">Contact: {data.matchAlert.contactInfo}</span>
              </p>
            </div>
          ),
          duration: 10000, 
        })
      } else {
        toast({
          title: "Success!",
          description: "Your found item has been submitted. Our AI is analyzing it now.",
        })
      }

      setTimeout(() => {
        router.push('/')
      }, data.matchAlert ? 4000 : 1500)
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container max-w-3xl py-12 md:py-24">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
          Report Found Item
        </h1>
          <p className="text-lg text-muted-foreground">
            Upload photos and let our AI do the rest
          </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Item Details
          </CardTitle>
          <CardDescription>
            Our AI will automatically generate a description, tags, and a proof question for verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="image">Upload Photo</Label>
              <ImageUpload
                onImageSelect={(files) => setImageFiles(files)}
                onLocationDetected={(detectedLocation) => {
                  setLocation(detectedLocation)
                  toast({
                    title: "Location auto-filled",
                    description: "Location detected from photo",
                  })
                }}
                currentImages={imageFiles.map(file => URL.createObjectURL(file))}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Location will be detected automatically if available in the photo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location Found</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Central Park, New York"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">Your Contact Information</Label>
              <Input
                id="contact"
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="email@example.com or phone number"
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be shared with the owner if they claim this item
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                  Processing with AI...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Found Item
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}