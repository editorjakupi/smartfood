import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id') || request.cookies.get('smartfood_user_id')?.value || null
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    const favorites = await dbOperations.getFavorites(userId)
    return NextResponse.json({ favorites })
  } catch (error: any) {
    console.error('Favorites GET error:', error)
    return NextResponse.json({ error: 'Failed to load favorites' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    const body = await request.json().catch(() => ({}))
    const { foodClass, calories, protein, carbs, fat, fiber } = body
    if (!foodClass || typeof foodClass !== 'string' || foodClass.trim().length === 0) {
      return NextResponse.json({ error: 'foodClass is required' }, { status: 400 })
    }
    const id = await dbOperations.addFavorite(userId, {
      food_class: foodClass.trim(),
      calories: typeof calories === 'number' ? calories : parseFloat(calories) || 0,
      protein: typeof protein === 'number' ? protein : parseFloat(protein) || 0,
      carbs: typeof carbs === 'number' ? carbs : parseFloat(carbs) || 0,
      fat: typeof fat === 'number' ? fat : parseFloat(fat) || 0,
      fiber: typeof fiber === 'number' ? fiber : parseFloat(fiber) || 0
    })
    return NextResponse.json({ success: true, id })
  } catch (error: any) {
    console.error('Favorites POST error:', error)
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const idNum = parseInt(id, 10)
    if (isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const deleted = await dbOperations.removeFavorite(idNum, userId)
    return NextResponse.json({ success: deleted })
  } catch (error: any) {
    console.error('Favorites DELETE error:', error)
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 })
  }
}
