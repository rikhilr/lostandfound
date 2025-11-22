'use client'

import { useState } from 'react'
import ImageUpload from '@/components/ImageUpload'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Upload, Sparkles, MapPin } from 'lucide-react'

export default function FoundPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [location, setLocation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!imageFile) {
      toast({
        title: "Missing Image",
        description: "Please upload an image of the found item",
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

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('location', location)

      const response = await fetch('/api/found-item', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit item')
      }

      toast({
        title: "Success!",
        description: "Your found item has been submitted. Our AI is analyzing it now.",
      })

      setTimeout(() => {
        router.push('/')
      }, 1500)
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
          Upload a photo and let our AI do the rest
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
                onImageSelect={(file) => setImageFile(file)}
                currentImage={imageFile ? URL.createObjectURL(imageFile) : null}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI will analyze the image and generate all necessary information
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

