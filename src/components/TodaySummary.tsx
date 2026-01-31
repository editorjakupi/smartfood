'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getUserId } from '@/lib/userId'

interface HistoryEntry {
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

interface TodaySummaryProps {
  onHistoryLoaded?: (history: HistoryEntry[]) => void
}

export default function TodaySummary({ onHistoryLoaded }: TodaySummaryProps) {
  const [todayKcal, setTodayKcal] = useState<number>(0)
  const [todayProtein, setTodayProtein] = useState<number>(0)
  const [todayFat, setTodayFat] = useState<number>(0)
  const [todayCarbs, setTodayCarbs] = useState<number>(0)
  const [todayMeals, setTodayMeals] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [waterGlasses, setWaterGlasses] = useState<number>(0)
  const [caloriesGoal, setCaloriesGoal] = useState<number | null>(null)
  const [proteinGoal, setProteinGoal] = useState<number | null>(null)
  const [fatGoal, setFatGoal] = useState<number | null>(null)
  const [carbsGoal, setCarbsGoal] = useState<number | null>(null)
  const [avgDailyKcal, setAvgDailyKcal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const refresh = async () => {
    const uid = getUserId()
    setUserId(uid)
    if (!uid) {
      setLoading(false)
      return
    }
    try {
      const [historyRes, settingsRes] = await Promise.all([
        fetch('/api/history', { headers: { 'x-user-id': uid } }),
        fetch('/api/settings', { headers: { 'x-user-id': uid } })
      ])
      if (historyRes.ok) {
        const data = await historyRes.json()
        const history: HistoryEntry[] = data.history || []
        onHistoryLoaded?.(history)
        const today = new Date().toISOString().slice(0, 10)
        const todayEntries = history.filter((e: HistoryEntry) => e.date?.slice(0, 10) === today)
        const kcal = todayEntries.reduce((s: number, e: HistoryEntry) => s + (e.calories || 0), 0)
        const protein = todayEntries.reduce((s: number, e: HistoryEntry) => s + (e.protein || 0), 0)
        const fat = todayEntries.reduce((s: number, e: HistoryEntry) => s + (e.fat || 0), 0)
        const carbs = todayEntries.reduce((s: number, e: HistoryEntry) => s + (e.carbs || 0), 0)
        setTodayKcal(Math.round(kcal))
        setTodayProtein(Math.round(protein * 10) / 10)
        setTodayFat(Math.round(fat * 10) / 10)
        setTodayCarbs(Math.round(carbs * 10) / 10)
        setTodayMeals(todayEntries.length)
        const dateSet = new Set(history.map((e: HistoryEntry) => e.date?.slice(0, 10)).filter(Boolean))
        let str = 0
        const cur = new Date(today)
        while (dateSet.has(cur.toISOString().slice(0, 10))) {
          str++
          cur.setDate(cur.getDate() - 1)
        }
        setStreak(str)
        const byDay: Record<string, number> = {}
        history.forEach((e: HistoryEntry) => {
          const d = e.date?.slice(0, 10)
          if (d) {
            byDay[d] = (byDay[d] || 0) + (e.calories || 0)
          }
        })
        const dailyTotals = Object.values(byDay)
        const avg = dailyTotals.length > 0 ? dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length : null
        setAvgDailyKcal(avg != null ? Math.round(avg) : null)
      }
      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        setCaloriesGoal(settings.daily_calories_goal ?? null)
        setProteinGoal(settings.daily_protein_goal ?? null)
        setFatGoal(settings.daily_fat_goal ?? null)
        setCarbsGoal(settings.daily_carbs_goal ?? null)
        setWaterGlasses(settings.water_glasses ?? 0)
      }
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const addWater = async () => {
    const uid = getUserId()
    if (!uid) return
    try {
      const res = await fetch('/api/water', { method: 'POST', headers: { 'x-user-id': uid } })
      if (res.ok) {
        const data = await res.json()
        setWaterGlasses(data.glasses ?? waterGlasses + 1)
      }
    } catch (_) {}
  }

  if (loading || !userId) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Today</h2>
        <Link href="/settings" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300">Goals & settings</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{todayMeals}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">meals</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{todayKcal}{caloriesGoal != null ? ` / ${caloriesGoal}` : ''}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">kcal {caloriesGoal != null ? '(eaten / goal)' : ''}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{todayProtein} g{proteinGoal != null ? ` / ${proteinGoal} g` : ''}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">protein {proteinGoal != null ? '(eaten / goal)' : ''}</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-orange-700 dark:text-orange-400">{todayFat} g{fatGoal != null ? ` / ${fatGoal} g` : ''}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">fat {fatGoal != null ? '(eaten / goal)' : ''}</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-amber-800 dark:text-amber-300">{todayCarbs} g{carbsGoal != null ? ` / ${carbsGoal} g` : ''}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">carbs {carbsGoal != null ? '(eaten / goal)' : ''}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-700 dark:text-green-400">{streak}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">day streak</div>
        </div>
      </div>
      {avgDailyKcal != null && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Your average daily intake: <strong className="text-gray-900 dark:text-gray-100">{avgDailyKcal} kcal</strong>
          {todayKcal > 0 && (
            <span className="ml-2">
              {todayKcal > avgDailyKcal ? '(Today above average)' : todayKcal < avgDailyKcal ? '(Today below average)' : '(Today on average)'}
            </span>
          )}
        </p>
      )}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-600 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm text-gray-600 dark:text-gray-300">Water: {waterGlasses} glasses today</span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Track hydration (e.g. toward 8 glasses). Tap +1 when you drink a glass.</p>
        </div>
        <button type="button" onClick={addWater} className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 shrink-0">+1 glass</button>
      </div>
    </div>
  )
}
