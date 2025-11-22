import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, message, from } = await request.json()

    if (!to || !subject || !message || !from) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message, from' },
        { status: 400 }
      )
    }

    // Create mailto link - this will open the user's default email client
    // In a production app, you'd use a service like SendGrid, Resend, or AWS SES
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`

    return NextResponse.json({
      success: true,
      mailtoLink,
      message: 'Email client will open with pre-filled message'
    })
  } catch (error) {
    console.error('Error in send-email API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

