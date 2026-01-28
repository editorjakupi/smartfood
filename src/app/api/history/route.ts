import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || request.cookies.get('smartfood_user_id')?.value || 'anonymous'
    
    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }
    
    // Ensure user exists
    await dbOperations.getOrCreateUser(userId)
    
    const history = await dbOperations.getUserHistory(userId)
    
    // Map database field names (food_class) to frontend field names (foodClass)
    const mappedHistory = (history || []).map(entry => ({
      date: entry.date,
      foodClass: entry.food_class || entry.foodClass || '',
      calories: entry.calories || 0,
      protein: entry.protein || 0,
      carbs: entry.carbs || 0,
      fat: entry.fat || 0,
      fiber: entry.fiber || 0,
      confidence: entry.confidence || 0
    }))
    
    return NextResponse.json({ history: mappedHistory })
  } catch (error: any) {
    console.error('History fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch history',
        message: error.message || 'Database error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || request.cookies.get('smartfood_user_id')?.value || 'anonymous'
    
    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json().catch(() => ({}))
    const { date, foodClass, calories, protein, carbs, fat, fiber, confidence } = body
    
    // Validate required fields
    if (!foodClass || typeof foodClass !== 'string' || foodClass.trim().length === 0) {
      return NextResponse.json(
        { error: 'Food class is required' },
        { status: 400 }
      )
    }
    
    // Validate numeric fields
    const numCalories = typeof calories === 'number' ? calories : parseFloat(calories) || 0
    const numProtein = typeof protein === 'number' ? protein : parseFloat(protein) || 0
    const numCarbs = typeof carbs === 'number' ? carbs : parseFloat(carbs) || 0
    const numFat = typeof fat === 'number' ? fat : parseFloat(fat) || 0
    const numFiber = typeof fiber === 'number' ? fiber : parseFloat(fiber) || 0
    const numConfidence = typeof confidence === 'number' ? confidence : parseFloat(confidence) || 0
    
    // Ensure user exists
    await dbOperations.getOrCreateUser(userId)
    
    const entryId = await dbOperations.addFoodEntry({
      user_id: userId,
      date: date || new Date().toISOString(),
      food_class: foodClass.trim(),
      calories: Math.max(0, numCalories),
      protein: Math.max(0, numProtein),
      carbs: Math.max(0, numCarbs),
      fat: Math.max(0, numFat),
      fiber: Math.max(0, numFiber),
      confidence: Math.max(0, Math.min(1, numConfidence))
    })
    
    return NextResponse.json({ success: true, id: entryId })
  } catch (error: any) {
    console.error('History save error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save history',
        message: error.message || 'Database error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || request.cookies.get('smartfood_user_id')?.value || 'anonymous'
    
    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('id')
    
    if (entryId) {
      // Delete specific entry
      const entryIdNum = parseInt(entryId)
      if (isNaN(entryIdNum) || entryIdNum <= 0) {
        return NextResponse.json(
          { error: 'Invalid entry ID' },
          { status: 400 }
        )
      }
      const deleted = await dbOperations.deleteFoodEntry(entryIdNum, userId)
      return NextResponse.json({ success: deleted })
    } else {
      // Delete all user history
      await dbOperations.deleteUserHistory(userId)
      return NextResponse.json({ success: true })
    }
  } catch (error: any) {
    console.error('History delete error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete history',
        message: error.message || 'Database error'
      },
      { status: 500 }
    )
  }
}
