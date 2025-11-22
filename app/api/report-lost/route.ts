import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getTextEmbedding } from '@/lib/openai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const description = formData.get('description') as string
    const location = formData.get('location') as string
    const contactInfo = formData.get('contact_info') as string
    const alertEnabled = formData.get('alert_enabled') === 'true'
    const imageFiles = formData.getAll('images') as File[]

    if (!description || !contactInfo) {
      return NextResponse.json(
        { error: 'Description and contact info are required' }, 
        { status: 400 }
      )
    }

    // 1. Upload images if provided
    const imageUrls: string[] = []
    
    if (imageFiles && imageFiles.length > 0) {
      for (const imageFile of imageFiles) {
        if (imageFile.size > 0) {
          const fileExt = imageFile.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          const filePath = `lost-items/${fileName}`

          const arrayBuffer = await imageFile.arrayBuffer()
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('lost-items')
            .upload(filePath, arrayBuffer, {
              contentType: imageFile.type,
              upsert: false,
            })

          if (uploadError) {
            console.error('Upload error:', uploadError)
            continue
          }

          const { data: urlData } = supabaseAdmin.storage
            .from('lost-items')
            .getPublicUrl(filePath)

          imageUrls.push(urlData.publicUrl)
        }
      }
    }

    // 2. Generate embedding for the lost item description
    const textToEmbed = location 
      ? `${description} Lost in: ${location}` 
      : description
      
    const embedding = await getTextEmbedding(textToEmbed)

    // 3. Insert into items_lost table
    const { data, error } = await supabaseAdmin
      .from('items_lost')
      .insert({
        description,
        location: location || null,
        contact_info: contactInfo,
        image_urls: imageUrls,
        alert_enabled: alertEnabled,
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
