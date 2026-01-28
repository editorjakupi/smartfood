/**
 * Nutrition-related type definitions.
 */

export interface NutritionValue {
  name: string
  value: number
  unit: string
  euroFIRCode?: string
}

export interface LivsmedelsverketFood {
  nummer: number
  namn: string
  typ: string
  version?: string
}

export interface LivsmedelsverketNutrition {
  namn: string
  euroFIRkod: string
  forkortning: string
  varde: number
  enhet: string
  viktGram: number
}

export interface NutritionSummary {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface DailyNutrition {
  date: string
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalFiber: number
  mealCount: number
}

export interface NutritionGoals {
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  targetFiber: number
}

export const DEFAULT_NUTRITION_GOALS: NutritionGoals = {
  targetCalories: 2000,
  targetProtein: 50,
  targetCarbs: 250,
  targetFat: 65,
  targetFiber: 30
}

export interface NutritionAnalysis {
  current: NutritionSummary
  goals: NutritionGoals
  percentages: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
  status: {
    calories: 'under' | 'optimal' | 'over'
    protein: 'under' | 'optimal' | 'over'
    carbs: 'under' | 'optimal' | 'over'
    fat: 'under' | 'optimal' | 'over'
    fiber: 'under' | 'optimal' | 'over'
  }
}

export function calculateNutritionPercentage(
  current: number,
  target: number
): number {
  if (target === 0) return 0
  return Math.round((current / target) * 100)
}

export function getNutritionStatus(
  percentage: number
): 'under' | 'optimal' | 'over' {
  if (percentage < 80) return 'under'
  if (percentage > 120) return 'over'
  return 'optimal'
}
