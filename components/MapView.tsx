'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDistance } from '@/lib/utils/geography'
import Image from 'next/image'

interface MapItem {
  id: string
  auto_title: string
  auto_description: string
  location: string
  latitude: number | null
  longitude: number | null
  image_urls?: string[]
  image_url?: string
  created_at: string
  distance?: number
}

interface MapViewProps {
  items: MapItem[]
  userLocation?: { lat: number; lng: number } | null
  onItemClick?: (item: MapItem) => void
  height?: string
}

export default function MapView({ 
  items, 
  userLocation, 
  onItemClick,
  height = '600px' 
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowsRef = useRef<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredItem, setHoveredItem] = useState<MapItem | null>(null)

  // Inject global styles for InfoWindow dark theme
  useEffect(() => {
    const styleId = 'google-maps-infowindow-dark-theme'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .gm-style-iw-c {
          background-color: #080808 !important;
          background: #080808 !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3) !important;
        }
        .gm-style-iw-d {
          background-color: #080808 !important;
          background: #080808 !important;
          overflow: hidden !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .gm-style-iw-t {
          background-color: #080808 !important;
          background: #080808 !important;
        }
        .gm-style-iw-t::after {
          background-color: #080808 !important;
          background: #080808 !important;
        }
        .gm-style-iw-tc {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
      `
      document.head.appendChild(style)
    }
    
    return () => {
      const style = document.getElementById(styleId)
      if (style) {
        style.remove()
      }
    }
  }, [])

  // Dark theme map styles
  const darkMapStyles = [
    { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2937' }] },
    {
      featureType: 'administrative',
      elementType: 'geometry',
      stylers: [{ color: '#1f2937' }]
    },
    {
      featureType: 'administrative',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#9ca3af' }]
    },
    {
      featureType: 'landscape',
      elementType: 'geometry',
      stylers: [{ color: '#111827' }]
    },
    {
      featureType: 'poi',
      elementType: 'geometry',
      stylers: [{ color: '#1f2937' }] 
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#6b7280' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry.fill',
      stylers: [{ color: '#1f2937' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#374151' }]
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#9ca3af' }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#374151' }]
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#0f172a' }]
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#4b5563' }]
    }
  ]

  const createInfoWindowContent = (item: MapItem): string => {
    const primaryImage = item.image_urls?.[0] || item.image_url || ''
    const imageHtml = primaryImage 
      ? `<div style="
          width: 100%;
          height: 200px;
          overflow: hidden;
          margin: 0;
          padding: 0;
          background: #080808;
          display: block;
        ">
          <img 
            src="${primaryImage}" 
            alt="${item.auto_title}" 
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              margin: 0;
              padding: 0;
            " 
          />
        </div>`
      : ''

    return `
      <div style="
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
        max-width: 320px;
        min-width: 280px;
        padding: 0;
        margin: 0;
        background: #080808;
        border-radius: 0;
        overflow: hidden;
        box-shadow: none;
      ">
        ${imageHtml}
        <div style="
          padding: 20px;
          background: #080808;
          margin: 0;
          text-align: center;
          ${!primaryImage ? 'border-radius: 12px 12px 12px 12px;' : ''}
        ">
          <h3 style="
            margin: 0 0 10px 0;
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
            line-height: 1.4;
            letter-spacing: -0.01em;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
            text-align: center;
          ">${item.auto_title}</h3>
          <p style="
            margin: 0 0 16px 0;
            font-size: 14px;
            color: #d1d5db;
            line-height: 1.6;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
            text-align: center;
          ">${item.auto_description}</p>
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            padding-top: 16px;
            margin-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          ">
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              font-size: 13px;
              color: #a1a1aa;
              line-height: 1.5;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
              text-align: center;
              max-width: 100%;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; color: #71717a;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span style="word-break: break-word; text-align: center;">${item.location}</span>
            </div>
            ${item.distance !== undefined ? `
              <div style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 6px 12px;
                background: rgba(59, 130, 246, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.2);
                border-radius: 8px;
                font-size: 12px;
                color: #60a5fa;
                font-weight: 600;
                width: fit-content;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
                margin: 0 auto;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0;">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                <span>${formatDistance(item.distance)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `
  }

  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    const map = mapInstanceRef.current

    // Clear existing markers and info windows
    markersRef.current.forEach(marker => marker.setMap(null))
    infoWindowsRef.current.forEach(infoWindow => infoWindow.close())
    markersRef.current = []
    infoWindowsRef.current = []

    const itemsWithCoords = items.filter(item => 
      item.latitude !== null && 
      item.latitude !== undefined &&
      item.longitude !== null && 
      item.longitude !== undefined &&
      !isNaN(item.latitude) &&
      !isNaN(item.longitude)
    )

    console.log('MapView: Total items:', items.length, 'Items with coords:', itemsWithCoords.length)

    if (itemsWithCoords.length === 0 && !userLocation) {
      console.log('MapView: No items with coordinates and no user location')
      return
    }

    const bounds = new window.google.maps.LatLngBounds()

    // Add user location marker
    if (userLocation) {
      bounds.extend(userLocation)
      
      const userMarker = new window.google.maps.Marker({
        position: userLocation,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: 'Your Location',
        zIndex: 1000,
      })
      markersRef.current.push(userMarker)
    }

    // Add item markers
    console.log('MapView: Creating markers for', itemsWithCoords.length, 'items')
    if (itemsWithCoords.length === 0) {
      console.warn('MapView: No items with coordinates! Items passed:', items.map(i => ({
        id: i.id,
        title: i.auto_title,
        lat: i.latitude,
        lng: i.longitude
      })))
    }
    
    itemsWithCoords.forEach((item, index) => {
      const position = {
        lat: Number(item.latitude!),
        lng: Number(item.longitude!)
      }
      
      // Validate coordinates
      if (isNaN(position.lat) || isNaN(position.lng)) {
        console.error(`MapView: Invalid coordinates for item ${item.id}:`, position)
        return
      }
      
      // Validate coordinate ranges
      if (position.lat < -90 || position.lat > 90 || position.lng < -180 || position.lng > 180) {
        console.error(`MapView: Coordinates out of range for item ${item.id}:`, position)
        return
      }
      
      console.log(`MapView: Creating marker ${index + 1} at`, position, 'for item:', item.auto_title)
      bounds.extend(position)

      const marker = new window.google.maps.Marker({
        position,
        map,
        title: item.auto_title,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 100,
        visible: true,
        optimized: false,
      })
      
      console.log('MapView: Marker created successfully:', {
        markerId: item.id,
        position,
        map: !!map,
        visible: marker.getVisible(),
        onMap: marker.getMap() !== null,
        marker: marker
      })
      
      // Double-check marker is on map
      if (marker.getMap() !== map) {
        console.warn('MapView: Marker not on map, setting it now')
        marker.setMap(map)
      }
      
      if (!marker.getVisible()) {
        console.warn('MapView: Marker not visible, setting visible')
        marker.setVisible(true)
      }

      // Create custom info window with dark theme
      const infoWindow = new window.google.maps.InfoWindow({
        content: createInfoWindowContent(item),
        pixelOffset: new window.google.maps.Size(0, -10),
      })
      
      // Override InfoWindow styles after it opens
      const styleInfoWindow = () => {
        // Use multiple selectors to catch all InfoWindow elements
        const selectors = [
          '.gm-style-iw-c',
          '.gm-style-iw-d',
          '.gm-style-iw-t',
          '[class*="gm-style-iw"]'
        ]
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector)
          elements.forEach((el) => {
            const htmlEl = el as HTMLElement
            htmlEl.style.setProperty('background-color', '#080808', 'important')
            htmlEl.style.setProperty('background', '#080808', 'important')
          })
        })
        
        // Style the tail/arrow using pseudo-element workaround
        let style = document.getElementById('infowindow-dark-theme') as HTMLStyleElement
        if (!style) {
          style = document.createElement('style')
          style.id = 'infowindow-dark-theme'
          document.head.appendChild(style)
        }
        style.textContent = `
          .gm-style-iw-t::after {
            background-color: #080808 !important;
            background: #080808 !important;
          }
          .gm-style-iw-c {
            background-color: #080808 !important;
            background: #080808 !important;
            padding: 0 !important;
          }
          .gm-style-iw-d {
            background-color: #080808 !important;
            background: #080808 !important;
          }
          .gm-style-iw-t {
            background-color: #080808 !important;
            background: #080808 !important;
          }
        `
      }
      
      // Add hover listeners for better UX
      marker.addListener('mouseover', () => {
        setHoveredItem(item)
        infoWindow.open(map, marker)
        // Apply dark theme styles after opening
        setTimeout(styleInfoWindow, 0)
        setTimeout(styleInfoWindow, 50)
        setTimeout(styleInfoWindow, 100)
      })
      
      // Also listen for when the info window content is ready
      infoWindow.addListener('domready', () => {
        styleInfoWindow()
      })

      marker.addListener('mouseout', () => {
        setHoveredItem(null)
        // Don't close on mouseout, keep it open for click
      })

      marker.addListener('click', () => {
        if (onItemClick) {
          onItemClick(item)
        }
      })

      markersRef.current.push(marker)
      infoWindowsRef.current.push(infoWindow)
      console.log('MapView: Marker added to refs. Total markers:', markersRef.current.length)
    })

    console.log('MapView: Total markers created:', markersRef.current.length)
    console.log('MapView: Bounds empty?', bounds.isEmpty())
    console.log('MapView: Bounds:', bounds.toJSON())

    // Fit bounds to show all markers
    if (bounds.isEmpty() === false) {
      console.log('MapView: Fitting bounds to show all markers')
      map.fitBounds(bounds)
      
      // Set max zoom to prevent over-zooming
      const listener = window.google.maps.event.addListener(map, 'bounds_changed', () => {
        if (map.getZoom()! > 15) {
          map.setZoom(15)
        }
        window.google.maps.event.removeListener(listener)
      })
    } else if (userLocation) {
      console.log('MapView: Bounds empty, centering on user location')
      map.setCenter(userLocation)
      map.setZoom(13)
    } else {
      console.log('MapView: No bounds and no user location')
    }
  }, [items, userLocation, onItemClick])

  const initializeMap = useCallback(() => {
    console.log('MapView: initializeMap called')
    
    if (!mapRef.current) {
      console.error('MapView: Cannot initialize map: missing ref')
      setIsLoading(false)
      return
    }

    if (!window.google?.maps) {
      console.error('MapView: Cannot initialize map: Google Maps not loaded', {
        hasGoogle: !!window.google,
        hasMaps: !!window.google?.maps
      })
      setIsLoading(false)
      return
    }

    // Don't reinitialize if already initialized
    if (mapInstanceRef.current) {
      console.log('MapView: Map already initialized, updating markers')
      updateMarkers()
      return
    }

    try {
      console.log('MapView: Creating new map instance')
      const defaultCenter = userLocation || { lat: 40.7128, lng: -74.0060 }
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: userLocation ? 13 : 10,
        styles: darkMapStyles,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        backgroundColor: '#0a0a0a',
      })

      console.log('MapView: Map instance created successfully')
      mapInstanceRef.current = map
      setIsLoading(false)
      
      // Wait for map to be ready before adding markers
      window.google.maps.event.addListenerOnce(map, 'idle', () => {
        console.log('MapView: Map is idle, updating markers')
        updateMarkers()
      })
    } catch (error) {
      console.error('MapView: Error initializing map:', error)
      setIsLoading(false)
    }
  }, [userLocation, updateMarkers])

  useEffect(() => {
    if (!mapRef.current) {
      console.log('MapView: mapRef.current is null')
      return
    }

    const checkAndInitialize = () => {
      console.log('MapView: Checking Google Maps...', {
        hasGoogle: !!window.google,
        hasMaps: !!window.google?.maps,
        hasMap: !!window.google?.maps?.Map,
        hasRef: !!mapRef.current,
        hasInstance: !!mapInstanceRef.current
      })
      
      if (window.google?.maps?.Map && mapRef.current && !mapInstanceRef.current) {
        console.log('MapView: Initializing Google Maps...')
        try {
          initializeMap()
        } catch (error) {
          console.error('MapView: Error in initializeMap:', error)
          setIsLoading(false)
        }
      }
    }

    // Check immediately
    checkAndInitialize()

    // Listen for Google Maps load event
    const handleMapsLoad = () => {
      console.log('MapView: Google Maps loaded event received')
      checkAndInitialize()
    }

    // Listen for custom event from script onLoad
    window.addEventListener('google-maps-loaded', handleMapsLoad)
    
    // Also check on window load
    window.addEventListener('load', handleMapsLoad)
    
    // Also poll as fallback - more aggressive
    let attempts = 0
    const maxAttempts = 100 // 10 seconds
    const interval = setInterval(() => {
      attempts++
      if (attempts % 10 === 0) {
        console.log(`MapView: Polling attempt ${attempts}/${maxAttempts}`)
      }
      checkAndInitialize()
      if (mapInstanceRef.current || attempts >= maxAttempts) {
        clearInterval(interval)
        if (attempts >= maxAttempts && !mapInstanceRef.current) {
          setIsLoading(false)
          console.error('MapView: Google Maps failed to initialize after', attempts, 'attempts')
        }
      }
    }, 100)

    return () => {
      window.removeEventListener('google-maps-loaded', handleMapsLoad)
      window.removeEventListener('load', handleMapsLoad)
      clearInterval(interval)
    }
  }, [initializeMap])

  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      updateMarkers()
    }
  }, [updateMarkers])

  const itemsWithCoords = items.filter(item => 
    item.latitude !== null && 
    item.latitude !== undefined &&
    item.longitude !== null && 
    item.longitude !== undefined &&
    !isNaN(item.latitude) &&
    !isNaN(item.longitude)
  )

  // Always render the map container so Google Maps can initialize into it
  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border bg-card">
      <div 
        ref={mapRef} 
        style={{ 
          height, 
          width: '100%',
          minHeight: '400px',
        }} 
        className="rounded-lg"
      />
      {/* Loading overlay */}
      {isLoading && !mapInstanceRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      {/* Error overlay */}
      {!window.google?.maps && !isLoading && !mapInstanceRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-2">Map unavailable</p>
            <p className="text-xs text-muted-foreground/70">Google Maps API may not be configured</p>
          </div>
        </div>
      )}
      {/* Empty state overlay */}
      {itemsWithCoords.length === 0 && !userLocation && mapInstanceRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-lg">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No items with location data to display</p>
          </div>
        </div>
      )}
    </div>
  )
}

