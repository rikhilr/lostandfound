import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeMultipleImages } from '@/lib/openai/vision'
import { getImageEmbedding, getTextEmbedding, combineEmbeddings } from '@/lib/openai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFiles = formData.getAll('images') as File[]
    const location = formData.get('location') as string
    const contactInfo = formData.get('contact_info') as string

    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    if (!contactInfo) {
      return NextResponse.json({ error: 'Contact information is required' }, { status: 400 })
    }

    // 1. Upload all images to Supabase Storage
    const imageUrls: string[] = []
    const uploadedPaths: string[] = []

    for (const imageFile of imageFiles) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `found-items/${fileName}`

      const arrayBuffer = await imageFile.arrayBuffer()
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('found-items')
        .upload(filePath, arrayBuffer, {
          contentType: imageFile.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        // Clean up already uploaded images
        if (uploadedPaths.length > 0) {
          await supabaseAdmin.storage.from('found-items').remove(uploadedPaths)
        }
        return NextResponse.json({ error: 'Failed to upload images' }, { status: 500 })
      }

      uploadedPaths.push(filePath)

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('found-items')
        .getPublicUrl(filePath)

      imageUrls.push(urlData.publicUrl)
    }

    // 2. Analyze ALL images with OpenAI Vision for comprehensive matching
    const analysis = await analyzeMultipleImages(imageUrls)

    // 3. Generate embeddings from comprehensive image analysis
    // Image embedding focuses on visual features
    const imageEmbedding = await getImageEmbedding({
      description: analysis.description,
      tags: analysis.tags
    })
    
    // Text embedding from structured metadata
    const textEmbedding = await getTextEmbedding(
      `${analysis.title} ${analysis.description} ${analysis.tags.join(' ')}`
    )
    
    // Combine both for better matching (weighted: 60% image, 40% text)
    const combinedEmbedding = imageEmbedding.map((val, idx) => 
      (val * 0.6) + (textEmbedding[idx] * 0.4)
    )

    // 4. Insert into database
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('items_found')
      .insert({
        image_urls: imageUrls,
        auto_title: analysis.title,
        auto_description: analysis.description,
        tags: analysis.tags,
        location: location,
        contact_info: contactInfo,
        embedding: combinedEmbedding,
        claimed: false,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Clean up uploaded images if DB insert fails
      if (uploadedPaths.length > 0) {
        await supabaseAdmin.storage.from('found-items').remove(uploadedPaths)
      }
      return NextResponse.json({ error: 'Failed to save item' }, { status: 500 })
    }

    // 5. Reverse Match: Check if this found item matches any reported lost items with alerts enabled
    const { data: matchingLostItems } = await supabaseAdmin.rpc(
      'search_similar_lost_items',
      {
        query_embedding: combinedEmbedding,
        match_threshold: 0.75, 
        match_count: 3
      }
    )

    // 6. Prepare response with match info
    let matchAlert = null
    
    if (matchingLostItems && matchingLostItems.length > 0) {
      const bestMatch = matchingLostItems[0]
      
      matchAlert = {
        foundMatch: true,
        message: `This matches a reported lost item!`,
        matchId: bestMatch.id,
        contactInfo: bestMatch.contact_info
      }
    }

    return NextResponse.json({
      success: true,
      item: dbData,
      matchAlert
    })
  } catch (error) {
    console.error('Error in found-item API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

