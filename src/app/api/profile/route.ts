import { NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'

/**
 * GET /api/profile?userId=xxx – check if a profile (user) exists.
 * Used before login: permanently deleted profiles must not be usable.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')?.trim() ?? null
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }
    const exists = await dbOperations.userExists(userId)
    return NextResponse.json({ exists })
  } catch (error) {
    console.error('Profile exists check error:', error)
    return NextResponse.json(
      { error: 'Failed to check profile' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/profile – register a profile (ensure user row exists).
 * Body: { userId: string }
 * Called when creating a new profile so login from another device works.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : null
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }
    await dbOperations.getOrCreateUser(userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Profile register error:', error)
    return NextResponse.json(
      { error: 'Failed to register profile' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/profile – permanently delete a profile and all its data.
 * Body: { userId: string }
 * Cannot be undone.
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : null
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }
    const deleted = await dbOperations.deleteUserData(userId)
    return NextResponse.json({ deleted })
  } catch (error) {
    console.error('Profile delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete profile' },
      { status: 500 }
    )
  }
}
