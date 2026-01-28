/**
 * API-related type definitions.
 */

export interface APIResponse<T> {
  data?: T
  error?: string
  status: number
}

export interface ClassifyRequest {
  image: string
}

export interface ClassifyResponse {
  class: string
  confidence: number
  nutrition: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
  } | null
}

export interface NutritionRequest {
  foodClass: string
}

export interface NutritionResponse {
  source: 'Livsmedelsverket' | 'Estimated'
  foodName: string
  nutrition: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  context?: string
}

export interface ChatResponse {
  response: string
  model: string
  error?: boolean
}

export interface RecommendationsRequest {
  nutrition: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  history: Array<{
    date: string
    foodClass: string
    calories: number
  }>
}

export interface RecommendationsResponse {
  recommendations: string
  fallback?: boolean
}
