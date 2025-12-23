import { NextRequest, NextResponse } from 'next/server'
import { getAIExplanation } from '@/lib/services/ai/openaiService'

/**
 * POST /api/ai/explain
 * Get AI explanation for selected text
 */
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const explanation = await getAIExplanation(text)
    
    return NextResponse.json({ explanation })
  } catch (error) {
    console.error('Error getting AI explanation:', error)
    return NextResponse.json(
      { error: 'Failed to get explanation' },
      { status: 500 }
    )
  }
}

