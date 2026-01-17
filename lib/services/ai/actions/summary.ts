import { NextRequest, NextResponse } from 'next/server'
import { getAISummary } from './index'

/**
 * POST /api/ai/summary
 * Get AI summary for selected text
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

    const summary = await getAISummary(text)
    
    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Error getting AI summary:', error)
    return NextResponse.json(
      { error: 'Failed to get summary' },
      { status: 500 }
    )
  }
}

