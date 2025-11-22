import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getTextEmbedding } from '@/lib/openai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const { description, location, contactInfo } = await request.json()

    if (!description || !contactInfo) {
      return NextResponse.json(
        { error: 'Description and contact info are required' }, 
        { status: 400 }
      )
    }

    // 1. Generate embedding for the lost item description
    const textToEmbed = location 
      ? `${description} Lost in: ${location}` 
      : description
      
    const embedding = await getTextEmbedding(textToEmbed)

    // 2. Insert into items_lost table
    const { data, error } = await supabaseAdmin
      .from('items_lost')
      .insert({
        description,
        location: location || null,
        contact_info: contactInfo,
        embedding,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to report lost item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: data })

  } catch (error) {
    console.error('Error in report-lost API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}