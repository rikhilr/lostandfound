'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'

interface MapItem {
  id: number
  x: number
  y: number
  type: 'lost' | 'found'
  opacity: number
  scale: number
  found: boolean
}

interface SearchPosition {
  x: number
  y: number
  angle: number
  radius: number
}

export default function MatchingAnimation() {
  const [searchPos, setSearchPos] = useState<SearchPosition>({ x: 50, y: 50, angle: 0, radius: 0 })
  const [searchRadius, setSearchRadius] = useState(0)
  const [isScanning, setIsScanning] = useState(true)
  const [isFinding, setIsFinding] = useState(false)
  const [items, setItems] = useState<MapItem[]>([])
  const [matches, setMatches] = useState<Array<{ from: number; to: number }>>([])
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    // Initial map items - positioned in circular area
    const centerX = 50
    const centerY = 50
    
    const initialItems: MapItem[] = [
      { id: 1, x: centerX + 20, y: centerY - 20, type: 'lost', opacity: 0, scale: 0, found: false },
      { id: 2, x: centerX - 20, y: centerY + 20, type: 'found', opacity: 0, scale: 0, found: false },
      { id: 3, x: centerX + 20, y: centerY + 20, type: 'lost', opacity: 0, scale: 0, found: false },
      { id: 4, x: centerX - 20, y: centerY - 20, type: 'found', opacity: 0, scale: 0, found: false },
    ]
    setItems(initialItems)

    let time = 0
    let searchAngle = 0
    let searchDistance = 0
    let isMoving = true
    let stopTime = 0
    let foundItemIndex = -1
    let currentItems = [...initialItems]

    let lastFrameTime = performance.now()
    
    const animate = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.033) // Cap at 30fps for stability
      lastFrameTime = currentTime
      time += deltaTime

      if (isMoving) {
        // Move search indicator in a spiral/scanning pattern - slower
        searchAngle += 0.008 * deltaTime * 60 // Slower rotation
        searchDistance = 15 + Math.sin(time * 0.3) * 8 // Slower oscillation
        
        const x = centerX + Math.cos(searchAngle) * searchDistance
        const y = centerY + Math.sin(searchAngle) * searchDistance
        
        setSearchPos({ x, y, angle: searchAngle, radius: searchDistance })
        setSearchRadius(40)

        // Periodically stop to "find" an item - longer intervals
        if (time - stopTime > 4) {
          isMoving = false
          setIsFinding(true)
          setSearchRadius(60) // Expand search radius when finding
          stopTime = time
          
          // Find nearest item that hasn't been found yet
          const unfoundItems = currentItems.filter(item => !item.found)
          if (unfoundItems.length > 0) {
            foundItemIndex = currentItems.indexOf(unfoundItems[0])
            // Position search near the item
            const targetItem = currentItems[foundItemIndex]
            setSearchPos({ 
              x: targetItem.x, 
              y: targetItem.y, 
              angle: searchAngle, 
              radius: searchDistance 
            })
          }
        }
      } else {
        // Stopped and finding
        if (time - stopTime < 1.2) {
          // Pulse the search radius - slower
          const pulse = Math.sin((time - stopTime) * 6) * 5 + 60
          setSearchRadius(pulse)
        } else {
          // Reveal the found item - slower reveal
          if (foundItemIndex >= 0 && foundItemIndex < currentItems.length) {
            const progress = Math.min(1, (time - stopTime - 1.2) / 0.8)
            currentItems[foundItemIndex] = {
              ...currentItems[foundItemIndex],
              opacity: progress,
              scale: progress,
              found: true,
            }
            setItems([...currentItems])
          }
          
          if (time - stopTime > 2.5) {
            // Resume moving
            isMoving = true
            setIsFinding(false)
            setSearchRadius(40)
            stopTime = time
            foundItemIndex = -1
            
            // Check for matches after finding a few items
            const foundCount = currentItems.filter(item => item.found).length
            if (foundCount >= 2 && matches.length === 0) {
              setMatches([
                { from: 1, to: 2 },
                { from: 3, to: 4 },
              ])
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [matches.length])

  return (
    <div className="relative w-full h-full rounded-full overflow-visible bg-muted/30 border border-border/50">
      {/* Inner container for clipping circular content */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
      {/* Circular grid background */}
      <div className="absolute inset-0 opacity-40">
        <svg className="w-full h-full" viewBox="0 0 200 200">
          <defs>
            <circle id="center" cx="100" cy="100" r="1" fill="currentColor" className="text-foreground/30" />
          </defs>
          {/* Concentric circles - fewer for less clutter */}
          <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
          
          {/* Radial lines - fewer for less clutter */}
          {[...Array(8)].map((_, i) => {
            const angle = (i * 45) * (Math.PI / 180)
            const x1 = 100 + Math.cos(angle) * 40
            const y1 = 100 + Math.sin(angle) * 40
            const x2 = 100 + Math.cos(angle) * 70
            const y2 = 100 + Math.sin(angle) * 70
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-border"
              />
            )
          })}
          
          {/* Center point */}
          <use href="#center" />
        </svg>
      </div>

      {/* Animated gradient background - subtle - single blob for less clutter */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full bg-gradient-to-br from-primary/8 via-primary/4 to-transparent blur-3xl animate-blob" />
      </div>

      {/* Moving search radius indicator - simplified */}
      {isScanning && (
        <div
          className="absolute rounded-full border border-primary/40 transition-all duration-500 ease-out will-change-transform"
          style={{
            left: `${searchPos.x}%`,
            top: `${searchPos.y}%`,
            width: `${searchRadius}px`,
            height: `${searchRadius}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {isFinding && (
            <div className="absolute inset-0 rounded-full bg-primary/15 animate-pulse" />
          )}
        </div>
      )}

      {/* Map items */}
      <div className="absolute inset-0">
        {items.map((item) => {
          const isMatched = matches.some(
            (m) => m.from === item.id || m.to === item.id
          )
          return (
            <div
              key={item.id}
              className="absolute z-10"
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: `translate(-50%, -50%) scale(${item.scale})`,
                opacity: item.opacity,
                transition: 'transform 0.5s ease-out, opacity 0.5s ease-out',
                willChange: 'transform, opacity',
              }}
            >
              <div
                className={`relative flex items-center justify-center rounded-lg backdrop-blur-sm border shadow-lg ${
                  item.type === 'lost'
                    ? 'bg-background/90 border-primary/30 text-primary'
                    : 'bg-background/90 border-green-500/30 text-green-500'
                } ${isMatched ? 'ring-2 ring-primary/50' : ''}`}
                style={{
                  width: '48px',
                  height: '48px',
                }}
              >
                <MapPin className="w-5 h-5" strokeWidth={2} />
                {isMatched && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Connection lines for matches */}
      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" viewBox="0 0 384 384">
        {matches.map((match, idx) => {
          const fromItem = items.find((i) => i.id === match.from)
          const toItem = items.find((i) => i.id === match.to)
          if (!fromItem || !toItem) return null

          const x1 = (fromItem.x / 100) * 384
          const y1 = (fromItem.y / 100) * 384
          const x2 = (toItem.x / 100) * 384
          const y2 = (toItem.y / 100) * 384

          return (
            <g key={idx}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="url(#matchGradient)"
                strokeWidth="2"
                strokeOpacity="0.4"
                strokeDasharray="4 4"
                className="animate-pulse"
              />
            </g>
          )
        })}
        <defs>
          <linearGradient id="matchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Moving search indicator */}
      {isScanning && (
        <div
          className="absolute z-20 transition-all duration-500 ease-out will-change-transform"
          style={{
            left: `${searchPos.x}%`,
            top: `${searchPos.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="relative w-12 h-12 flex items-center justify-center">
            {isFinding && (
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
            )}
            <div className={`relative w-10 h-10 rounded-full bg-background/95 backdrop-blur-sm border-2 flex items-center justify-center shadow-lg transition-all duration-300 ${
              isFinding ? 'border-primary/60 scale-110' : 'border-primary/30'
            }`}>
              <Search className={`w-5 h-5 text-primary transition-transform duration-300 ${isFinding ? 'scale-110' : ''}`} strokeWidth={2} />
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}
