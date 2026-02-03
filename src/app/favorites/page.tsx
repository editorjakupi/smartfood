'use client'

import { useState, useEffect } from 'react'
import { getUserId } from '@/lib/userId'
import { formatFoodName } from '@/types/food'

interface FavoriteEntry {
  id: number
  food_class: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggingId, setLoggingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const loadFavorites = async () => {
    const userId = getUserId()
    if (!userId) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const res = await fetch('/api/favorites', { headers: { 'x-user-id': userId } })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load favorites')
      }
      const data = await res.json()
      setFavorites(data.favorites || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load favorites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [])

  const logToday = async (entry: FavoriteEntry) => {
    const userId = getUserId()
    if (!userId) return
    setLoggingId(entry.id)
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          date: new Date().toISOString(),
          foodClass: entry.food_class,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber ?? 0,
          confidence: 1
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to log')
      }
    } catch (e: any) {
      alert(e.message || 'Failed to log')
    } finally {
      setLoggingId(null)
    }
  }

  const removeFavorite = async (id: number) => {
    const userId = getUserId()
    if (!userId) return
    setRemovingId(id)
    try {
      const res = await fetch(`/api/favorites?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      })
      if (!res.ok) throw new Error('Failed to remove')
      await loadFavorites()
    } catch {
      alert('Failed to remove favorite')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Favorites / Quick list</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Log quickly from your saved favorites. Add favorites from the nutrition view after classifying a dish.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading-spinner"></span>
          <span className="ml-2 text-gray-500 dark:text-gray-400">Loading favorites...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      ) : favorites.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
          <p>No favorites saved yet.</p>
          <p className="text-sm mt-2">Classify a dish on the home page and click &quot;Save as favorite&quot; to add it here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {favorites.map((entry) => (
            <li
              key={entry.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{formatFoodName(entry.food_class)}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {entry.calories} kcal · {entry.protein}g protein
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loggingId !== null}
                  onClick={() => logToday(entry)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {loggingId === entry.id ? 'Logging...' : 'Log today'}
                </button>
                <button
                  type="button"
                  disabled={removingId !== null}
                  onClick={() => removeFavorite(entry.id)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
                >
                  {removingId === entry.id ? '...' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
