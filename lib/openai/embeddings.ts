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
 * Generates an embedding vector for an image using OpenAI's Vision API
 * We use the image description to create a text embedding
 */
export async function getImageEmbedding(imageDescription: string): Promise<number[]> {
  // For images, we generate embeddings from the description
  // In a more advanced setup, you could use a vision-language model
  const combinedText = `Image: ${imageDescription}`
  return getTextEmbedding(combinedText)
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

