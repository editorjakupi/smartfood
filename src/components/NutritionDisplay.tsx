'use client'

import { useState, useEffect, useRef } from 'react'
import { getUserId } from '@/lib/userId'

interface NutritionDisplayProps {
  foodClass: string
  confidence: number
  nutrition: Record<string, number> | null
  nutritionSource?: string
}

export default function NutritionDisplay({
  foodClass,
  confidence,
  nutrition,
  nutritionSource
}: NutritionDisplayProps) {
  const [recommendations, setRecommendations] = useState<string | null>(null)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const lastSavedRef = useRef<{ key: string; timestamp: number } | null>(null)

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoadingRecs(true)
      setRecError(null)
      try {
        // Get history from database
        const userId = localStorage.getItem('smartfood_user_id')
        if (!userId) {
          setRecommendations('No history available. Start classifying food to get recommendations.')
          setLoadingRecs(false)
          return
        }
        
        const historyResponse = await fetch('/api/history', {
          headers: { 'x-user-id': userId }
        })
        
        if (!historyResponse.ok) {
          throw new Error('Failed to fetch history')
        }
        
        const historyData = await historyResponse.json()
        const history = historyData.history || []

        const response = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nutrition, history })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to get recommendations')
        }

        const data = await response.json()
        setRecommendations(data.recommendations || 'No recommendations available.')
      } catch (error: any) {
        console.error('Recommendations error:', error)
        setRecError(error.message || 'Failed to load recommendations')
      } finally {
        setLoadingRecs(false)
      }
    }

    if (nutrition && foodClass && foodClass !== 'error') {
      // Create a unique key for this classification result (based on data, not time)
      const entryKey = `${foodClass}_${nutrition.calories}_${nutrition.protein}_${nutrition.carbs}_${nutrition.fat}`
      const now = Date.now()
      const DEBOUNCE_MS = 2000 // Only save once per 2 seconds for same classification
      
      // Only save if this is a new entry (different data) OR enough time has passed
      const shouldSave = !lastSavedRef.current || 
                        lastSavedRef.current.key !== entryKey ||
                        (now - lastSavedRef.current.timestamp) > DEBOUNCE_MS
      
      if (shouldSave) {
        lastSavedRef.current = { key: entryKey, timestamp: now }
        
        fetchRecommendations()

        // Save to history (database) - only once per unique classification
        const userId = getUserId()
        
        fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId
          },
          body: JSON.stringify({
            date: new Date().toISOString(),
            foodClass,
            calories: nutrition.calories || 0,
            protein: nutrition.protein || 0,
            carbs: nutrition.carbs || 0,
            fat: nutrition.fat || 0,
            fiber: nutrition.fiber || 0,
            confidence: confidence || 0
          })
        }).catch(err => {
          console.error('Failed to save to database:', err)
          // Reset ref on error so it can retry
          lastSavedRef.current = null
        })
      } else {
        // Entry already saved recently, just fetch recommendations
        fetchRecommendations()
      }
    }
  }, [foodClass, nutrition, confidence])

  const formatFoodName = (name: string) => {
    if (name === 'error') return 'Error'
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (!nutrition || foodClass === 'error') return null

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {formatFoodName(foodClass)}
          </h2>
          <span className={`
            px-3 py-1 rounded-full text-sm font-medium
            ${confidence >= 0.9
              ? 'bg-green-100 text-green-800'
              : confidence >= 0.7
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'}
          `}>
            {(confidence * 100).toFixed(1)}% confidence
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Estimate per 100 g — the app does not measure portion size from the image, only the food type.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {nutrition.calories || 0}
            </div>
            <div className="text-sm text-gray-500">kcal</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {nutrition.protein || 0}g
            </div>
            <div className="text-sm text-gray-500">Protein</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {nutrition.carbs || 0}g
            </div>
            <div className="text-sm text-gray-500">Carbs</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {nutrition.fat || 0}g
            </div>
            <div className="text-sm text-gray-500">Fat</div>
          </div>
        </div>

        {nutrition.fiber !== undefined && (
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <span className="font-medium">Fiber:</span>
            <span className="ml-2">{nutrition.fiber}g</span>
          </div>
        )}

        {nutritionSource && (
          <div className="mt-4 flex items-center text-xs">
            <span className="text-gray-500">Source:</span>
            <span className={`ml-2 font-medium ${
              nutritionSource === 'Livsmedelsverket' 
                ? 'text-green-600' 
                : nutritionSource === 'Open Food Facts'
                  ? 'text-blue-600'
                  : 'text-gray-600'
            }`}>
              {nutritionSource === 'Livsmedelsverket' 
                ? 'Livsmedelsverket (Official)' 
                : nutritionSource === 'Open Food Facts'
                  ? 'Open Food Facts'
                  : 'Estimated'}
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recommendations
        </h3>

        {loadingRecs ? (
          <div className="flex items-center justify-center py-4">
            <span className="loading-spinner"></span>
            <span className="ml-2 text-gray-500">Loading recommendations...</span>
          </div>
        ) : recError ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">{recError}</p>
          </div>
        ) : recommendations ? (
          <div className="prose prose-sm max-w-none text-gray-700">
            {recommendations.split('\n').filter(line => line.trim()).map((line, index) => {
              const trimmedLine = line.trim()
              // Check if line is a heading (starts with **)
              if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                return (
                  <h4 key={index} className="font-bold text-gray-900 mt-4 mb-2 first:mt-0">
                    {trimmedLine.replace(/\*\*/g, '')}
                  </h4>
                )
              }
              // Check if line is a bullet point
              if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
                const content = trimmedLine.replace(/^[•\-\*]\s*/, '')
                // Parse bold text (**text**)
                const parts = content.split(/(\*\*[^*]+\*\*)/g)
                return (
                  <div key={index} className="mb-2 ml-4 flex items-start">
                    <span className="text-gray-500 mr-2">•</span>
                    <span className="flex-1">
                      {parts.map((part, partIndex) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return (
                            <strong key={partIndex} className="font-semibold text-gray-900">
                              {part.replace(/\*\*/g, '')}
                            </strong>
                          )
                        }
                        return <span key={partIndex}>{part}</span>
                      })}
                    </span>
                  </div>
                )
              }
              // Regular paragraph
              const parts = trimmedLine.split(/(\*\*[^*]+\*\*)/g)
              return (
                <p key={index} className="mb-2">
                  {parts.map((part, partIndex) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return (
                        <strong key={partIndex} className="font-semibold text-gray-900">
                          {part.replace(/\*\*/g, '')}
                        </strong>
                      )
                    }
                    return <span key={partIndex}>{part}</span>
                  })}
                </p>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500">No recommendations available.</p>
        )}
      </div>
    </div>
  )
}
