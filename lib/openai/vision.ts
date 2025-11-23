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
    return analyzeImage(imageUrls[0])
  }

  // Analyze all images in parallel
  const analyses = await Promise.all(
    imageUrls.map(url => analyzeImage(url))
  )

  // Use LLM to intelligently combine the analyses
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `You have ${analyses.length} different analyses of the same lost/found item from different angles/views. Synthesize them into one coherent analysis.

Individual analyses:
${analyses.map((a, i) => `
View ${i + 1}:
Title: ${a.title}
Description: ${a.description}
Tags: ${a.tags.join(', ')}
`).join('\n')}

Create a unified analysis that:
1. Identifies the most accurate and descriptive title
2. Combines descriptions into a coherent narrative (not just concatenating)
3. Prioritizes the most important and consistent visual features
4. Removes duplicate or redundant tags
5. Highlights any identifying information (names, IDs, etc.)

Return JSON with:
{
  "title": "Most accurate item name based on all views",
  "description": "Coherent 2-3 sentence description combining key details from all views",
  "tags": ["15 most relevant tags, removing duplicates and prioritizing identifying features"]
}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  const parsed = JSON.parse(content)
  
  return {
    title: parsed.title?.substring(0, 50) || 'Found Item',
    description: parsed.description || 'A found item',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 15) : ['item'],
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
- Names or other identifying information that could be linked to a person

Return a JSON object with exactly these fields:
{
  "title": "Brief item name (max 60 chars)",
  "description": "Detailed 2-3 sentence description focusing on visual identifying features like colors, materials, brand, size, condition, and info like name or student id number and unique marks",
  "tags": ["color1", "color2", "material", "brand", "type", "condition", "feature1", "feature2", "name", "student id number"]
}

Example:
{
  "title": "Black Leather Wallet",
  "description": "A black leather wallet with a red stripe on the left side. The wallet shows moderate wear with scuff marks on the corners. It has a visible card slot and appears to be a bifold design.",
  "tags": ["black", "red", "leather", "wallet", "bifold", "worn", "card slot"]
}
Example:
{
  "title": "John Doe Student ID Card",
  "description": "A student ID card with the name John Doe and the student ID number 1234567890. The card is made of plastic and has a barcode on the back. The card is in good condition and shows no signs of wear.",
  "tags": ["John Doe", "1234567890", "student id", "plastic", "barcode"]
}
Example:
{
  "title": "Green Iphone 17",
  "description": "A green iPhone 17 with a glass back and a metal frame. The phone is in good condition and shows no signs of wear.",
  "tags": ["green", "iPhone 17", "glass back", "metal frame", "good condition", "no wear"]
}

Example:
{
  "title": "Adidas Sneakers",
  "description": "A pair of Adidas sneakers with a white upper and a black sole. The sneakers are in good condition and shows no signs of wear.",
  "tags": ["Adidas", "sneakers", "white", "black", "good condition", "no wear"]
}

`,
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
    max_tokens: 1000,
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

