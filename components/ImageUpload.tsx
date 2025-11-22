'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Camera, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  onImageSelect: (file: File) => void
  onLocationDetected?: (location: string) => void
  currentImage?: string | null
}

export default function ImageUpload({ onImageSelect, onLocationDetected, currentImage }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const [isDragging, setIsDragging] = useState(false)
  const [isCameraMode, setIsCameraMode] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
    try {
      // Use OpenStreetMap Nominatim API (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'LostAndFoundApp/1.0' // Required by Nominatim
          }
        }
      )
      
      if (!response.ok) return null
      
      const data = await response.json()
      if (data.address) {
        const parts: string[] = []
        if (data.address.road) parts.push(data.address.road)
        if (data.address.suburb || data.address.neighbourhood) {
          parts.push(data.address.suburb || data.address.neighbourhood)
        }
        if (data.address.city || data.address.town || data.address.village) {
          parts.push(data.address.city || data.address.town || data.address.village)
        }
        if (data.address.state) parts.push(data.address.state)
        
        return parts.length > 0 ? parts.join(', ') : `${lat.toFixed(4)}, ${lon.toFixed(4)}`
      }
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      return null
    }
  }

  const extractLocationFromImage = async (file: File) => {
    try {
      // Dynamically import exifr to avoid SSR issues
      // @ts-ignore - exifr types may not be available
      const exifrModule = await import('exifr').catch(() => null)
      if (!exifrModule) {
        return
      }
      
      // Handle both default and named exports
      const exifr = exifrModule.default || exifrModule
      if (!exifr || typeof exifr.parse !== 'function') {
        return
      }
      
      const exifData = await exifr.parse(file, {
        gps: true,
        translateKeys: false,
        translateValues: false,
        reviveValues: true
      })

      if (exifData?.latitude && exifData?.longitude) {
        const location = await reverseGeocode(exifData.latitude, exifData.longitude)
        if (location && onLocationDetected) {
          onLocationDetected(location)
        }
      }
    } catch (error) {
      console.error('Error extracting location from image:', error)
      // Silently fail - location extraction is optional
    }
  }

  const handleFileChange = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    onImageSelect(file)
    
    // Try to extract location from EXIF data
    await extractLocationFromImage(file)
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Prefer back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      setStream(mediaStream)
      setIsCameraMode(true)
      
      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.play().catch((error) => {
            console.error('Error playing video:', error)
          })
        }
      }, 100)
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Unable to access camera. Please check your permissions or use file upload instead.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsCameraMode(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0)

    // Try to get current location from geolocation API as fallback
    let locationFromGPS: string | null = null
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        })
      })
      
      if (position.coords) {
        locationFromGPS = await reverseGeocode(
          position.coords.latitude,
          position.coords.longitude
        )
      }
    } catch (error) {
      // Geolocation failed or denied - that's okay, we'll try EXIF
      console.log('Geolocation not available:', error)
    }

    // Convert canvas to blob, then to File
    canvas.toBlob(async (blob) => {
      if (!blob) return

      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' })
      
      // If we got location from GPS, use it immediately
      if (locationFromGPS && onLocationDetected) {
        onLocationDetected(locationFromGPS)
      }
      
      await handleFileChange(file)
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  // Handle video element when camera mode is active
  useEffect(() => {
    if (isCameraMode && videoRef.current && stream) {
      const video = videoRef.current
      video.srcObject = stream
      
      const playVideo = async () => {
        try {
          await video.play()
        } catch (error) {
          console.error('Error playing video stream:', error)
        }
      }
      
      playVideo()
      
      // Cleanup on unmount or when stream changes
      return () => {
        if (video.srcObject) {
          video.srcObject = null
        }
      }
    }
  }, [isCameraMode, stream])

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileChange(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileChange(file)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
    stopCamera()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleModeSwitch = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCameraMode) {
      stopCamera()
    } else {
      startCamera()
    }
  }

  return (
    <div className="w-full space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Mode selector buttons */}
      {!preview && !isCameraMode && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleModeSwitch}
            className="flex-1"
          >
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClick}
            className="flex-1"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>
      )}

      {/* Camera mode */}
      {isCameraMode && !preview && (
        <div className="space-y-4">
          <div className="relative border-2 border-dashed rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-background/80 hover:bg-background"
              onClick={handleModeSwitch}
            >
              <CameraOff className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleModeSwitch}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={capturePhoto}
              className="flex-1"
            >
              <Camera className="mr-2 h-4 w-4" />
              Capture Photo
            </Button>
          </div>
        </div>
      )}

      {/* Upload area (shown when not in camera mode and no preview) */}
      {!isCameraMode && !preview && (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                <span className="text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview mode */}
      {preview && (
        <div className="space-y-4">
          <div className="relative border-2 border-dashed rounded-lg p-4">
            <div className="relative inline-block">
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 rounded-lg object-contain shadow-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleModeSwitch}
              className="flex-1"
            >
              <Camera className="mr-2 h-4 w-4" />
              Retake Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClick}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Different
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

