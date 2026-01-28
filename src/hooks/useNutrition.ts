'use client'

import { useState, useCallback, useEffect } from 'react'
import type { NutritionData, HistoryEntry } from '@/types/food'
import type { NutritionGoals, NutritionAnalysis } from '@/types/nutrition'
import { DEFAULT_NUTRITION_GOALS, calculateNutritionPercentage, getNutritionStatus } from '@/types/nutrition'

interface UseNutritionResult {
  history: HistoryEntry[]
  todayTotal: NutritionData
  analysis: NutritionAnalysis | null
  addEntry: (entry: Omit<HistoryEntry, 'date'>) => void
  clearHistory: () => void
  setGoals: (goals: NutritionGoals) => void
}

const HISTORY_KEY = 'food_history'
const GOALS_KEY = 'nutrition_goals'

export function useNutrition(): UseNutritionResult {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [goals, setGoalsState] = useState<NutritionGoals>(DEFAULT_NUTRITION_GOALS)

  // Load history from database
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const userId = localStorage.getItem('smartfood_user_id')
        if (userId) {
          try {
            const response = await fetch('/api/history', {
              headers: { 'x-user-id': userId }
            })
            
            if (response.ok) {
              const data = await response.json()
              setHistory(data.history || [])
              return // Success, don't check localStorage
            }
          } catch (fetchError) {
            // Continue to localStorage fallback
          }
        }
        
        // Fallback to localStorage if API fails or no userId
        const stored = localStorage.getItem(HISTORY_KEY)
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) {
              setHistory(parsed)
            }
          } catch {
            // Invalid JSON, ignore
          }
        }
        
        const storedGoals = localStorage.getItem(GOALS_KEY)
        if (storedGoals) {
          try {
            const parsed = JSON.parse(storedGoals)
            setGoalsState(parsed)
          } catch {
            // Invalid JSON, ignore
          }
        }
      } catch (error) {
        console.error('Error loading history:', error)
      }
    }
    
    loadHistory()
  }, [])

  // Calculate today's total
  const todayTotal: NutritionData = history
    .filter(entry => {
      const entryDate = new Date(entry.date).toDateString()
      const today = new Date().toDateString()
      return entryDate === today
    })
    .reduce(
      (acc, entry) => ({
        calories: acc.calories + (entry.calories || 0),
        protein: acc.protein + (entry.protein || 0),
        carbs: acc.carbs + (entry.carbs || 0),
        fat: acc.fat + (entry.fat || 0),
        fiber: acc.fiber + 0 // fiber not in history entry
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    )

  // Calculate analysis
  const analysis: NutritionAnalysis = {
    current: todayTotal,
    goals,
    percentages: {
      calories: calculateNutritionPercentage(todayTotal.calories, goals.targetCalories),
      protein: calculateNutritionPercentage(todayTotal.protein, goals.targetProtein),
      carbs: calculateNutritionPercentage(todayTotal.carbs, goals.targetCarbs),
      fat: calculateNutritionPercentage(todayTotal.fat, goals.targetFat),
      fiber: calculateNutritionPercentage(todayTotal.fiber, goals.targetFiber)
    },
    status: {
      calories: getNutritionStatus(calculateNutritionPercentage(todayTotal.calories, goals.targetCalories)),
      protein: getNutritionStatus(calculateNutritionPercentage(todayTotal.protein, goals.targetProtein)),
      carbs: getNutritionStatus(calculateNutritionPercentage(todayTotal.carbs, goals.targetCarbs)),
      fat: getNutritionStatus(calculateNutritionPercentage(todayTotal.fat, goals.targetFat)),
      fiber: getNutritionStatus(calculateNutritionPercentage(todayTotal.fiber, goals.targetFiber))
    }
  }

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'date'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      date: new Date().toISOString()
    }
    
    setHistory(prev => {
      const updated = [...prev, newEntry].slice(-100) // Keep last 100
      // Save to database
      const userId = localStorage.getItem('smartfood_user_id')
      if (userId) {
        fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId
          },
          body: JSON.stringify({
            date: newEntry.date,
            foodClass: newEntry.foodClass,
            calories: newEntry.calories || 0,
            protein: newEntry.protein || 0,
            carbs: newEntry.carbs || 0,
            fat: newEntry.fat || 0,
            fiber: newEntry.fiber || 0
          })
        }).catch(err => console.error('Failed to save to database:', err))
      }
      
      // Legacy: Also save to localStorage for backward compatibility
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    if (!confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      return
    }
    
    setHistory([])
    // Delete from database
    const userId = localStorage.getItem('smartfood_user_id')
    if (userId) {
      fetch('/api/history', {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      }).catch(err => {
        console.error('Failed to delete from database:', err)
        // Still remove from localStorage even if API fails
        localStorage.removeItem(HISTORY_KEY)
      })
    }
    
    // Also remove from localStorage
    localStorage.removeItem(HISTORY_KEY)
  }, [])

  const setGoals = useCallback((newGoals: NutritionGoals) => {
    setGoalsState(newGoals)
    localStorage.setItem(GOALS_KEY, JSON.stringify(newGoals))
  }, [])

  return {
    history,
    todayTotal,
    analysis,
    addEntry,
    clearHistory,
    setGoals
  }
}

export default useNutrition
