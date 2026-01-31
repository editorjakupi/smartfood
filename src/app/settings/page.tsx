'use client'

import { useState, useEffect } from 'react'
import { getUserId } from '@/lib/userId'

export default function SettingsPage() {
  const [caloriesGoal, setCaloriesGoal] = useState<string>('')
  const [proteinGoal, setProteinGoal] = useState<string>('')
  const [fatGoal, setFatGoal] = useState<string>('')
  const [carbsGoal, setCarbsGoal] = useState<string>('')
  const [currentWeight, setCurrentWeight] = useState<string>('')
  const [targetWeight, setTargetWeight] = useState<string>('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const userId = getUserId()
      if (!userId) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/settings', { headers: { 'x-user-id': userId } })
        if (res.ok) {
          const data = await res.json()
          setCaloriesGoal(data.daily_calories_goal != null ? String(data.daily_calories_goal) : '')
          setProteinGoal(data.daily_protein_goal != null ? String(data.daily_protein_goal) : '')
          setFatGoal(data.daily_fat_goal != null ? String(data.daily_fat_goal) : '')
          setCarbsGoal(data.daily_carbs_goal != null ? String(data.daily_carbs_goal) : '')
          setCurrentWeight(data.current_weight_kg != null ? String(data.current_weight_kg) : '')
          setTargetWeight(data.target_weight_kg != null ? String(data.target_weight_kg) : '')
        }
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  const save = async () => {
    const userId = getUserId()
    if (!userId) return
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          dailyCaloriesGoal: caloriesGoal === '' ? null : Math.max(0, parseInt(caloriesGoal, 10) || 0),
          dailyProteinGoal: proteinGoal === '' ? null : Math.max(0, parseInt(proteinGoal, 10) || 0),
          dailyFatGoal: fatGoal === '' ? null : Math.max(0, parseInt(fatGoal, 10) || 0),
          dailyCarbsGoal: carbsGoal === '' ? null : Math.max(0, parseInt(carbsGoal, 10) || 0),
          currentWeightKg: currentWeight === '' ? null : Math.max(0, parseFloat(currentWeight) || 0),
          targetWeightKg: targetWeight === '' ? null : Math.max(0, parseFloat(targetWeight) || 0)
        })
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (_) {
      alert('Failed to save')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading-spinner"></span>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Goals & settings</h1>
        <p className="text-gray-600 dark:text-gray-300">Set your daily nutrition goals. They will appear in your Today summary.</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label htmlFor="calories" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily calorie goal (kcal)</label>
          <input
            id="calories"
            type="number"
            min={0}
            value={caloriesGoal}
            onChange={e => setCaloriesGoal(e.target.value)}
            placeholder="e.g. 2000"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty to hide from summary.</p>
        </div>
        <div>
          <label htmlFor="protein" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily protein goal (g)</label>
          <input
            id="protein"
            type="number"
            min={0}
            value={proteinGoal}
            onChange={e => setProteinGoal(e.target.value)}
            placeholder="e.g. 80"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty to hide from summary.</p>
        </div>
        <div>
          <label htmlFor="fat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily fat goal (g)</label>
          <input
            id="fat"
            type="number"
            min={0}
            value={fatGoal}
            onChange={e => setFatGoal(e.target.value)}
            placeholder="e.g. 65"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty to hide from summary.</p>
        </div>
        <div>
          <label htmlFor="carbs" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily carbs goal (g)</label>
          <input
            id="carbs"
            type="number"
            min={0}
            value={carbsGoal}
            onChange={e => setCarbsGoal(e.target.value)}
            placeholder="e.g. 250"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty to hide from summary.</p>
        </div>
        <div>
          <label htmlFor="currentWeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current weight (kg)</label>
          <input
            id="currentWeight"
            type="number"
            min={0}
            step={0.1}
            value={currentWeight}
            onChange={e => setCurrentWeight(e.target.value)}
            placeholder="e.g. 72"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional. Used with target weight for context.</p>
        </div>
        <div>
          <label htmlFor="targetWeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target weight (kg)</label>
          <input
            id="targetWeight"
            type="number"
            min={0}
            step={0.1}
            value={targetWeight}
            onChange={e => setTargetWeight(e.target.value)}
            placeholder="e.g. 70"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional. Goal weight for weight-related insights.</p>
        </div>
        <button
          type="button"
          onClick={save}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {saved ? 'Saved' : 'Save goals'}
        </button>
      </div>
    </div>
  )
}
