/**
 * Portion scaling: nutrition data from APIs is per 100 g.
 * We apply a default estimated portion so history and recommendations
 * reflect "typical serving" intake, not per-100g.
 */

export const DEFAULT_ESTIMATED_PORTION_GRAMS = 150

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
 */
export function scaleNutritionPer100ToPortion(
  nutrition: NutritionPer100,
  portionGrams: number = DEFAULT_ESTIMATED_PORTION_GRAMS
): { calories: number; protein: number; carbs: number; fat: number; fiber: number } {
  const factor = portionGrams / 100
  return {
    calories: Math.round((nutrition.calories || 0) * factor),
    protein: Math.round((nutrition.protein || 0) * factor * 10) / 10,
    carbs: Math.round((nutrition.carbs || 0) * factor * 10) / 10,
    fat: Math.round((nutrition.fat || 0) * factor * 10) / 10,
    fiber: Math.round((nutrition.fiber ?? 0) * factor * 10) / 10
  }
}
