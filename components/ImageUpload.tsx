'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, Upload, X, MapPin, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// @ts-ignore
import exifr from 'exifr'

interface ImageUploadProps {
  onImageSelect: (file: File) => void
  onLocationDetected?: (location: string) => void
  currentImage?: string | null
}

export default function ImageUpload({ onImageSelect, onLocationDetected, currentImage }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [locationStatus, setLocationStatus] = useState<string>('')
  const [showCamera, setShowCamera] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const logToServer = async (message: string, data?: any) => {
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, data }),
      })
    } catch (error) {
      console.error('Failed to log to server:', error)
    }
  }

  const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
    try {
      await logToServer('Reverse geocoding', { lat, lon })
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`
      )
      const data = await response.json()
      await logToServer('Reverse geocoding response', { hasDisplayName: !!data.display_name, displayName: data.display_name })
      if (data.display_name) {
        return data.display_name
      }
      return null
    } catch (error) {
      await logToServer('Reverse geocoding error', { error: String(error) })
      console.error('Reverse geocoding error:', error)
      return null
    }
  }

  const extractLocationFromImage = async (file: File): Promise<string | null> => {
    try {
      await logToServer('Starting EXIF extraction', { fileName: file.name, fileSize: file.size, fileType: file.type })
      
      // Try multiple EXIF parsing strategies
      let exifData: any = null
      
      // Strategy 1: Parse with GPS focus
      try {
        exifData = await exifr.parse(file, { gps: true })
        await logToServer('EXIF parse (GPS focus)', { 
          hasData: !!exifData,
          hasLat: !!exifData?.latitude,
          hasLon: !!exifData?.longitude
        })
      } catch (e) {
        await logToServer('EXIF parse (GPS focus) failed', { error: String(e) })
      }
      
      // Strategy 2: If no GPS, try full parse
      if (!exifData?.latitude || !exifData?.longitude) {
        try {
          const fullExif = await exifr.parse(file)
          await logToServer('EXIF full parse', { 
            hasData: !!fullExif,
            keys: fullExif ? Object.keys(fullExif) : [],
            hasLat: !!fullExif?.latitude,
            hasLon: !!fullExif?.longitude,
            hasGPS: !!fullExif?.GPS
          })
          
          // Check if GPS data is nested
          if (fullExif?.GPS?.latitude && fullExif?.GPS?.longitude) {
            exifData = {
              latitude: fullExif.GPS.latitude,
              longitude: fullExif.GPS.longitude
            }
            await logToServer('Found GPS in nested structure', { lat: exifData.latitude, lon: exifData.longitude })
          } else if (fullExif?.latitude && fullExif?.longitude) {
            exifData = fullExif
          }
        } catch (e) {
          await logToServer('EXIF full parse failed', { error: String(e) })
        }
      }
      
      await logToServer('Final EXIF check', { 
        hasExifData: !!exifData,
        hasLat: !!exifData?.latitude,
        hasLon: !!exifData?.longitude,
        lat: exifData?.latitude,
        lon: exifData?.longitude
      })
      
      if (exifData?.latitude && exifData?.longitude) {
        const location = await reverseGeocode(exifData.latitude, exifData.longitude)
        return location
      }
      
      await logToServer('No GPS data found in EXIF after all attempts')
      return null
    } catch (error) {
      await logToServer('EXIF extraction error', { error: String(error) })
      console.error('EXIF extraction error:', error)
      return null
    }
  }

  const getCurrentLocation = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        logToServer('Geolocation not available')
        resolve(null)
        return
      }

      logToServer('Requesting geolocation')
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await logToServer('Geolocation success', { 
            lat: position?.coords?.latitude, 
            lon: position?.coords?.longitude 
          })
          if (position?.coords) {
            const location = await reverseGeocode(position.coords.latitude, position.coords.longitude)
            resolve(location)
          } else {
            resolve(null)
          }
        },
        async (error) => {
          await logToServer('Geolocation error', { 
            code: error.code, 
            message: error.message 
          })
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
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

    setIsProcessing(true)
    setLocationStatus('Processing image...')

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    onImageSelect(file)

    // Try to extract location - EXIF first, then geolocation
    let location: string | null = null
    
    // 1. Try EXIF data first
    await logToServer('Step 1: Trying EXIF extraction')
    location = await extractLocationFromImage(file)
    await logToServer('After EXIF extraction', { location })
    
    // 2. If no location from EXIF, try current device location
    if (!location) {
      await logToServer('Step 2: Trying device geolocation (EXIF failed)')
      location = await getCurrentLocation()
      await logToServer('After geolocation', { location })
    }

    if (location && onLocationDetected) {
      await logToServer('Location detected successfully', { location })
      onLocationDetected(location)
      setLocationStatus(`Location detected: ${location}`)
    } else {
      await logToServer('Location detection failed - both methods failed')
      setLocationStatus('Location not detected - please enter manually')
    }
    
    setIsProcessing(false)
  }

  const isMobile = () => {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })
      setStream(mediaStream)
      setShowCamera(true)
      
      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.play()
        }
      }, 100)
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Unable to access camera. Please check permissions or use Upload Photo instead.')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setShowCamera(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob, then to File
    canvas.toBlob(async (blob) => {
      if (!blob) return

      // Create a File from the blob
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      // Stop camera
      stopCamera()
      
      // Process the captured photo
      await handleFileChange(file)
    }, 'image/jpeg', 0.95)
  }

  const handleClick = async (useCamera: boolean) => {
    if (useCamera) {
      if (isMobile()) {
        // On mobile, use file input with capture
        if (cameraInputRef.current) {
          cameraInputRef.current.click()
        }
      } else {
        // On desktop, use getUserMedia for live camera
        await startCamera()
      }
    } else {
      // Upload photo
      if (uploadInputRef.current) {
        uploadInputRef.current.click()
      }
    }
  }

  const handleRemove = () => {
    stopCamera()
    setPreview(null)
    setLocationStatus('')
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="w-full space-y-4">
      {/* Camera input - always uses capture attribute */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileChange(file)
          }
        }}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      {/* Upload input - no capture attribute */}
      <input
        type="file"
        ref={uploadInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileChange(file)
          }
        }}
        accept="image/*"
        className="hidden"
      />

      {showCamera ? (
        <Card className="border-2 overflow-hidden">
          <div className="relative aspect-video w-full bg-black rounded-t-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="p-4 space-y-3 border-t">
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={capturePhoto}
                className="flex-1"
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                Capture Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={stopCamera}
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : !preview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClick(true)}
              className={cn(
                "h-32 flex-col gap-3 border-2 transition-all",
                "hover:border-primary hover:bg-primary/5 hover:scale-[1.02]",
                "active:scale-[0.98]"
              )}
            >
              <div className="rounded-full bg-primary/10 p-3">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <span className="font-medium">Take Photo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClick(false)}
              className={cn(
                "h-32 flex-col gap-3 border-2 transition-all",
                "hover:border-primary hover:bg-primary/5 hover:scale-[1.02]",
                "active:scale-[0.98]"
              )}
            >
              <div className="rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <span className="font-medium">Upload Photo</span>
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Choose to take a new photo or upload an existing one
          </p>
        </div>
      ) : (
        <Card className="border-2 overflow-hidden shadow-lg">
          <div className="relative">
            <div className="relative aspect-video w-full bg-muted/30 flex items-center justify-center overflow-hidden rounded-t-lg">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-3 right-3 h-9 w-9 rounded-full shadow-lg hover:scale-110 transition-transform"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {(isProcessing || locationStatus) && (
              <div className="p-4 bg-muted/30 border-t">
                {isProcessing ? (
                  <div className="flex items-center gap-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">Processing image and detecting location...</span>
                  </div>
                ) : locationStatus ? (
                  <div className={cn(
                    "flex items-start gap-3 text-sm",
                    locationStatus.includes('detected:') ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {locationStatus.includes('detected:') ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    )}
                    <span className="break-words">{locationStatus}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="p-4 grid grid-cols-2 gap-3 border-t bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClick(true)}
              size="sm"
              className="hover:bg-primary/5"
            >
              <Camera className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClick(false)}
              size="sm"
              className="hover:bg-primary/5"
            >
              <Upload className="mr-2 h-4 w-4" />
              Change
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
