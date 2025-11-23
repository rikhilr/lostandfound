'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, Upload, X, MapPin, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// @ts-ignore
import exifr from 'exifr'

interface ImageUploadProps {
  onImageSelect: (files: File[]) => void
  onLocationDetected?: (location: string, coordinates?: { lat: number, lng: number }) => void
  onCoordinatesDetected?: (coords: { lat: number; lng: number }) => void
  currentImages?: string[]
}

export default function ImageUpload({ 
  onImageSelect, 
  onLocationDetected, 
  onCoordinatesDetected,  // ✅ New prop
  currentImages = [] 
}: ImageUploadProps) {
  const [previews, setPreviews] = useState<string[]>(currentImages)
  const [imageFiles, setImageFiles] = useState<File[]>([])
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
      
      if (!response.ok) {
        await logToServer('Reverse geocoding HTTP error', { status: response.status, statusText: response.statusText })
        return null
      }
      
      const data = await response.json()
      await logToServer('Reverse geocoding response', { 
        hasDisplayName: !!data.display_name, 
        displayName: data.display_name,
        displayNameLength: data.display_name?.length,
        fullResponse: JSON.stringify(data).substring(0, 200)
      })
      
      if (data.display_name && data.display_name.trim().length > 0) {
        const location = data.display_name.trim()
        await logToServer('Reverse geocoding success', { location })
        return location
      }
      
      await logToServer('Reverse geocoding: no valid display_name', { dataKeys: Object.keys(data) })
      return null
    } catch (error) {
      await logToServer('Reverse geocoding error', { error: String(error), errorStack: error instanceof Error ? error.stack : undefined })
      console.error('Reverse geocoding error:', error)
      return null
    }
  }

  const extractLocationFromImage = async (file: File): Promise<{ location: string | null, coordinates: { lat: number, lng: number } | null }> => {
    try {
      await logToServer('Starting EXIF extraction', { fileName: file.name, fileSize: file.size, fileType: file.type })
      
      let exifData: any = null
      
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
        await logToServer('EXIF GPS found, reverse geocoding', { 
          lat: exifData.latitude, 
          lon: exifData.longitude 
        })
        const location = await reverseGeocode(exifData.latitude, exifData.longitude)
        await logToServer('After reverse geocode', { 
          location, 
          hasLocation: !!location,
          locationType: typeof location,
          locationLength: location?.length
        })
        return {
          location,
          coordinates: { lat: exifData.latitude, lng: exifData.longitude }
        }
      }
      
      await logToServer('No GPS data found in EXIF after all attempts')
      return { location: null, coordinates: null }
    } catch (error) {
      await logToServer('EXIF extraction error', { error: String(error) })
      console.error('EXIF extraction error:', error)
      return { location: null, coordinates: null }
    }
  }

  const getCurrentLocation = async (): Promise<{ location: string | null, coordinates: { lat: number, lng: number } | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        logToServer('Geolocation not available')
        resolve({ location: null, coordinates: null })
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
            const coordinates = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
            const location = await reverseGeocode(position.coords.latitude, position.coords.longitude)
            await logToServer('getCurrentLocation: resolved with result', { 
              location, 
              hasLocation: !!location,
              coordinates 
            })
            resolve({ location, coordinates })
          } else {
            resolve({ location: null, coordinates: null })
          }
        },
        async (error) => {
          await logToServer('Geolocation error', { 
            code: error.code, 
            message: error.message 
          })
          resolve({ location: null, coordinates: null })
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })
  }

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newFiles: File[] = []
    const newPreviews: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large (max 5MB)`)
        continue
      }
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file`)
        continue
      }

      newFiles.push(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...imageFiles, ...newFiles]
      setImageFiles(updatedFiles)
      onImageSelect(updatedFiles)

      // Try to extract location from first image only
      if (imageFiles.length === 0 && newFiles.length > 0 && !locationStatus) {
        setIsProcessing(true)
        setLocationStatus('Processing image...')

        let locationResult = await extractLocationFromImage(newFiles[0])
        await logToServer('After extractLocationFromImage', { 
          hasLocation: !!locationResult.location,
          location: locationResult.location,
          hasCoordinates: !!locationResult.coordinates
        })
        
        if (!locationResult.location) {
          await logToServer('Trying getCurrentLocation as fallback')
          locationResult = await getCurrentLocation()
          await logToServer('After getCurrentLocation', { 
            hasLocation: !!locationResult.location,
            location: locationResult.location,
            hasCoordinates: !!locationResult.coordinates
          })
        }

        if (locationResult.location && locationResult.location.trim().length > 0 && onLocationDetected) {
          await logToServer('Location detected successfully', { 
            location: locationResult.location, 
            hasCoordinates: !!locationResult.coordinates 
          })
          onLocationDetected(locationResult.location, locationResult.coordinates || undefined)
          setLocationStatus(`Location detected: ${locationResult.location}`)
        } else {
          await logToServer('Location detection failed - both methods failed', {
            locationResultLocation: locationResult.location,
            locationResultLocationType: typeof locationResult.location,
            locationResultLocationLength: locationResult.location?.length,
            hasOnLocationDetected: !!onLocationDetected
          })
          setLocationStatus('Location not detected - please enter manually')
        }
        
        setIsProcessing(false)
      }
    }
  }

  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    setImageFiles(newFiles)
    setPreviews(newPreviews)
    onImageSelect(newFiles)
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

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(async (blob) => {
      if (!blob) return

      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      stopCamera()
      
      await handleFileChange({ length: 1, 0: file, item: () => file, [Symbol.iterator]: function*() { yield file } } as any)
    }, 'image/jpeg', 0.95)
  }

  const handleClick = async (useCamera: boolean) => {
    if (useCamera) {
      if (isMobile()) {
        if (cameraInputRef.current) {
          cameraInputRef.current.click()
        }
      } else {
        await startCamera()
      }
    } else {
      if (uploadInputRef.current) {
        uploadInputRef.current.click()
      }
    }
  }

  const handleRemove = () => {
    stopCamera()
    setPreviews([])
    setImageFiles([])
    setLocationStatus('')
    onImageSelect([])
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="w-full space-y-4">
      <input
        type="file"
        ref={cameraInputRef}
        onChange={(e) => handleFileChange(e.target.files)}
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={uploadInputRef}
        onChange={(e) => handleFileChange(e.target.files)}
        accept="image/*"
        multiple
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
      ) : previews.length === 0 ? (
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
              <span className="font-medium">Upload Photos</span>
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            You can add multiple photos
          </p>
        </div>
      ) : (
        <Card className="border-2 overflow-hidden shadow-lg">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30 group">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                    {index + 1} / {previews.length}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClick(true)}
                size="sm"
              >
                <Camera className="mr-2 h-4 w-4" />
                Add Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClick(false)}
                size="sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                Add More
              </Button>
            </div>
            {(isProcessing || locationStatus) && (
              <div className="p-3 bg-muted/30 border rounded-lg">
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
        </Card>
      )}
    </div>
  )
}