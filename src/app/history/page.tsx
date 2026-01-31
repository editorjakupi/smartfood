'use client'

import { useState, useEffect } from 'react'
import HistoryChart from '@/components/HistoryChart'
import type { HistoryEntry } from '@/types/food'
import { getUserId } from '@/lib/userId'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Manual add form state
  const [addFoodClass, setAddFoodClass] = useState('')
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [addCalories, setAddCalories] = useState('')
  const [addProtein, setAddProtein] = useState('')
  const [addCarbs, setAddCarbs] = useState('')
  const [addFat, setAddFat] = useState('')
  const [addFiber, setAddFiber] = useState('')
  const [addMealType, setAddMealType] = useState<string>('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setError(null)
        const userId = getUserId()
        if (!userId) {
          setLoading(false)
          return
        }
        const response = await fetch('/api/history', { headers: { 'x-user-id': userId } })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load history')
        }
        const data = await response.json()
        if (!cancelled) setHistory(data.history || [])
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const loadHistory = async () => {
    const userId = getUserId()
    if (!userId) return
    try {
      const res = await fetch('/api/history', { headers: { 'x-user-id': userId } })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setHistory(data.history || [])
    } catch (_) {}
  }

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault()
    const userId = getUserId()
    if (!userId) return
    const foodClass = addFoodClass.trim().replace(/\s+/g, '_')
    if (!foodClass) {
      setAddError('Enter food name')
      return
    }
    const calories = parseFloat(addCalories) || 0
    const protein = parseFloat(addProtein) || 0
    const carbs = parseFloat(addCarbs) || 0
    const fat = parseFloat(addFat) || 0
    const fiber = parseFloat(addFiber) || 0
    setAddSaving(true)
    setAddError(null)
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          date: new Date(addDate).toISOString(),
          foodClass,
          calories,
          protein,
          carbs,
          fat,
          fiber,
          confidence: 0,
          mealType: addMealType || undefined
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }
      await loadHistory()
      setAddFoodClass('')
      setAddDate(new Date().toISOString().slice(0, 16))
      setAddCalories('')
      setAddProtein('')
      setAddCarbs('')
      setAddFat('')
      setAddFiber('')
      setAddMealType('')
      setShowAddForm(false)
    } catch (err: any) {
      setAddError(err.message || 'Failed to save')
    } finally {
      setAddSaving(false)
    }
  }

  const logAgain = async (entry: HistoryEntry) => {
    const userId = getUserId()
    if (!userId) return
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          date: new Date().toISOString(),
          foodClass: entry.foodClass,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber ?? 0,
          confidence: 1,
          mealType: entry.mealType ?? undefined
        })
      })
      if (!res.ok) throw new Error('Failed to log')
      await loadHistory()
    } catch (e: any) {
      alert(e.message || 'Failed to log again')
    }
  }

  const deleteEntry = async (id: number) => {
    const userId = getUserId()
    if (!userId) return
    if (!confirm('Remove this entry from history?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/history?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId }
      })
      if (!res.ok) throw new Error('Failed to remove')
      await loadHistory()
    } catch (e: any) {
      alert(e.message || 'Failed to remove')
    } finally {
      setDeletingId(null)
    }
  }

  const saveEdit = async (entry: HistoryEntry, updates: Partial<HistoryEntry>) => {
    const userId = getUserId()
    if (!userId || entry.id == null) return
    try {
      const res = await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          id: entry.id,
          date: updates.date ?? entry.date,
          foodClass: (updates.foodClass ?? entry.foodClass)?.trim().replace(/\s+/g, '_'),
          calories: updates.calories ?? entry.calories,
          protein: updates.protein ?? entry.protein,
          carbs: updates.carbs ?? entry.carbs,
          fat: updates.fat ?? entry.fat,
          fiber: updates.fiber ?? entry.fiber ?? 0,
          mealType: updates.mealType !== undefined ? updates.mealType : entry.mealType
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }
      await loadHistory()
      setEditingId(null)
    } catch (e: any) {
      alert(e.message || 'Failed to save changes')
    }
  }

  const exportCsv = () => {
    const headers = ['Date', 'Food', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fiber (g)', 'Meal']
    const rows = history.map(e => [
      e.date?.slice(0, 10) ?? '',
      (e.foodClass ?? '').replace(/_/g, ' '),
      String(e.calories ?? 0),
      String(e.protein ?? 0),
      String(e.carbs ?? 0),
      String(e.fat ?? 0),
      String(e.fiber ?? 0),
      e.mealType ?? ''
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `smartfood-history-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear all history? This cannot be undone.')) return
    try {
      const userId = getUserId()
      if (!userId) return
      const response = await fetch('/api/history', { method: 'DELETE', headers: { 'x-user-id': userId } })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to clear')
      }
      setHistory([])
    } catch (err: any) {
      alert(err.message || 'Failed to clear history')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">History</h1>
          <p className="text-gray-600 dark:text-gray-300">Add, edit and remove entries. Export or clear history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg min-h-[44px] touch-manipulation"
          >
            {showAddForm ? 'Close form' : 'Add to history'}
          </button>
          {history.length > 0 && (
            <>
              <button
                type="button"
                onClick={exportCsv}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-h-[44px] touch-manipulation"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={clearHistory}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px] touch-manipulation"
              >
                Clear history
              </button>
            </>
          )}
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddManual} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add entry manually</h2>
          {addError && (
            <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2 rounded">{addError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-food" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Food *</label>
              <input
                id="add-food"
                type="text"
                value={addFoodClass}
                onChange={e => setAddFoodClass(e.target.value)}
                placeholder="e.g. Pasta carbonara"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="add-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date and time</label>
              <input
                id="add-date"
                type="datetime-local"
                value={addDate}
                onChange={e => setAddDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="add-calories" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Calories</label>
              <input
                id="add-calories"
                type="number"
                min={0}
                value={addCalories}
                onChange={e => setAddCalories(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="add-protein" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Protein (g)</label>
              <input
                id="add-protein"
                type="number"
                min={0}
                value={addProtein}
                onChange={e => setAddProtein(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="add-carbs" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Carbs (g)</label>
              <input
                id="add-carbs"
                type="number"
                min={0}
                value={addCarbs}
                onChange={e => setAddCarbs(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="add-fat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fat (g)</label>
              <input
                id="add-fat"
                type="number"
                min={0}
                value={addFat}
                onChange={e => setAddFat(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="add-fiber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fiber (g)</label>
              <input
                id="add-fiber"
                type="number"
                min={0}
                value={addFiber}
                onChange={e => setAddFiber(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="add-meal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meal type</label>
              <select
                id="add-meal"
                value={addMealType}
                onChange={e => setAddMealType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">–</option>
                {MEAL_TYPES.map(m => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              {addSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading-spinner"></span>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
          <p className="text-red-600 dark:text-red-300 mt-2">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 min-h-[44px]"
          >
            Try again
          </button>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-8">
          <HistoryChart data={history} />

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Food</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Meal</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Kcal</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Protein (g)</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Carbs</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Fat</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {history.map((entry, index) => (
                  <HistoryRow
                    key={entry.id ?? index}
                    entry={entry}
                    onLogAgain={logAgain}
                    onDelete={deleteEntry}
                    onSaveEdit={saveEdit}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    deletingId={deletingId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 sm:p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No history yet. Classify food or add entries manually above.</p>
        </div>
      )}
    </div>
  )
}

function HistoryRow({
  entry,
  onLogAgain,
  onDelete,
  onSaveEdit,
  editingId,
  setEditingId,
  deletingId
}: {
  entry: HistoryEntry
  onLogAgain: (e: HistoryEntry) => void
  onDelete: (id: number) => void
  onSaveEdit: (e: HistoryEntry, u: Partial<HistoryEntry>) => void
  editingId: number | null
  setEditingId: (id: number | null) => void
  deletingId: number | null
}) {
  const [editFood, setEditFood] = useState(entry.foodClass.replace(/_/g, ' '))
  const [editDate, setEditDate] = useState(entry.date?.slice(0, 16) ?? '')
  const [editCalories, setEditCalories] = useState(String(entry.calories ?? 0))
  const [editProtein, setEditProtein] = useState(String(entry.protein ?? 0))
  const [editCarbs, setEditCarbs] = useState(String(entry.carbs ?? 0))
  const [editFat, setEditFat] = useState(String(entry.fat ?? 0))
  const [editFiber, setEditFiber] = useState(String(entry.fiber ?? 0))
  const [editMealType, setEditMealType] = useState(entry.mealType ?? '')
  const isEditing = editingId === (entry.id ?? null)

  const handleSaveEdit = () => {
    onSaveEdit(entry, {
      foodClass: editFood.trim().replace(/\s+/g, '_'),
      date: editDate ? new Date(editDate).toISOString() : entry.date,
      calories: parseFloat(editCalories) || 0,
      protein: parseFloat(editProtein) || 0,
      carbs: parseFloat(editCarbs) || 0,
      fat: parseFloat(editFat) || 0,
      fiber: parseFloat(editFiber) || 0,
      mealType: editMealType || null
    })
  }

  if (isEditing) {
    return (
      <tr className="bg-primary-50/50 dark:bg-primary-900/20">
        <td colSpan={8} className="px-4 sm:px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Food</label>
              <input
                type="text"
                value={editFood}
                onChange={e => setEditFood(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Date/time</label>
              <input
                type="datetime-local"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Kcal</label>
              <input
                type="number"
                min={0}
                value={editCalories}
                onChange={e => setEditCalories(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Protein (g)</label>
              <input
                type="number"
                min={0}
                value={editProtein}
                onChange={e => setEditProtein(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Carbs (g)</label>
              <input
                type="number"
                min={0}
                value={editCarbs}
                onChange={e => setEditCarbs(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Fat (g)</label>
              <input
                type="number"
                min={0}
                value={editFat}
                onChange={e => setEditFat(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Fiber (g)</label>
              <input
                type="number"
                min={0}
                value={editFiber}
                onChange={e => setEditFiber(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Meal</label>
              <select
                value={editMealType}
                onChange={e => setEditMealType(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">–</option>
                {MEAL_TYPES.map(m => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {new Date(entry.date).toLocaleDateString('en-US', { dateStyle: 'short' })}
      </td>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {entry.foodClass ? entry.foodClass.replace(/_/g, ' ') : '–'}
      </td>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {entry.mealType ? entry.mealType.charAt(0).toUpperCase() + entry.mealType.slice(1) : '–'}
      </td>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{entry.calories} kcal</td>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{entry.protein} g</td>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{entry.carbs} g</td>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{entry.fat} g</td>
      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onLogAgain(entry)}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium px-1 py-0.5 min-h-[44px] min-w-[44px] touch-manipulation"
          >
            Log again
          </button>
          <button
            type="button"
            onClick={() => setEditingId(entry.id ?? null)}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 px-1 py-0.5 min-h-[44px] touch-manipulation"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => entry.id != null && onDelete(entry.id)}
            disabled={deletingId !== null}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 px-1 py-0.5 disabled:opacity-50 min-h-[44px] touch-manipulation"
          >
            {deletingId === entry.id ? '...' : 'Remove'}
          </button>
        </div>
      </td>
    </tr>
  )
}
