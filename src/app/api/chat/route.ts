import { NextRequest, NextResponse } from 'next/server'

// Configuration - Groq API only (both local and deployment)
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_MODEL = 'llama-3.1-8b-instant'

const SYSTEM_PROMPT = `You are an expert in nutrition and diet. 
You always respond in English with correct grammar.
You use information from food databases to provide accurate answers.
Be concise, practical, and professional.
Give concrete advice and avoid vague formulations.

You have access to the user's eating history, which shows what foods they have consumed and their nutritional values.
When the user asks questions about their diet, eating patterns, or specific foods they've eaten, use this history to provide personalized and relevant answers.
You can reference specific meals, calculate totals, identify patterns, and give advice based on their actual consumption.

CRITICAL: When the user asks about their "latest meal", "last meal", "most recent meal", or "what did I eat last", you MUST:
1. Look at the FIRST entry in the eating history list (which is sorted by most recent first)
2. State the exact food name from that entry
3. State the exact date and time from that entry
4. Do NOT guess or make up information - only use what is explicitly provided in the history

Always be precise and accurate about dates, times, and food names from the history.`

interface Message {
  role: string
  content: string
}

// Call Groq API
async function callGroq(messages: Message[]): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key is not configured. Please set GROQ_API_KEY in your .env file.')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024
    }),
    signal: AbortSignal.timeout(30000) // 30 second timeout
  })

  if (!response.ok) {
    let errorMessage = `Groq API error: ${response.status}`
    if (response.status === 429) {
      errorMessage = 'Too many requests. Groq quota reached. Please try again in a few minutes.'
    } else {
      try {
        const errorData = await response.json()
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch {
        const errorText = await response.text().catch(() => 'Unknown error')
        if (errorText) errorMessage += ` - ${errorText}`
      }
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  if (!content) {
    throw new Error('Empty response from Groq API')
  }
  
  return content
}

// Format eating history for context
function formatHistoryContext(history: any[]): string {
  if (!history || history.length === 0) {
    return 'The user has no eating history yet.'
  }
  
  // Normalize field names - handle both foodClass and food_class
  const normalizedHistory = history.map(entry => ({
    ...entry,
    foodClass: entry.foodClass || entry.food_class || 'Unknown',
    date: entry.date || entry.created_at || new Date().toISOString()
  }))
  
  // Sort by date (most recent first)
  const sortedHistory = [...normalizedHistory].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime()
    const dateB = new Date(b.date || 0).getTime()
    return dateB - dateA
  })
  
  // Take last 20 entries to avoid too long context
  const recentHistory = sortedHistory.slice(0, 20)
  
  // Get the most recent meal (first in sorted list)
  const latestMeal = recentHistory[0]
  const latestMealDate = latestMeal?.date ? new Date(latestMeal.date) : null
  
  // Calculate totals
  const totalCalories = recentHistory.reduce((sum, entry) => sum + (entry.calories || 0), 0)
  const totalProtein = recentHistory.reduce((sum, entry) => sum + (entry.protein || 0), 0)
  const totalCarbs = recentHistory.reduce((sum, entry) => sum + (entry.carbs || 0), 0)
  const totalFat = recentHistory.reduce((sum, entry) => sum + (entry.fat || 0), 0)
  const totalFiber = recentHistory.reduce((sum, entry) => sum + (entry.fiber || 0), 0)
  
  // Format entries with proper date handling
  const entriesText = recentHistory.map((entry, index) => {
    const foodName = (entry.foodClass || 'Unknown').replace(/_/g, ' ')
    let dateStr = 'Unknown date'
    
    if (entry.date) {
      try {
        const entryDate = new Date(entry.date)
        if (!isNaN(entryDate.getTime())) {
          // Format with timezone-aware date
          dateStr = entryDate.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: entryDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        }
      } catch (e) {
        console.error('Date formatting error:', e)
      }
    }
    
    return `${index + 1}. ${foodName} (${dateStr}): ${entry.calories || 0} kcal, ${entry.protein || 0}g protein, ${entry.carbs || 0}g carbs, ${entry.fat || 0}g fat${entry.fiber ? `, ${entry.fiber}g fiber` : ''}`
  }).join('\n')
  
  // Build context with emphasis on latest meal
  let context = `User's recent eating history (last ${recentHistory.length} meals, sorted by most recent first):
${entriesText}

IMPORTANT - Latest Meal Information:
- Most recent meal: ${latestMeal ? (latestMeal.foodClass || 'Unknown').replace(/_/g, ' ') : 'None'}
- Date/Time: ${latestMealDate ? latestMealDate.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: latestMealDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) : 'Unknown'}
- When answering questions about "latest meal", "last meal", "most recent meal", or "what did I eat last", ALWAYS refer to the FIRST entry in the list above, which is the most recent meal.

Total nutrition from recent meals:
- Calories: ${totalCalories} kcal
- Protein: ${totalProtein}g
- Carbohydrates: ${totalCarbs}g
- Fat: ${totalFat}g
- Fiber: ${totalFiber}g

Use this information to answer questions about the user's diet, eating patterns, and provide personalized nutrition advice. Always be accurate about dates, times, and the most recent meal.`
  
  return context
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { messages, context, history } = body
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided or invalid format' },
        { status: 400 }
      )
    }
    
    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return NextResponse.json(
          { error: 'Invalid message format. Each message must have role and content.' },
          { status: 400 }
        )
      }
    }

    // Build conversation with system prompt
    const conversation: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ]
    
    // Add eating history context if provided
    if (history && Array.isArray(history) && history.length > 0) {
      const historyContext = formatHistoryContext(history)
      conversation.push({
        role: 'system',
        content: `Eating History Context:\n${historyContext}`
      })
    }
    
    // Add additional context if provided
    if (context) {
      conversation.push({
        role: 'system',
        content: `Additional Context: ${context}`
      })
    }
    
    // Add user messages
    messages.forEach((msg: Message) => {
      conversation.push({
        role: msg.role,
        content: msg.content
      })
    })

    // Call Groq API
    const responseText = await callGroq(conversation)
    
    return NextResponse.json({
      response: responseText || 'No response available.',
      model: GROQ_MODEL,
      provider: 'groq'
    })
  } catch (error: any) {
    console.error('Chat error:', error)
    
    // More specific error messages
    let errorMessage = 'Chat service is currently unavailable. Please try again later.'
    
    if (error.message?.includes('Groq') || error.message?.includes('API key')) {
      errorMessage = error.message || 'Groq API error. Please check your API key and try again.'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json({
      response: errorMessage,
      model: 'fallback',
      error: true
    })
  }
}
