/**
 * Food-related type definitions.
 */

export interface FoodClass {
  id: number
  name: string
  displayName: string
}

export interface ClassificationResult {
  class: string
  confidence: number
  topK?: Array<{
    class: string
    confidence: number
  }>
}

export interface FoodItem {
  class: string
  confidence: number
  nutrition: NutritionData | null
  timestamp: string
}

export interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  [key: string]: number
}

export interface HistoryEntry {
  id?: number
  date: string
  foodClass: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  mealType?: string | null
}

export interface PatternAnalysis {
  totalMeals: number
  uniqueFoods: number
  mostCommon: {
    food: string
    count: number
  } | null
  varietyScore: number
  patterns: string[]
}

export interface FoodPrediction {
  food: string
  confidence: number
}

/** Format food class (e.g. french_fries → French Fries) for display. */
export function formatFoodName(name: string): string {
  if (name === 'error') return 'Error'
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}
