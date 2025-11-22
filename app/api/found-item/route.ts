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
    // Use the same lenient thresholds as search-lost for consistency
    let matchingLostItems: any[] = []
    let matchThreshold = 0.5
    
    console.log('Checking for matching lost items with alerts enabled...')
    console.log('Using combined embedding (60% image, 40% text)')
    
    // Try multiple thresholds (same as search-lost)
    // First try with the combined embedding (works best for lost items with images)
    for (const threshold of [0.5, 0.4, 0.3]) {
      const { data, error } = await supabaseAdmin.rpc(
        'search_similar_lost_items',
        {
          query_embedding: combinedEmbedding,
          match_threshold: threshold,
          match_count: 5
        }
      )
      
      if (error) {
        console.error('Error searching for lost items:', error)
        break
      }
      
      if (data && data.length > 0) {
        matchingLostItems = data
        matchThreshold = threshold
        console.log(`Found ${data.length} matching lost item(s) with combined embedding at threshold ${threshold}`)
        break
      }
    }
    
    // If no matches with combined embedding, try with just text embedding
    // This helps match text-only lost items (no images provided)
    if (matchingLostItems.length === 0) {
      console.log('No matches with combined embedding, trying text-only embedding...')
      
      for (const threshold of [0.5, 0.4, 0.3]) {
        const { data, error } = await supabaseAdmin.rpc(
          'search_similar_lost_items',
          {
            query_embedding: textEmbedding,
            match_threshold: threshold,
            match_count: 5
          }
        )
        
        if (error) {
          console.error('Error searching for lost items with text embedding:', error)
          break
        }
        
        if (data && data.length > 0) {
          matchingLostItems = data
          matchThreshold = threshold
          console.log(`Found ${data.length} matching lost item(s) with text embedding at threshold ${threshold}`)
          break
        }
      }
    }
    
    if (matchingLostItems.length === 0) {
      console.log('No matching lost items found with alerts enabled after trying both embeddings')
    }

    // 6. Create match notifications for each matching lost item
    const notificationUrls: string[] = []
    
    if (matchingLostItems && matchingLostItems.length > 0) {
      console.log(`Processing ${matchingLostItems.length} matching lost item(s)...`)
      
      for (const lostItem of matchingLostItems) {
        console.log(`Processing lost item ${lostItem.id}, similarity: ${lostItem.similarity}`)
        
        // Get the notification token for this lost item
        const { data: lostItemData, error: lostItemError } = await supabaseAdmin
          .from('items_lost')
          .select('notification_token, description')
          .eq('id', lostItem.id)
          .single()

        if (lostItemError) {
          console.error('Error fetching lost item data:', lostItemError)
          continue
        }

        if (lostItemData?.notification_token) {
          console.log(`Creating notification for lost item ${lostItem.id} with token ${lostItemData.notification_token.substring(0, 20)}...`)
          
          // Create a match notification
          const { error: notifError } = await supabaseAdmin
            .from('match_notifications')
            .insert({
              lost_item_id: lostItem.id,
              found_item_id: dbData.id,
              notification_token: lostItemData.notification_token,
              viewed: false
            })

          if (notifError) {
            console.error('Error creating notification:', notifError)
          } else {
            console.log(`Notification created successfully for lost item ${lostItem.id}`)
            notificationUrls.push(`/notify/${lostItemData.notification_token}`)
          }
        } else {
          console.warn(`Lost item ${lostItem.id} has no notification token`)
        }
      }
    }

    // 7. Prepare response with match info
    let matchAlert = null
    
    if (matchingLostItems && matchingLostItems.length > 0) {
      const bestMatch = matchingLostItems[0]
      
      matchAlert = {
        foundMatch: true,
        message: `This matches a reported lost item!`,
        matchId: bestMatch.id,
        contactInfo: bestMatch.contact_info,
        notificationUrls: notificationUrls
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

