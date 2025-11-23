import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.FISH_AUDIO_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Fish Audio API key not configured' }, { status: 500 })
    }

    // Using a standard English voice model ID (from Fish Audio docs examples)
    // You can swap this with any model ID from https://fish.audio/discovery
    const referenceId = '7f92f8afb8ec43bf81429cc1c9199cb1' 

    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        reference_id: referenceId,
        format: "mp3",
        mp3_bitrate: 128,
        normalize: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Fish Audio API error:', errorText)
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: response.status })
    }

    // Get the audio data as an ArrayBuffer
    const audioBuffer = await response.arrayBuffer()

    // Return the audio file with appropriate headers
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })

  } catch (error) {
    console.error('Error in TTS API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}