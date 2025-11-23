import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getTextEmbedding } from '@/lib/openai/embeddings'
import { calculateDistance } from '@/lib/utils/geography'

export async function POST(request: NextRequest) {
  try {
    const { description, location, latitude, longitude, radiusMiles } = await request.json()

    if (!description || description.trim().length < 5) {
      return NextResponse.json(
        { error: "Description must be at least 5 characters" },
        { status: 400 }
      );
    }

    const trimmedDescription = description.trim();
    const words = trimmedDescription
      .split(/\s+/)
      .filter((w: string) => w.length > 2);

    if (words.length < 2) {
      return NextResponse.json(
        { error: "Please add more detail" },
        { status: 400 }
      );
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
    // Request more results if we need to filter by radius
    const matchCount = (radiusMiles !== null && radiusMiles !== undefined) ? 50 : 20
    
    for (const threshold of [0.65, 0.6, 0.55]) {
      const { data, error } = await supabaseAdmin.rpc(
        'search_similar_items',
        {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: matchCount, // Get more results to filter
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
        .select('*, latitude, longitude')
        .eq('claimed', false)
        .limit(50)

      if (fallbackError) {
        console.error('Fallback error:', fallbackError)
        return NextResponse.json({ error: 'Search failed' }, { status: 500 })
      }

      // Simple text matching fallback with stricter requirements
      // Security: Require multiple words to match, not just one
      const searchWords = searchText.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
      
      // Security: Require at least 2 words to match for text fallback
      if (searchWords.length < 2) {
        return NextResponse.json({ results: [] })
      }
      
      const filtered = (fallbackResults || [])
        ?.filter((item) => {
          const itemText = `${item.auto_title || ''} ${item.auto_description || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
          // Security: Require at least 2 words to match (not just one)
          const matchingWords = searchWords.filter((word: string) => itemText.includes(word))
          return matchingWords.length >= 2
        })
        .slice(0, 10)
        .map((item: any) => {
          let distance: number | undefined = undefined
          
          // Calculate distance if coordinates are provided
          if (latitude !== undefined && longitude !== undefined && 
              item.latitude !== null && item.longitude !== null) {
            distance = calculateDistance(
              latitude,
              longitude,
              item.latitude,
              item.longitude
            )
          }
          
          return {
            id: item.id,
            image_urls: item.image_urls || (item.image_url ? [item.image_url] : []),
            image_url: item.image_urls?.[0] || item.image_url,
            auto_title: item.auto_title,
            auto_description: item.auto_description,
            location: item.location,
            created_at: item.created_at,
            tags: item.tags || [],
            similarity: 0.5, // Approximate similarity for text matches
            distance,
          }
        })
        
        // Filter by radius if provided (for fallback results too)
        .filter((item: any) => {
          if (radiusMiles !== null && radiusMiles !== undefined && 
              latitude !== undefined && longitude !== undefined) {
            return item.distance === undefined || item.distance <= radiusMiles
          }
          return true
        })

      console.log(`Text fallback found ${filtered.length} results`)
      return NextResponse.json({ results: filtered })
    }

    // Filter out claimed items and format results
    let unclaimedResults = results
      .filter((item: any) => !item.claimed)
      .map((item: any) => {
        let distance: number | undefined = undefined
        
        // Calculate distance if coordinates are provided
        if (latitude !== undefined && longitude !== undefined && 
            item.latitude !== null && item.longitude !== null) {
          distance = calculateDistance(
            latitude,
            longitude,
            item.latitude,
            item.longitude
          )
        }
        
        return {
          id: item.id,
          image_urls: item.image_urls || (item.image_url ? [item.image_url] : []), // Support both old and new format
          image_url: item.image_urls?.[0] || item.image_url, // For backward compatibility
          auto_title: item.auto_title,
          auto_description: item.auto_description,
          location: item.location,
          created_at: item.created_at,
          tags: item.tags || [],
          similarity: item.similarity || 0,
          distance,
        }
      })

    // Filter by radius if provided
    if (radiusMiles !== null && radiusMiles !== undefined && latitude !== undefined && longitude !== undefined) {
      unclaimedResults = unclaimedResults.filter((item: any) => {
        // Include items without coordinates when radius filter is active (show all)
        // Or include items within the radius
        return item.distance === undefined || item.distance <= radiusMiles
      })
      
      // Sort by similarity first, then by distance (if available)
      unclaimedResults.sort((a: any, b: any) => {
        // Primary sort: similarity (higher is better)
        if (Math.abs(a.similarity - b.similarity) > 0.01) {
          return b.similarity - a.similarity
        }
        // Secondary sort: distance (lower is better, but only if both have distance)
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance
        }
        // Items with distance come before items without
        if (a.distance !== undefined) return -1
        if (b.distance !== undefined) return 1
        return 0
      })
    } else {
      // No radius filter: sort by similarity only
      unclaimedResults.sort((a: any, b: any) => b.similarity - a.similarity)
    }

    unclaimedResults = unclaimedResults.slice(0, 10)

    console.log(`Returning ${unclaimedResults.length} results (threshold: ${matchThreshold})`)

    return NextResponse.json({ results: unclaimedResults });
  } catch (error) {
    console.error("search-lost failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}