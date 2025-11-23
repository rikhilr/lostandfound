import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { analyzeMultipleImages } from "@/lib/openai/vision"
import { getImageEmbedding, getTextEmbedding } from "@/lib/openai/embeddings"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const imageFiles = formData.getAll("images") as File[]
    const location = formData.get("location") as string
    const contactInfo = formData.get("contact_info") as string

    const latRaw = formData.get("lat")
    const lngRaw = formData.get("lng")

    const lat =
      typeof latRaw === "string" && latRaw.trim() !== "" ? Number(latRaw) : null
    const lng =
      typeof lngRaw === "string" && lngRaw.trim() !== "" ? Number(lngRaw) : null

    console.log("📍 Incoming coordinates:", { lat, lng })

    // --------------------------------------------
    // VALIDATION
    // --------------------------------------------
    if (!imageFiles?.length) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 })
    }
    if (!location) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 })
    }
    if (!contactInfo) {
      return NextResponse.json(
        { error: "Contact information is required" },
        { status: 400 }
      )
    }

    // --------------------------------------------
    // 1. UPLOAD IMAGES
    // --------------------------------------------
    const imageUrls: string[] = []

    for (const file of imageFiles) {
      const ext = file.name.split(".").pop()
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path = `found-items/${filename}`

      const buffer = await file.arrayBuffer()

      const { error: uploadError } = await supabaseAdmin.storage
        .from("found-items")
        .upload(path, buffer, {
          contentType: file.type,
        })

      if (uploadError) {
        console.error("Image upload error:", uploadError)
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        )
      }

      const { data: urlData } = supabaseAdmin.storage
        .from("found-items")
        .getPublicUrl(path)

      imageUrls.push(urlData.publicUrl)
    }

    // --------------------------------------------
    // 2. ANALYZE IMAGES WITH OPENAI VISION
    // --------------------------------------------
    const analysis = await analyzeMultipleImages(imageUrls)

    if (!analysis) {
      return NextResponse.json(
        { error: "AI analysis failed" },
        { status: 500 }
      )
    }

    // --------------------------------------------
    // 3. CREATE EMBEDDINGS (image + text merged)
    // --------------------------------------------
    const imageEmbedding = await getImageEmbedding({
      description: analysis.description,
      tags: analysis.tags,
    })

    const textEmbedding = await getTextEmbedding(
      `${analysis.title} ${analysis.description} ${analysis.tags.join(" ")}`
    )

    const combinedEmbedding = imageEmbedding.map(
      (v, i) => v * 0.6 + textEmbedding[i] * 0.4
    )

    // --------------------------------------------
    // 4. INSERT FOUND ITEM INTO DB
    // --------------------------------------------
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("items_found")
      .insert({
        image_urls: imageUrls,
        auto_title: analysis.title,
        auto_description: analysis.description,
        tags: analysis.tags,
        location,
        contact_info: contactInfo,
        embedding: combinedEmbedding,
        claimed: false,
        lat,
        lng,
      })
      .select()
      .single()

    if (dbError) {
      console.error("DB Insert Error:", dbError)
      return NextResponse.json(
        { error: "Failed to save found item" },
        { status: 500 }
      )
    }

    // --------------------------------------------
    // 5. RUN MATCHING AGAINST LOST ITEMS (alerts)
    // --------------------------------------------
    const { data: lostMatches, error: lostError } = await supabaseAdmin.rpc(
      "search_similar_lost_items",
      {
        query_embedding: combinedEmbedding,
        match_threshold: 0.70,
        match_count: 5,
      }
    )

    if (lostError) {
      console.error("Lost match RPC error:", lostError)
    }

    if (!lostMatches || lostMatches.length === 0) {
      // No matches → return normally
      return NextResponse.json({
        success: true,
        item: dbData,
        matchAlert: null,
      })
    }

    // --------------------------------------------
    // 6. INSERT MATCH NOTIFICATIONS
    // --------------------------------------------
    for (const match of lostMatches) {
      if (!match.notification_token) {
        console.warn(
          "⚠️ Lost item missing notification_token, skipping:",
          match.id
        )
        continue
      }

      const { error: notifErr } = await supabaseAdmin
        .from("match_notifications")
        .insert({
          lost_item_id: match.id,
          found_item_id: dbData.id,
          notification_token: match.notification_token,
        })

      if (notifErr) {
        console.error("Notification insert error:", notifErr)
      }
    }

    // --------------------------------------------
    // 7. RETURN MATCH ALERT FOR TOAST UI
    // --------------------------------------------
    return NextResponse.json({
      success: true,
      item: dbData,
      matchAlert: {
        foundMatch: true,
        contactInfo: lostMatches[0].contact_info,
      },
    })
  } catch (err) {
    console.error("Found-item API error:", err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
