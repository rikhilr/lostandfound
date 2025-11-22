'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Calendar, Shield, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResultCardProps {
  item: {
    id: string
    image_url: string
    auto_title: string
    auto_description: string
    location: string
    created_at: string
    proof_question: string
  }
  onClaim: (itemId: string, proofAnswer: string) => void
}

export default function ResultCard({ item, onClaim }: ResultCardProps) {
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [proofAnswer, setProofAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageError, setImageError] = useState(false)

  const handleClaim = async () => {
    if (!proofAnswer.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      await onClaim(item.id, proofAnswer)
      if (showClaimForm) {
        setShowClaimForm(false)
        setProofAnswer('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="group overflow-hidden border-2 transition-all hover:shadow-lg hover:scale-[1.02]">
      <div className="relative h-64 w-full overflow-hidden bg-muted">
        {!imageError ? (
          <Image
            src={item.image_url}
            alt={item.auto_title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            onError={() => setImageError(true)}
            unoptimized
          />
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
        {!showClaimForm ? (
          <Button
            onClick={() => setShowClaimForm(true)}
            className="w-full"
            variant="default"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            This Might Be Mine
          </Button>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-start gap-2 mb-2">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <Label className="text-sm font-medium">Verification Question</Label>
                  <p className="text-sm text-muted-foreground mt-1">{item.proof_question}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`answer-${item.id}`}>Your Answer</Label>
              <Input
                id={`answer-${item.id}`}
                type="text"
                value={proofAnswer}
                onChange={(e) => setProofAnswer(e.target.value)}
                placeholder="Enter your answer..."
                disabled={isSubmitting}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleClaim}
                disabled={isSubmitting || !proofAnswer.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Shield className="mr-2 h-4 w-4 animate-pulse" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Verify & Claim
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowClaimForm(false)
                  setProofAnswer('')
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
  )
}

