import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id') || request.cookies.get('smartfood_user_id')?.value || null
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    const glasses = await dbOperations.addWater(userId)
    return NextResponse.json({ glasses })
  } catch (error: any) {
    console.error('Water POST error:', error)
    return NextResponse.json({ error: 'Failed to add water' }, { status: 500 })
  }
}
