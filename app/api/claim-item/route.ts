import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { itemId, claimerContact } = await request.json()

    if (!itemId || !claimerContact) {
      return NextResponse.json(
        { error: 'Item ID and your contact information are required' },
        { status: 400 }
      )
    }

    // 1. Fetch the item to get the finder's contact info
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

    // 2. Mark item as claimed
    const { error: updateError } = await supabaseAdmin
      .from('items_found')
      .update({ claimed: true })
      .eq('id', itemId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to claim item' }, { status: 500 })
    }

    // 3. Create claim record
    const { error: claimError } = await supabaseAdmin
      .from('item_claims')
      .insert({
        item_id: itemId,
        claimer_contact: claimerContact,
      })

    if (claimError) {
      console.error('Claim record error:', claimError)
      // Don't fail the request if claim record fails, item is already marked as claimed
    }

    // 4. Return finder's contact information for email
    return NextResponse.json({
      success: true,
      message: 'Item claimed successfully! Contact the finder to arrange pickup.',
      finderContact: item.contact_info,
      finderEmail: item.contact_info.includes('@') ? item.contact_info : null,
    })
  } catch (error) {
    console.error('Error in claim-item API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

