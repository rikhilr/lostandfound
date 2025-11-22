import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, data } = await request.json()
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logging error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

