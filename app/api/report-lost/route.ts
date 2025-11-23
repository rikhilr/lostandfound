import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getTextEmbedding, getImageEmbedding, combineEmbeddings } from '@/lib/openai/embeddings'
import { analyzeMultipleImages } from '@/lib/openai/vision'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const description = formData.get('description') as string
    const location = formData.get('location') as string
    const contactInfo = formData.get('contact_info') as string
    const alertEnabled = formData.get('alert_enabled') === 'true'
    const imageFiles = formData.getAll('images') as File[]
    const latitudeStr = formData.get('latitude') as string | null
    const longitudeStr = formData.get('longitude') as string | null
    
    // Parse coordinates if provided
    const latitude = latitudeStr ? parseFloat(latitudeStr) : null
    const longitude = longitudeStr ? parseFloat(longitudeStr) : null

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

    // 2. Generate embedding for the lost item
    let embedding: number[]
    
    if (imageUrls.length > 0) {
      // If images are provided, analyze them and create visual embeddings
      const imageAnalysis = await analyzeMultipleImages(imageUrls)
      
      // Create image embedding from visual analysis
      const imageEmbedding = await getImageEmbedding({
        description: imageAnalysis.description,
        tags: imageAnalysis.tags
      })
      
      // Create text embedding from description
      const textToEmbed = location 
        ? `${description} Lost in: ${location}` 
        : description
      const textEmbedding = await getTextEmbedding(textToEmbed)
      
      // Combine: 60% image features, 40% text description
      embedding = imageEmbedding.map((val, idx) => 
        (val * 0.6) + (textEmbedding[idx] * 0.4)
      )
    } else {
      // No images, just use text description
      const textToEmbed = location 
        ? `${description} Lost in: ${location}` 
        : description
      embedding = await getTextEmbedding(textToEmbed)
    }

    // 3. Generate notification token if alert is enabled
    const notificationToken = alertEnabled 
      ? `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
      : null

    // 4. Insert into items_lost table
    const { data, error } = await supabaseAdmin
      .from('items_lost')
      .insert({
        description,
        location: location || null,
        contact_info: contactInfo,
        image_urls: imageUrls,
        alert_enabled: alertEnabled,
        notification_token: notificationToken,
        embedding,
        status: 'active',
        latitude: latitude,
        longitude: longitude,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to report lost item' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      item: data,
      notificationToken: notificationToken,
      notificationUrl: notificationToken ? `/notify/${notificationToken}` : null
    })

  } catch (error) {
    console.error('Error in report-lost API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
