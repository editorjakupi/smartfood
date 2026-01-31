'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { getUserId } from '@/lib/userId'
import { scaleNutritionPer100ToPortion, PORTION_SIZES, type PortionSizeKey } from '@/lib/portion'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]

interface NutritionDisplayProps {
  foodClass: string
  confidence: number
  nutrition: Record<string, number> | null
  nutritionSource?: string
  /** When set, show "(from barcode 123...)" next to the food name. */
  fromBarcode?: string
  /** If true, show "Save to history" button and do not auto-save. If false/undefined, auto-save as before. */
  manualSaveOnly?: boolean
}

export default function NutritionDisplay({
  foodClass,
  confidence,
  nutrition,
  nutritionSource,
  fromBarcode,
  manualSaveOnly = false
}: NutritionDisplayProps) {
  const [portion, setPortion] = useState<PortionSizeKey>('normal')
  const [mealType, setMealType] = useState<MealType | null>(null)
  const [recommendations, setRecommendations] = useState<string | null>(null)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [favoriteSaving, setFavoriteSaving] = useState(false)
  const [favoriteSaved, setFavoriteSaved] = useState(false)
  const [historySaving, setHistorySaving] = useState(false)
  const [historySaved, setHistorySaved] = useState(false)
  const lastSavedRef = useRef<{ key: string; timestamp: number } | null>(null)

  const portionGrams = PORTION_SIZES[portion]
  const scaledNutrition = useMemo(() => {
    if (!nutrition) return null
    return scaleNutritionPer100ToPortion(nutrition, portionGrams)
  }, [nutrition, portionGrams])

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!scaledNutrition) return
      setLoadingRecs(true)
      setRecError(null)
      try {
        const userId = localStorage.getItem('smartfood_user_id')
        if (!userId) {
          setRecommendations('Create or select a profile to get recommendations.')
          setLoadingRecs(false)
          return
        }
        const historyResponse = await fetch('/api/history', { headers: { 'x-user-id': userId } })
        if (!historyResponse.ok) throw new Error('Failed to fetch history')
        const historyData = await historyResponse.json()
        const history = historyData.history || []
        const response = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nutrition: scaledNutrition, history })
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

    if (nutrition && scaledNutrition && foodClass && foodClass !== 'error') {
      if (manualSaveOnly) {
        fetchRecommendations()
        return
      }
      const entryKey = `${foodClass}_${nutrition.calories}_${nutrition.protein}_${portion}_${mealType ?? 'n'}`
      const now = Date.now()
      const DEBOUNCE_MS = 2000
      const shouldSave = !lastSavedRef.current || lastSavedRef.current.key !== entryKey || (now - lastSavedRef.current.timestamp) > DEBOUNCE_MS
      if (shouldSave) {
        lastSavedRef.current = { key: entryKey, timestamp: now }
        fetchRecommendations()
        const userId = getUserId()
        if (userId) {
          fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
            body: JSON.stringify({
              date: new Date().toISOString(),
              foodClass,
              calories: scaledNutrition.calories,
              protein: scaledNutrition.protein,
              carbs: scaledNutrition.carbs,
              fat: scaledNutrition.fat,
              fiber: scaledNutrition.fiber,
              confidence: confidence || 0,
              mealType: mealType || undefined
            })
          }).catch(err => { console.error('Failed to save to database:', err); lastSavedRef.current = null })
        }
      } else {
        fetchRecommendations()
      }
    }
  }, [foodClass, nutrition, scaledNutrition, confidence, portion, mealType, manualSaveOnly])

  const formatFoodName = (name: string) => {
    if (name === 'error') return 'Error'
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (!nutrition || foodClass === 'error' || !scaledNutrition) return null

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {formatFoodName(foodClass)}
            {fromBarcode && (
              <span className="font-normal text-gray-500 dark:text-gray-400 ml-1">
                (from barcode {fromBarcode})
              </span>
            )}
          </h2>
          <span className={`
            px-3 py-1 rounded-full text-sm font-medium
            ${confidence >= 0.9
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : confidence >= 0.7
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}
          `}>
            {(confidence * 100).toFixed(1)}% confidence
          </span>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          The app does not measure portion size from the image, only the food type. Values below are per 100 g and for your selected serving size.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1 self-center">Portion:</span>
          {(Object.keys(PORTION_SIZES) as PortionSizeKey[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPortion(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                portion === p
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {p === 'small' ? 'Small' : p === 'normal' ? 'Normal' : 'Large'} ({PORTION_SIZES[p]} g)
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1 self-center">Meal type:</span>
          {MEAL_TYPES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMealType(mealType === m ? null : m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mealType === m
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {scaledNutrition.calories}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">kcal</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">({nutrition.calories || 0} per 100 g)</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {scaledNutrition.protein}g
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Protein</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">({nutrition.protein || 0}g per 100 g)</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {scaledNutrition.carbs}g
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Carbs</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">({nutrition.carbs || 0}g per 100 g)</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {scaledNutrition.fat}g
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Fat</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">({nutrition.fat || 0}g per 100 g)</div>
          </div>
        </div>

        {(nutrition.fiber !== undefined || scaledNutrition.fiber > 0) && (
          <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Fiber:</span>
            <span className="ml-2">{scaledNutrition.fiber}g ({(nutrition.fiber ?? 0)}g per 100 g)</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {manualSaveOnly && (
            <button
              type="button"
              disabled={historySaving || historySaved}
              onClick={async () => {
                setHistorySaving(true)
                setHistorySaved(false)
                const userId = getUserId()
                if (!userId) {
                  alert('Create or select a profile to save to history.')
                  setHistorySaving(false)
                  return
                }
                try {
                  const res = await fetch('/api/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
                    body: JSON.stringify({
                      date: new Date().toISOString(),
                      foodClass,
                      calories: scaledNutrition.calories,
                      protein: scaledNutrition.protein,
                      carbs: scaledNutrition.carbs,
                      fat: scaledNutrition.fat,
                      fiber: scaledNutrition.fiber ?? 0,
                      confidence: confidence || 0,
                      mealType: mealType || undefined
                    })
                  })
                  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save')
                  setHistorySaved(true)
                } catch (e: any) {
                  alert(e.message || 'Failed to save to history')
                } finally {
                  setHistorySaving(false)
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 min-h-[44px]"
            >
              {historySaved ? '✓ Saved to history' : historySaving ? 'Saving...' : 'Save to history'}
            </button>
          )}
          <button
            type="button"
            disabled={favoriteSaving || favoriteSaved}
            onClick={async () => {
              setFavoriteSaving(true)
              setFavoriteSaved(false)
              try {
                const userId = getUserId()
                const res = await fetch('/api/favorites', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
                  body: JSON.stringify({
                    foodClass,
                    calories: scaledNutrition.calories,
                    protein: scaledNutrition.protein,
                    carbs: scaledNutrition.carbs,
                    fat: scaledNutrition.fat,
                    fiber: scaledNutrition.fiber ?? 0
                  })
                })
                if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save')
                setFavoriteSaved(true)
              } catch {
                setFavoriteSaved(false)
              } finally {
                setFavoriteSaving(false)
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-60"
          >
            {favoriteSaved ? (
              <>✓ Saved to favorites</>
            ) : favoriteSaving ? (
              <>Saving...</>
            ) : (
              <>☆ Save as favorite</>
            )}
          </button>
        </div>

        {nutritionSource && (
          <div className="mt-4 flex items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400">Source:</span>
            <span className={`ml-2 font-medium ${
              nutritionSource === 'Livsmedelsverket' 
                ? 'text-green-600 dark:text-green-400' 
                : nutritionSource === 'Open Food Facts' || nutritionSource === 'barcode'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
            }`}>
              {nutritionSource === 'Livsmedelsverket' 
                ? 'Livsmedelsverket (Official)' 
                : nutritionSource === 'Open Food Facts' || nutritionSource === 'barcode'
                  ? 'Open Food Facts'
                  : 'Estimated'}
            </span>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recommendations
        </h3>

        {loadingRecs ? (
          <div className="flex items-center justify-center py-4">
            <span className="loading-spinner"></span>
            <span className="ml-2 text-gray-500 dark:text-gray-400">Loading recommendations...</span>
          </div>
        ) : recError ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">{recError}</p>
          </div>
        ) : recommendations ? (
          <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert">
            {recommendations.split('\n').filter(line => line.trim()).map((line, index) => {
              const trimmedLine = line.trim()
              // Check if line is a heading (starts with **)
              if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                return (
                  <h4 key={index} className="font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0">
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
                    <span className="text-gray-500 dark:text-gray-400 mr-2">•</span>
                    <span className="flex-1">
                      {parts.map((part, partIndex) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return (
                            <strong key={partIndex} className="font-semibold text-gray-900 dark:text-gray-100">
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
                        <strong key={partIndex} className="font-semibold text-gray-900 dark:text-gray-100">
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
          <p className="text-gray-500 dark:text-gray-400">No recommendations available.</p>
        )}
      </div>
    </div>
  )
}
