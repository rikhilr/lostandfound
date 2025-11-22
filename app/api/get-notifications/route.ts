import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Notification token is required' },
        { status: 400 }
      )
    }

    // Get all match notifications for this token
    const { data: notifications, error } = await supabaseAdmin
      .from('match_notifications')
      .select(`
        id,
        viewed,
        created_at,
        found_item:items_found (
          id,
          image_urls,
          auto_title,
          auto_description,
          tags,
          location,
          contact_info,
          created_at
        )
      `)
      .eq('notification_token', token)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Get the lost item info
    const { data: lostItem } = await supabaseAdmin
      .from('items_lost')
      .select('id, description, location, contact_info, image_urls')
      .eq('notification_token', token)
      .single()

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      lostItem: lostItem || null
    })
  } catch (error) {
    console.error('Error in get-notifications API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

