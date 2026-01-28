'use client'

import { useState, useCallback } from 'react'
import type { ClassificationResult, NutritionData } from '@/types/food'

interface UseClassifierResult {
  result: ClassificationResult | null
  nutrition: NutritionData | null
  loading: boolean
  error: string | null
  classify: (imageData: string) => Promise<void>
  reset: () => void
}

export function useFoodClassifier(): UseClassifierResult {
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [nutrition, setNutrition] = useState<NutritionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const classify = useCallback(async (imageData: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // Classify image
      const classifyResponse = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      })
      
      if (!classifyResponse.ok) {
        const errorData = await classifyResponse.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${classifyResponse.status}`)
      }
      
      const classifyData = await classifyResponse.json()
      
      if (classifyData.error) {
        throw new Error(classifyData.error || 'Classification failed')
      }
      
      if (!classifyData.class) {
        throw new Error('Invalid response from classification API')
      }
      
      setResult({
        class: classifyData.class,
        confidence: classifyData.confidence || 0
      })
      
      // Set nutrition from classification response or fetch separately
      if (classifyData.nutrition) {
        setNutrition(classifyData.nutrition)
      } else if (classifyData.class) {
        // Fetch nutrition data
        const nutritionResponse = await fetch('/api/nutrition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foodClass: classifyData.class })
        })
        
        if (nutritionResponse.ok) {
          const nutritionData = await nutritionResponse.json()
          if (nutritionData.nutrition) {
            setNutrition(nutritionData.nutrition)
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      console.error('Classification error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setNutrition(null)
    setError(null)
  }, [])

  return {
    result,
    nutrition,
    loading,
    error,
    classify,
    reset
  }
}

export default useFoodClassifier
