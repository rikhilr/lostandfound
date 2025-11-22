import { openai } from './client'

export interface ImageAnalysis {
  title: string
  description: string
  tags: string[]
}

/**
 * Analyzes an image using OpenAI Vision API and generates:
 * - Title
 * - Description
 * - Tags
 * - Proof question
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysis> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this image of a found item and provide:
1. A concise title (max 50 characters)
2. A detailed description (2-3 sentences)
3. A list of 5-8 relevant tags (comma-separated)

Format your response as JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ...]
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
    max_tokens: 500,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI Vision API')
  }

  try {
    const parsed = JSON.parse(content) as ImageAnalysis
    return parsed
  } catch (error) {
    // Fallback if JSON parsing fails
    const lines = content.split('\n')
    return {
      title: lines[0]?.replace(/^title:?\s*/i, '') || 'Found Item',
      description: lines.slice(1, 3).join(' ') || 'A found item',
      tags: lines[3]?.split(',').map(t => t.trim()) || [],
    }
  }
}

