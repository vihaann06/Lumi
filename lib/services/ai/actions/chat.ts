import { NextRequest, NextResponse } from 'next/server'
import { chatWithAI } from './index'

/**
 * POST /api/ai/chat
 * Chat with AI about selected text
 */
export async function POST(request: NextRequest) {
  try {
    const { selectedText, chatHistory, userMessage } = await request.json()
    
    if (!selectedText || !userMessage) {
      return NextResponse.json(
        { error: 'selectedText and userMessage are required' },
        { status: 400 }
      )
    }

    const response = await chatWithAI(
      selectedText,
      chatHistory || [],
      userMessage
    )
    
    return NextResponse.json({ response })
  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}

