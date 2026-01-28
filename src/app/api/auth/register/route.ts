import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await dbOperations.getAuthUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await dbOperations.createAuthUser({
      id: userId,
      email,
      name: name || null,
      password_hash
    })

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId
    })
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Failed to create user', message: error.message },
      { status: 500 }
    )
  }
}
