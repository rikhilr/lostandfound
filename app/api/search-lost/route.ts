import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTextEmbedding } from "@/lib/openai/embeddings";

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request: NextRequest) {
  try {
    const { description, location, lat, lng, radius } = await request.json();

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

    // Don't include location in embedding - it changes the semantic meaning
    // Location is only used for geographic distance filtering
    const embedding = await getTextEmbedding(trimmedDescription);

    const { data: vectorResults, error } = await supabaseAdmin.rpc(
      "search_similar_items",
      {
        query_embedding: embedding,
        match_threshold: 0.55,
        match_count: 50,
      }
    );

    if (error) {
      console.error("Supabase vector search error:", error);
      return NextResponse.json(
        { error: "Vector search failed" },
        { status: 500 }
      );
    }

    console.log("🔍 Raw vector results count:", vectorResults?.length || 0);
    
    // Convert DB lat/lng into numbers
    let results = (vectorResults || []).map((row: any) => ({
      id: row.id,
      auto_title: row.auto_title,
      auto_description: row.auto_description,
      image_urls: row.image_urls || [],
      location: row.location,
      lat: row.lat !== null ? Number(row.lat) : null,
      lng: row.lng !== null ? Number(row.lng) : null,
      created_at: row.created_at,
      tags: row.tags || [],
      similarity: row.similarity ?? 0,
    }));

    console.log("📊 Results after mapping:", results.length);
    if (results.length > 0) {
      console.log("First result:", results[0].auto_title);
    }

    // Convert incoming values to numbers
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Number(radius);

    const hasCoords =
      lat !== null &&
      lng !== null &&
      !isNaN(latNum) &&
      !isNaN(lngNum) &&
      latNum !== 0 &&
      lngNum !== 0 &&
      !isNaN(radiusNum) &&
      radiusNum > 0;

    console.log("🔍 Search params:", { hasCoords, lat, lng, latNum, lngNum, radiusNum });

    if (hasCoords) {
      console.log("🌍 Applying distance filter...");
      console.log(`📍 Search center: (${latNum}, ${lngNum}), radius: ${radiusNum}km`);
      
      // Add distance to each item and sort by distance
      results = results
        .map((item: any) => {
          // Items without coordinates get Infinity distance (appear last)
          if (item.lat === null || item.lng === null) {
            console.log(`⚠️ Item "${item.auto_title}" has no coordinates - keeping it`);
            return { ...item, distance: Infinity };
          }
          
          // Calculate distance for items with coordinates
          const distance = haversineDistance(latNum, lngNum, item.lat, item.lng);
          console.log(`📍 Item "${item.auto_title}" at (${item.lat}, ${item.lng}) - distance: ${distance.toFixed(2)}km`);
          return { ...item, distance };
        })
        // Keep items within radius OR items without coordinates
        .filter((item: any) => {
          const withinRadius = item.distance <= radiusNum;
          const noCoords = item.distance === Infinity;
          const keep = withinRadius || noCoords;
          
          if (!keep) {
            console.log(`❌ FILTERED OUT: "${item.auto_title}" - ${item.distance.toFixed(2)}km > ${radiusNum}km radius`);
          } else if (withinRadius) {
            console.log(`✅ KEPT: "${item.auto_title}" - ${item.distance.toFixed(2)}km within ${radiusNum}km radius`);
          } else {
            console.log(`✅ KEPT: "${item.auto_title}" - no coordinates`);
          }
          
          return keep;
        })
        // Sort: nearby items first, then items without location
        .sort((a: any, b: any) => a.distance - b.distance);
      
      console.log("📊 Results after distance filtering:", results.length);
    } else {
      console.log("⚠️ No coordinates provided, skipping distance filter");
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("search-lost failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}