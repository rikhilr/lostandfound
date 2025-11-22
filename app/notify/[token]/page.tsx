'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Mail, Bell, ArrowLeft, Image as ImageIcon, MapPin, Calendar } from 'lucide-react'
import Image from 'next/image'

interface FoundItem {
  id: string
  image_urls: string[]
  auto_title: string
  auto_description: string
  tags: string[]
  location: string
  contact_info: string
  created_at: string
}

interface Notification {
  id: string
  viewed: boolean
  created_at: string
  found_item: FoundItem
}

interface LostItem {
  id: string
  description: string
  location: string | null
  contact_info: string
  image_urls: string[]
}

export default function NotifyPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const token = params.token as string

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [lostItem, setLostItem] = useState<LostItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    if (token) {
      fetchNotifications()
    }
  }, [token])

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`/api/get-notifications?token=${token}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch notifications')
      }

      setNotifications(data.notifications || [])
      setLostItem(data.lostItem)

      // Pre-fill email if we have notifications
      if (data.notifications && data.notifications.length > 0) {
        const firstMatch = data.notifications[0].found_item
        setEmailSubject(`Found Item Match: ${firstMatch.auto_title}`)
        setEmailMessage(`Hello,\n\nI believe I found an item that matches your lost item description.\n\nItem Details:\n- Title: ${firstMatch.auto_title}\n- Location Found: ${firstMatch.location}\n- Description: ${firstMatch.auto_description}\n\nPlease let me know if this matches your lost item!\n\nBest regards`)
        setSenderEmail(data.lostItem?.contact_info || '')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load notifications',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async (foundItem: FoundItem) => {
    if (!senderEmail.trim()) {
      toast({
        title: "Missing Email",
        description: "Please enter your email address",
        variant: "destructive",
      })
      return
    }

    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both subject and message",
        variant: "destructive",
      })
      return
    }

    setSendingEmail(true)

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: foundItem.contact_info,
          from: senderEmail,
          subject: emailSubject,
          message: emailMessage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      // Open mailto link
      if (data.mailtoLink) {
        window.location.href = data.mailtoLink
      }

      toast({
        title: "Email Ready",
        description: "Your email client should open with the pre-filled message",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: "destructive",
      })
    } finally {
      setSendingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="container max-w-4xl py-12 md:py-24">
        <div className="text-center">
          <Bell className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="container max-w-4xl py-12 md:py-24">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Matches Yet</h2>
            <p className="text-muted-foreground text-center max-w-md">
              We'll notify you here when someone finds an item that matches your lost item description.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayNotification = selectedNotification || notifications[0]
  const foundItem = displayNotification.found_item

  return (
    <div className="container max-w-4xl py-12 md:py-24">
      <Button
        variant="ghost"
        onClick={() => router.push('/')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-6 w-6 text-green-500" />
          <h1 className="text-4xl font-bold tracking-tight">
            Match Found! 🎉
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">
          {notifications.length} potential match{notifications.length !== 1 ? 'es' : ''} found for your lost item
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Lost Item Info */}
        <Card>
          <CardHeader>
            <CardTitle>Your Lost Item</CardTitle>
            <CardDescription>What you reported as lost</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lostItem?.image_urls && lostItem.image_urls.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {lostItem.image_urls.slice(0, 4).map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                    <Image
                      src={url}
                      alt={`Lost item ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm mt-1">{lostItem?.description}</p>
            </div>
            {lostItem?.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{lostItem.location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Found Item Info */}
        <Card>
          <CardHeader>
            <CardTitle>Found Item</CardTitle>
            <CardDescription>Potential match</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {foundItem.image_urls && foundItem.image_urls.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {foundItem.image_urls.slice(0, 4).map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                    <Image
                      src={url}
                      alt={`Found item ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <p className="text-sm font-medium mt-1">{foundItem.auto_title}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm mt-1">{foundItem.auto_description}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{foundItem.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Found {new Date(foundItem.created_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact the Finder
          </CardTitle>
          <CardDescription>
            Send an email to the person who found this item
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senderEmail">Your Email</Label>
            <Input
              id="senderEmail"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailSubject">Subject</Label>
            <Input
              id="emailSubject"
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Email subject"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailMessage">Message</Label>
            <Textarea
              id="emailMessage"
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              placeholder="Your message to the finder"
              rows={6}
              required
            />
          </div>

          <Button
            onClick={() => handleSendEmail(foundItem)}
            disabled={sendingEmail}
            className="w-full"
            size="lg"
          >
            {sendingEmail ? (
              <>
                <Mail className="mr-2 h-4 w-4 animate-pulse" />
                Opening Email...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Open Email Client
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            This will open your default email client with a pre-filled message to {foundItem.contact_info}
          </p>
        </CardContent>
      </Card>

      {/* Multiple Matches */}
      {notifications.length > 1 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Other Matches</CardTitle>
            <CardDescription>You have {notifications.length - 1} other potential match{notifications.length - 1 !== 1 ? 'es' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notifications.slice(1).map((notif) => (
                <Button
                  key={notif.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedNotification(notif)
                    const item = notif.found_item
                    setEmailSubject(`Found Item Match: ${item.auto_title}`)
                    setEmailMessage(`Hello,\n\nI believe I found an item that matches your lost item description.\n\nItem Details:\n- Title: ${item.auto_title}\n- Location Found: ${item.location}\n- Description: ${item.auto_description}\n\nPlease let me know if this matches your lost item!\n\nBest regards`)
                  }}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {notif.found_item.auto_title} - Found {new Date(notif.created_at).toLocaleDateString()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

