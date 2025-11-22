import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'

export async function POST(request: NextRequest) {
  try {
    const { itemId, proofAnswer } = await request.json()

    if (!itemId || !proofAnswer) {
      return NextResponse.json(
        { error: 'Item ID and proof answer are required' },
        { status: 400 }
      )
    }

    // 1. Fetch the item to get the proof question
    const { data: item, error: fetchError } = await supabaseAdmin
      .from('items_found')
      .select('*')
      .eq('id', itemId)
      .eq('claimed', false)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Item not found or already claimed' },
        { status: 404 }
      )
    }

    // 2. Verify the proof answer using OpenAI
    // We'll use GPT to check if the answer is semantically correct
    const verificationPrompt = `Given this proof question: "${item.proof_question}"
    
And this answer: "${proofAnswer}"

Determine if the answer is correct. Consider:
- Semantic similarity (the answer doesn't need to be word-for-word exact)
- Relevance to the question
- Common variations in phrasing

Respond with only "YES" or "NO".`

    const verificationResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: verificationPrompt,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    })

    const verificationResult = verificationResponse.choices[0]?.message?.content?.trim().toUpperCase()

    if (verificationResult !== 'YES') {
      return NextResponse.json(
        { error: 'Proof answer verification failed. Please check your answer and try again.' },
        { status: 403 }
      )
    }

    // 3. Mark item as claimed
    const { error: updateError } = await supabaseAdmin
      .from('items_found')
      .update({ claimed: true })
      .eq('id', itemId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to claim item' }, { status: 500 })
    }

    // 4. Create claim record
    const { error: claimError } = await supabaseAdmin
      .from('item_claims')
      .insert({
        item_id: itemId,
        proof_answer: proofAnswer,
        verified: true,
      })

    if (claimError) {
      console.error('Claim record error:', claimError)
      // Don't fail the request if claim record fails, item is already marked as claimed
    }

    // 5. Return contact information
    // In a real app, you'd fetch the finder's contact info from a users table
    // For now, we'll return a placeholder
    return NextResponse.json({
      success: true,
      message: 'Item claimed successfully!',
      contactInfo: 'Contact the finder at: finder@example.com (This is a placeholder - implement user contact system)',
    })
  } catch (error) {
    console.error('Error in claim-item API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

