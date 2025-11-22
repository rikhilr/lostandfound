import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getTextEmbedding } from '@/lib/openai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const { description, location } = await request.json()

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // 1. Generate embedding for the search query
    // Build a comprehensive search text similar to how found items are stored
    // Found items use: title + description + tags, so we should search with similar structure
    const searchText = location 
      ? `${description} ${location}`.trim()
      : description.trim()
    
    console.log('Search query:', searchText)
    const queryEmbedding = await getTextEmbedding(searchText)
    console.log('Embedding generated, length:', queryEmbedding.length)

    // 2. Try with a lower threshold first (more lenient matching)
    let matchThreshold = 0.5 // Start with 50% similarity (more lenient)
    let results: any[] = []
    let searchError: any = null

    // Try multiple thresholds if no results
    for (const threshold of [0.5, 0.4, 0.3]) {
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

      // Simple text matching fallback
      const searchWords = searchText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      const filtered = (fallbackResults || [])
        ?.filter((item) => {
          const itemText = `${item.auto_title || ''} ${item.auto_description || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
          // Match if any significant word appears
          return searchWords.some(word => itemText.includes(word)) || 
                 itemText.includes(searchText.toLowerCase())
        })
        .slice(0, 10)
        .map((item: any) => ({
          id: item.id,
          image_url: item.image_url,
          auto_title: item.auto_title,
          auto_description: item.auto_description,
          location: item.location,
          created_at: item.created_at,
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
        image_url: item.image_url,
        auto_title: item.auto_title,
        auto_description: item.auto_description,
        location: item.location,
        created_at: item.created_at,
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

