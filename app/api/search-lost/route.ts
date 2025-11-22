import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getTextEmbedding } from '@/lib/openai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const { description, location } = await request.json()

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // Security: Require minimum description length to prevent abuse
    const trimmedDescription = description.trim()
    if (trimmedDescription.length < 15) {
      return NextResponse.json({ 
        error: 'Description must be at least 15 characters long. Please provide more details about your lost item.' 
      }, { status: 400 })
    }

    // Security: Require at least 2 meaningful words (filter out single words or very short queries)
    const words = trimmedDescription.split(/\s+/).filter(word => word.length > 2)
    if (words.length < 2) {
      return NextResponse.json({ 
        error: 'Please provide a more detailed description with at least 2 meaningful words.' 
      }, { status: 400 })
    }

    // 1. Generate embedding for the search query
    // Build a comprehensive search text similar to how found items are stored
    // Found items use: title + description + tags, so we should search with similar structure
    const searchText = location 
      ? `${trimmedDescription} ${location}`.trim()
      : trimmedDescription
    
    console.log('Search query:', searchText)
    const queryEmbedding = await getTextEmbedding(searchText)
    console.log('Embedding generated, length:', queryEmbedding.length)

    // 2. Try with stricter thresholds to prevent overly broad matches
    // Security: Use higher thresholds to prevent fishing/abuse
    let matchThreshold = 0.65 // Start with 65% similarity (stricter)
    let results: any[] = []
    let searchError: any = null

    // Try multiple thresholds if no results (but keep them reasonably high)
    for (const threshold of [0.65, 0.6, 0.55]) {
      const { data, error } = await supabaseAdmin.rpc(
        'search_similar_items',
        {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 20, // Get more results to filter
        }
      )

      if (error) {
        console.error('Search error:', error)
        searchError = error
        break
      }

      if (data && data.length > 0) {
        results = data
        matchThreshold = threshold
        console.log(`Found ${data.length} results with threshold ${threshold}`)
        break
      }
    }

    if (searchError || results.length === 0) {
      console.log('No vector matches found, trying text fallback...')
      // Fallback to direct query with text matching
      const { data: fallbackResults, error: fallbackError } = await supabaseAdmin
        .from('items_found')
        .select('*')
        .eq('claimed', false)
        .limit(50)

      if (fallbackError) {
        console.error('Fallback error:', fallbackError)
        return NextResponse.json({ error: 'Search failed' }, { status: 500 })
      }

      // Simple text matching fallback with stricter requirements
      // Security: Require multiple words to match, not just one
      const searchWords = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      
      // Security: Require at least 2 words to match for text fallback
      if (searchWords.length < 2) {
        return NextResponse.json({ results: [] })
      }
      
      const filtered = (fallbackResults || [])
        ?.filter((item) => {
          const itemText = `${item.auto_title || ''} ${item.auto_description || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
          // Security: Require at least 2 words to match (not just one)
          const matchingWords = searchWords.filter(word => itemText.includes(word))
          return matchingWords.length >= 2
        })
        .slice(0, 10)
        .map((item: any) => ({
          id: item.id,
          image_urls: item.image_urls || (item.image_url ? [item.image_url] : []),
          image_url: item.image_urls?.[0] || item.image_url,
          auto_title: item.auto_title,
          auto_description: item.auto_description,
          location: item.location,
          created_at: item.created_at,
          tags: item.tags || [],
          similarity: 0.5, // Approximate similarity for text matches
        }))

      console.log(`Text fallback found ${filtered.length} results`)
      return NextResponse.json({ results: filtered })
    }

    // Filter out claimed items and format results
    const unclaimedResults = results
      .filter((item: any) => !item.claimed)
      .map((item: any) => ({
        id: item.id,
        image_urls: item.image_urls || (item.image_url ? [item.image_url] : []), // Support both old and new format
        image_url: item.image_urls?.[0] || item.image_url, // For backward compatibility
        auto_title: item.auto_title,
        auto_description: item.auto_description,
        location: item.location,
        created_at: item.created_at,
        tags: item.tags || [],
        similarity: item.similarity || 0,
      }))
      .slice(0, 10)

    console.log(`Returning ${unclaimedResults.length} results (threshold: ${matchThreshold})`)

    return NextResponse.json({
      results: unclaimedResults,
    })
  } catch (error) {
    console.error('Error in search-lost API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

