import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { analyzeImage } from '@/lib/openai/vision'
import { getImageEmbedding, getTextEmbedding, combineEmbeddings } from '@/lib/openai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const location = formData.get('location') as string

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    // 1. Upload image to Supabase Storage
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
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // 2. Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('found-items')
      .getPublicUrl(filePath)

    const imageUrl = urlData.publicUrl

    // 3. Analyze image with OpenAI Vision
    const analysis = await analyzeImage(imageUrl)

    // 4. Generate embeddings
    const imageEmbedding = await getImageEmbedding(analysis.description)
    const textEmbedding = await getTextEmbedding(
      `${analysis.title} ${analysis.description} ${analysis.tags.join(' ')}`
    )
    const combinedEmbedding = combineEmbeddings(imageEmbedding, textEmbedding)

    // 5. Insert into database
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('items_found')
      .insert({
        image_url: imageUrl,
        auto_title: analysis.title,
        auto_description: analysis.description,
        tags: analysis.tags,
        proof_question: analysis.proofQuestion,
        location: location,
        embedding: combinedEmbedding,
        claimed: false,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Clean up uploaded image if DB insert fails
      await supabaseAdmin.storage.from('found-items').remove([filePath])
      return NextResponse.json({ error: 'Failed to save item' }, { status: 500 })
    }

    // 6. Reverse Match: Check if this found item matches any reported lost items
    const { data: matchingLostItems } = await supabaseAdmin.rpc(
      'search_similar_lost_items',
      {
        query_embedding: combinedEmbedding,
        match_threshold: 0.75, 
        match_count: 3
      }
    )

    // 7. Prepare response with match info
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