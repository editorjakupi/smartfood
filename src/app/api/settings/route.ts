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
    const settings = await dbOperations.getUserSettings(userId)
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    const body = await request.json().catch(() => ({}))
    const { dailyCaloriesGoal, dailyProteinGoal, dailyFatGoal, dailyCarbsGoal, waterGlasses, currentWeightKg, targetWeightKg } = body
    const updates: { daily_calories_goal?: number | null; daily_protein_goal?: number | null; daily_fat_goal?: number | null; daily_carbs_goal?: number | null; water_glasses?: number; current_weight_kg?: number | null; target_weight_kg?: number | null } = {}
    if (dailyCaloriesGoal !== undefined) {
      updates.daily_calories_goal = (dailyCaloriesGoal === null || dailyCaloriesGoal === '') ? null : (typeof dailyCaloriesGoal === 'number' ? dailyCaloriesGoal : parseInt(dailyCaloriesGoal, 10) || 0)
      if (updates.daily_calories_goal !== null && updates.daily_calories_goal < 0) updates.daily_calories_goal = 0
    }
    if (dailyProteinGoal !== undefined) {
      updates.daily_protein_goal = (dailyProteinGoal === null || dailyProteinGoal === '') ? null : (typeof dailyProteinGoal === 'number' ? dailyProteinGoal : parseInt(dailyProteinGoal, 10) || 0)
      if (updates.daily_protein_goal !== null && updates.daily_protein_goal < 0) updates.daily_protein_goal = 0
    }
    if (dailyFatGoal !== undefined) {
      updates.daily_fat_goal = (dailyFatGoal === null || dailyFatGoal === '') ? null : (typeof dailyFatGoal === 'number' ? dailyFatGoal : parseInt(dailyFatGoal, 10) || 0)
      if (updates.daily_fat_goal !== null && updates.daily_fat_goal < 0) updates.daily_fat_goal = 0
    }
    if (dailyCarbsGoal !== undefined) {
      updates.daily_carbs_goal = (dailyCarbsGoal === null || dailyCarbsGoal === '') ? null : (typeof dailyCarbsGoal === 'number' ? dailyCarbsGoal : parseInt(dailyCarbsGoal, 10) || 0)
      if (updates.daily_carbs_goal !== null && updates.daily_carbs_goal < 0) updates.daily_carbs_goal = 0
    }
    if (typeof waterGlasses === 'number' && waterGlasses >= 0) updates.water_glasses = waterGlasses
    if (currentWeightKg !== undefined) {
      updates.current_weight_kg = (currentWeightKg === null || currentWeightKg === '') ? null : (typeof currentWeightKg === 'number' ? currentWeightKg : parseFloat(currentWeightKg) || 0)
      if (updates.current_weight_kg !== null && updates.current_weight_kg < 0) updates.current_weight_kg = 0
    }
    if (targetWeightKg !== undefined) {
      updates.target_weight_kg = (targetWeightKg === null || targetWeightKg === '') ? null : (typeof targetWeightKg === 'number' ? targetWeightKg : parseFloat(targetWeightKg) || 0)
      if (updates.target_weight_kg !== null && updates.target_weight_kg < 0) updates.target_weight_kg = 0
    }
    const current = await dbOperations.getUserSettings(userId)
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(current)
    }
    if (updates.water_glasses === undefined) {
      updates.water_glasses = current.water_glasses
    }
    await dbOperations.setUserSettings(userId, updates)
    const settings = await dbOperations.getUserSettings(userId)
    // Log today's goals for history (daily goal snapshot)
    const today = new Date().toISOString().slice(0, 10)
    await dbOperations.saveDailyGoalLog(userId, today, {
      calories: settings.daily_calories_goal,
      protein: settings.daily_protein_goal,
      fat: settings.daily_fat_goal,
      carbs: settings.daily_carbs_goal
    })
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Settings PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
