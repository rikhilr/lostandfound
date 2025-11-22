import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getTextEmbedding } from '@/lib/openai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json()

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // 1. Generate embedding for the search query
    const queryEmbedding = await getTextEmbedding(description)

    // 2. Perform vector similarity search using pgvector
    // Using cosine distance (<->) and ordering by similarity
    const { data: results, error: searchError } = await supabaseAdmin.rpc(
      'search_similar_items',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7, // Minimum similarity threshold
        match_count: 10, // Maximum number of results
      }
    )

    if (searchError) {
      console.error('Search error:', searchError)
      // Fallback to direct query if RPC function doesn't exist
      const { data: fallbackResults, error: fallbackError } = await supabaseAdmin
        .from('items_found')
        .select('*')
        .eq('claimed', false)
        .limit(10)

      if (fallbackError) {
        return NextResponse.json({ error: 'Search failed' }, { status: 500 })
      }

      // Simple text matching fallback (not ideal, but works without pgvector)
      const filtered = fallbackResults
        ?.filter((item) => {
          const searchText = description.toLowerCase()
          const itemText = `${item.auto_title} ${item.auto_description} ${item.tags?.join(' ')}`.toLowerCase()
          return itemText.includes(searchText) || searchText.split(' ').some(word => itemText.includes(word))
        })
        .slice(0, 5) || []

      return NextResponse.json({ results: filtered })
    }

    // Filter out claimed items and format results
    const unclaimedResults = (results || [])
      .filter((item: any) => !item.claimed)
      .map((item: any) => ({
        id: item.id,
        image_url: item.image_url,
        auto_title: item.auto_title,
        auto_description: item.auto_description,
        location: item.location,
        created_at: item.created_at,
        proof_question: item.proof_question,
        similarity: item.similarity || 0,
      }))
      .slice(0, 10)

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

