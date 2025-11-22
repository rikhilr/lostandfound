import { openai } from './client'

export interface ImageAnalysis {
  title: string
  description: string
  tags: string[]
}

/**
 * Analyzes multiple images and combines their descriptions for comprehensive matching
 */
export async function analyzeMultipleImages(imageUrls: string[]): Promise<ImageAnalysis> {
  if (imageUrls.length === 0) {
    throw new Error('No images provided')
  }

  if (imageUrls.length === 1) {
    // Single image - just return its analysis
    return analyzeImage(imageUrls[0])
  }

  // Analyze all images in parallel for better performance
  const analyses = await Promise.all(
    imageUrls.map(url => analyzeImage(url))
  )

  // Create a comprehensive combined description
  // Focus on common features across images and unique details
  const allTags = new Set<string>()
  analyses.forEach(analysis => {
    analysis.tags.forEach(tag => allTags.add(tag))
  })

  // Build a unified description that captures the item from all angles
  const descriptions = analyses.map(a => a.description)
  const combinedDescription = descriptions.length > 1
    ? `This item appears in multiple views: ${descriptions.join(' Additional view shows: ')}`
    : descriptions[0]

  // Use the most descriptive title (prefer one with brand/material info)
  // Also filter out any titles that contain "json" or other artifacts
  const validAnalyses = analyses.filter(a => {
    const title = a.title.toLowerCase()
    return title.length > 2 && 
           !title.includes('json') && 
           !title.includes('```') &&
           title !== 'found item'
  })
  
  const bestTitle = validAnalyses.length > 0
    ? (validAnalyses.find(a => 
        a.title.toLowerCase().includes('leather') || 
        a.title.toLowerCase().includes('wallet') ||
        a.title.toLowerCase().includes('phone') ||
        a.title.toLowerCase().includes('case') ||
        a.title.toLowerCase().includes('key') ||
        a.title.toLowerCase().includes('card')
      )?.title || validAnalyses[0].title)
    : 'Found Item'

  // Clean the final title one more time
  const finalTitle = bestTitle
    .replace(/^json\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .substring(0, 50) || 'Found Item'

  return {
    title: finalTitle,
    description: combinedDescription,
    tags: Array.from(allTags).slice(0, 15), // Limit to 15 most relevant tags
  }
}

/**
 * Analyzes an image using OpenAI Vision API and generates:
 * - Title
 * - Description (with detailed visual features for better matching)
 * - Tags
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysis> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are analyzing a lost or found item. Provide a detailed visual analysis focusing on identifying features.

IMPORTANT: Respond with ONLY valid JSON, no other text before or after.

Analyze the visual characteristics:
- Primary colors, secondary colors, patterns
- Material (leather, plastic, metal, fabric, etc.)
- Brand name or logo if visible
- Size/shape description
- Condition (new, used, scratches, wear)
- Unique features (text, logos, designs, damage, accessories)

Return a JSON object with exactly these fields:
{
  "title": "Brief item name (max 40 chars)",
  "description": "Detailed 2-3 sentence description focusing on visual identifying features like colors, materials, brand, size, condition, and unique marks",
  "tags": ["color1", "color2", "material", "brand", "type", "condition", "feature1", "feature2"]
}

Example:
{
  "title": "Black Leather Wallet",
  "description": "A black leather wallet with a red stripe on the left side. The wallet shows moderate wear with scuff marks on the corners. It has a visible card slot and appears to be a bifold design.",
  "tags": ["black", "red", "leather", "wallet", "bifold", "worn", "card slot"]
}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' }, // Force JSON mode
    max_tokens: 600,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI Vision API')
  }

  try {
    // Clean up content - remove markdown code blocks and any leading/trailing text
    let cleanedContent = content.trim()
    
    // Remove markdown code blocks (handle various formats)
    cleanedContent = cleanedContent.replace(/^```json\s*/i, '')
    cleanedContent = cleanedContent.replace(/^```\s*/i, '')
    cleanedContent = cleanedContent.replace(/\s*```$/i, '')
    
    // Remove any text before the first { or after the last }
    const firstBrace = cleanedContent.indexOf('{')
    const lastBrace = cleanedContent.lastIndexOf('}')
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedContent = cleanedContent.substring(firstBrace, lastBrace + 1)
    }
    
    cleanedContent = cleanedContent.trim()
    
    // Parse JSON
    const parsed = JSON.parse(cleanedContent) as any
    
    // Clean and validate the parsed data with aggressive cleaning
    let cleanTitle = String(parsed.title || parsed.auto_title || '').trim()
    // Remove quotes, "json" prefix, and other artifacts
    cleanTitle = cleanTitle.replace(/^["']|["']$/g, '')
    cleanTitle = cleanTitle.replace(/^json\s*/i, '')
    cleanTitle = cleanTitle.replace(/^```json\s*/i, '')
    cleanTitle = cleanTitle.replace(/^```\s*/i, '')
    cleanTitle = cleanTitle.replace(/\s*```$/i, '')
    cleanTitle = cleanTitle.replace(/^\{.*?"title"\s*:\s*"?([^"]+)"?.*?\}/i, '$1') // Extract from malformed JSON
    cleanTitle = cleanTitle.substring(0, 50).trim()
    
    let cleanDescription = String(parsed.description || parsed.auto_description || '').trim()
    cleanDescription = cleanDescription.replace(/^["']|["']$/g, '')
    cleanDescription = cleanDescription.replace(/^```json\s*/i, '')
    cleanDescription = cleanDescription.replace(/^```\s*/i, '')
    cleanDescription = cleanDescription.replace(/\s*```$/i, '')
    
    // Clean tags - handle various formats
    let cleanTags: string[] = []
    if (Array.isArray(parsed.tags)) {
      cleanTags = parsed.tags
        .map((tag: any) => {
          let cleanTag = String(tag).trim()
          cleanTag = cleanTag.replace(/^["']|["']$/g, '')
          cleanTag = cleanTag.replace(/^json\s*/i, '')
          return cleanTag
        })
        .filter((tag: string) => tag.length > 0 && tag.toLowerCase() !== 'json')
        .slice(0, 15)
    } else if (typeof parsed.tags === 'string') {
      // Handle comma-separated string
      cleanTags = parsed.tags.split(',').map((t: string) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }
    
    // Final validation - ensure title doesn't contain "json" or other artifacts
    if (cleanTitle.toLowerCase().includes('json') || cleanTitle.length < 2) {
      // Try to extract from description or use a generic title
      const descWords = cleanDescription.split(' ').slice(0, 3).join(' ')
      cleanTitle = descWords || 'Found Item'
    }
    
    if (!cleanTitle || !cleanDescription) {
      throw new Error('Missing required fields after cleaning')
    }
    
    return {
      title: cleanTitle,
      description: cleanDescription,
      tags: cleanTags.length > 0 ? cleanTags : ['item'],
    }
  } catch (error) {
    console.error('JSON parsing error:', error)
    console.error('Raw content:', content)
    
    // Fallback - try regex extraction
    try {
      const titleMatch = content.match(/"title"\s*:\s*"([^"]{1,50})"/i) || 
                        content.match(/title["']?\s*:\s*["']?([^"'\n]{1,50})/i)
      const descMatch = content.match(/"description"\s*:\s*"([^"]+)"/i) || 
                       content.match(/description["']?\s*:\s*["']?([^"'\n]+)/i)
      const tagsMatch = content.match(/"tags"\s*:\s*\[([^\]]+)\]/i)
      
      let fallbackTitle = titleMatch?.[1]?.trim() || 'Found Item'
      fallbackTitle = fallbackTitle.replace(/^json\s*/i, '').substring(0, 50)
      
      const fallbackDesc = descMatch?.[1]?.trim() || content.substring(0, 200) || 'A found item'
      
      const fallbackTags = tagsMatch?.[1] 
        ? tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, '').replace(/^json\s*/i, '')).filter(t => t.length > 0 && t.toLowerCase() !== 'json')
        : ['item']
      
      return {
        title: fallbackTitle,
        description: fallbackDesc,
        tags: fallbackTags,
      }
    } catch (fallbackError) {
      console.error('Fallback parsing also failed:', fallbackError)
      return {
        title: 'Found Item',
        description: 'A found item',
        tags: ['item'],
      }
    }
  }
}

