import { openai } from './client'

/**
 * Generates an embedding vector for text using OpenAI's text-embedding-3-small model
 * Uses the larger model for better accuracy
 */
export async function getTextEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
}

/**
 * Generates a search-optimized embedding that matches how found items are structured
 * This ensures search queries align with how found items store their embeddings
 */
export async function getSearchEmbedding(searchQuery: string, location?: string): Promise<number[]> {
  // Structure the search query to match how found items store their text embedding
  // Found items use: `${title} ${description} ${tags.join(' ')}`
  // We simulate this structure for better matching
  
  const baseText = location ? `${searchQuery} ${location}`.trim() : searchQuery.trim()
  
  // Extract meaningful terms (words longer than 2 chars, excluding common words)
  const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'])
  const searchTerms = baseText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !commonWords.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 0)
  
  // Build structured text similar to found items: title + description + tags
  // This matches the text portion of found items' combined embedding
  const structuredText = `${baseText} ${searchTerms.join(' ')}`
  
  return getTextEmbedding(structuredText)
}

/**
 * Generates an embedding vector directly from image analysis
 * Creates a comprehensive embedding from visual description
 */
export async function getImageEmbedding(imageAnalysis: { description: string; tags: string[] }): Promise<number[]> {
  // Create a rich text representation focusing on visual features
  const visualDescription = `Visual item: ${imageAnalysis.description}. Features: ${imageAnalysis.tags.join(', ')}. Colors, materials, brand, size, shape, condition, unique marks.`
  return getTextEmbedding(visualDescription)
}

/**
 * Combines image and text embeddings by averaging them
 */
export function combineEmbeddings(imageEmbedding: number[], textEmbedding: number[]): number[] {
  if (imageEmbedding.length !== textEmbedding.length) {
    throw new Error('Embeddings must have the same dimension')
  }

  return imageEmbedding.map((val, idx) => (val + textEmbedding[idx]) / 2)
}

