import { openai } from './client'

/**
 * Generates an embedding vector for text using OpenAI's text-embedding-3-small model
 */
export async function getTextEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
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

