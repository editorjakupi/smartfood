'use client'

import { useState } from 'react'
import FoodClassifier from '@/components/FoodClassifier'
import NutritionDisplay from '@/components/NutritionDisplay'

interface ClassificationResult {
  class: string
  confidence: number
  nutrition: Record<string, number> | null
  nutritionSource?: string
}

export default function Home() {
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleClassification = async (imageData: string) => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error || 'Classification failed')
      }
      
      setResult(data)
    } catch (error: any) {
      console.error('Classification error:', error)
      // Set error result to show user
      setResult({
        class: 'error',
        confidence: 0,
        nutrition: null,
        error: error.message || 'Failed to classify image. Please try again.'
      } as any)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          SmartFood
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload a food image to get classification, nutrition information
          and personalized dietary recommendations.
        </p>
      </div>

      <div className="space-y-8">
        <FoodClassifier
          onClassify={handleClassification}
          loading={loading}
        />
        
        {result && (result as any).error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 mt-2">{(result as any).error}</p>
          </div>
        ) : result ? (
          <NutritionDisplay
            foodClass={result.class}
            confidence={result.confidence}
            nutrition={result.nutrition}
            nutritionSource={result.nutritionSource}
          />
        ) : null}
        {!result && !loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            Upload an image to see nutrition information
          </div>
        )}
      </div>
    </div>
  )
}
