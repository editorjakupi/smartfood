import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_ESTIMATED_PORTION_GRAMS } from '@/lib/portion'

// Configuration - Groq API only (both local and deployment)
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_MODEL = 'llama-3.1-8b-instant'

const SYSTEM_PROMPT = `You are a professional nutrition advisor. 
You provide personalized dietary recommendations based on the user's nutritional values and eating history.
Always respond in English.
Be concrete, practical, and actionable.

Format your response as a well-structured list with:
- Clear headings in **bold** for main categories
- Bullet points (•) for each recommendation
- **Bold** key terms and numbers
- Maximum 5-7 recommendations total

Example format:
**Protein Intake**
• Your current meal provides **Xg** of protein. Consider adding **lean protein sources** like chicken or fish to reach your daily goal.

**Calorie Balance**
• This meal contains **X kcal**. Based on your average intake, you're on track for a balanced day.`

interface Message {
  role: string
  content: string
}

interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

interface HistoryEntry {
  date: string
  foodClass: string
  calories: number
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
    throw new Error(errorMessage)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  if (!content) {
    throw new Error('Empty response from Groq API')
  }
  
  return content
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { nutrition, history } = body
    
    // Build context from nutrition and history
    // Include Livsmedelsverket API data if available for better LLM context
    let context = 'User data:\n'
    
    if (nutrition && typeof nutrition === 'object') {
      const nutritionSource = (nutrition as any).source || 'Estimated'
      const isIngredients = nutritionSource === 'ingredients'
      if (isIngredients) {
        context += `Latest meal/recipe nutrition (total from entered ingredients):\n`
      } else {
        context += `Latest meal nutrition (estimated serving of ${DEFAULT_ESTIMATED_PORTION_GRAMS} g; source: ${nutritionSource}):\n`
      }
      context += `- Calories: ${nutrition.calories || 0} kcal\n`
      context += `- Protein: ${nutrition.protein || 0}g\n`
      context += `- Carbohydrates: ${nutrition.carbs || 0}g\n`
      context += `- Fat: ${nutrition.fat || 0}g\n`
      if (nutrition.fiber != null) {
        context += `- Fiber: ${nutrition.fiber}g\n`
      }
      if (isIngredients) {
        context += `\nImportant: These numbers are the total for the ingredients the user entered (this meal/recipe). When giving recommendations, refer to them as "this meal" or "your recipe" (e.g. "${nutrition.calories || 0} kcal", "${nutrition.protein || 0}g protein").\n`
      } else {
        context += `\nImportant: These numbers are the user's estimated meal intake for a typical serving (${DEFAULT_ESTIMATED_PORTION_GRAMS} g), not per 100 g. When giving recommendations, refer to these values as "this meal" or "your latest meal" (e.g. "${nutrition.calories || 0} kcal", "${nutrition.protein || 0}g protein"). Do not suggest they ate only 100 g or treat the values as per-100g.\n`
      }
    }
    
    if (history && Array.isArray(history) && history.length > 0) {
      const totalCalories = history.reduce((sum: number, entry: HistoryEntry) => 
        sum + (entry.calories || 0), 0
      )
      const avgCalories = Math.round(totalCalories / history.length)
      
      const foods = history.slice(-5).map((entry: HistoryEntry) => 
        entry.foodClass?.replace(/_/g, ' ') || 'unknown'
      ).join(', ')
      
      context += `Average calorie intake: ${avgCalories} kcal\n`
      context += `Recent meals: ${foods}\n`
    }

    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: context + '\nProvide dietary recommendations based on this data.' }
    ]

    // Call Groq API
    const responseText = await callGroq(messages)
    
    return NextResponse.json({
      recommendations: responseText || 'No recommendations available.',
      provider: 'groq'
    })
  } catch (error: any) {
    console.error('Recommendations error:', error)
    
    // Return error instead of fallback
    return NextResponse.json({
      error: error.message || 'Failed to get recommendations',
      recommendations: [
        'Eat more vegetables and fruits',
        'Drink at least 8 glasses of water per day',
        'Choose whole grain products',
        'Limit intake of sugar and salt',
        'Try to eat varied'
      ].join('\n'),
      fallback: true
    }, { status: 500 })
  }
}
