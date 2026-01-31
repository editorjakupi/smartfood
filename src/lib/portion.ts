/**
 * Portion scaling: nutrition data from APIs is per 100 g.
 * We apply a default estimated portion so history and recommendations
 * reflect "typical serving" intake, not per-100g.
 */

export const DEFAULT_ESTIMATED_PORTION_GRAMS = 150

/** Portion size presets: Small / Normal / Large (grams). */
export const PORTION_SIZES = {
  small: 100,
  normal: 150,
  large: 220
} as const
export type PortionSizeKey = keyof typeof PORTION_SIZES

export interface NutritionPer100 {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

/**
 * Scale per-100g nutrition to an estimated portion.
 * e.g. 88 kcal/100g, 150g portion → 132 kcal for the meal.
 * Accepts NutritionPer100 or Record<string, number> (API responses).
 */
export function scaleNutritionPer100ToPortion(
  nutrition: NutritionPer100 | Record<string, number>,
  portionGrams: number = DEFAULT_ESTIMATED_PORTION_GRAMS
): { calories: number; protein: number; carbs: number; fat: number; fiber: number } {
  const factor = portionGrams / 100
  const c = (nutrition as Record<string, number>).calories ?? 0
  const p = (nutrition as Record<string, number>).protein ?? 0
  const ch = (nutrition as Record<string, number>).carbs ?? 0
  const f = (nutrition as Record<string, number>).fat ?? 0
  const fib = (nutrition as Record<string, number>).fiber ?? 0
  return {
    calories: Math.round(c * factor),
    protein: Math.round(p * factor * 10) / 10,
    carbs: Math.round(ch * factor * 10) / 10,
    fat: Math.round(f * factor * 10) / 10,
    fiber: Math.round(fib * factor * 10) / 10
  }
}
