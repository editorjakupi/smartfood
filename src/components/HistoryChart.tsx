'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface HistoryEntry {
  date: string
  foodClass: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface HistoryChartProps {
  data: HistoryEntry[]
}

export default function HistoryChart({ data }: HistoryChartProps) {
  const chartData = useMemo(() => {
    // Group by date and calculate daily totals
    const dailyData: Record<string, {
      date: string
      calories: number
      protein: number
      carbs: number
      fat: number
      count: number
    }> = {}

    data.forEach(entry => {
      const dateKey = new Date(entry.date).toLocaleDateString('en-US')
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          count: 0
        }
      }
      
      dailyData[dateKey].calories += entry.calories || 0
      dailyData[dateKey].protein += entry.protein || 0
      dailyData[dateKey].carbs += entry.carbs || 0
      dailyData[dateKey].fat += entry.fat || 0
      dailyData[dateKey].count += 1
    })

    return Object.values(dailyData).slice(-14) // Last 14 days
  }, [data])

  const totalCalories = useMemo(() => {
    return data.reduce((sum, entry) => sum + (entry.calories || 0), 0)
  }, [data])

  const avgCalories = useMemo(() => {
    if (data.length === 0) return 0
    return Math.round(totalCalories / data.length)
  }, [data, totalCalories])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Meals</div>
          <div className="text-2xl font-bold text-gray-900">{data.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Calories</div>
          <div className="text-2xl font-bold text-gray-900">{totalCalories.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Average per Meal</div>
          <div className="text-2xl font-bold text-gray-900">{avgCalories} kcal</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Days with Data</div>
          <div className="text-2xl font-bold text-gray-900">{chartData.length}</div>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Nutrition Intake Over Time
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.slice(5)} // Show only MM-DD
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="calories"
                  name="Calories"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="protein"
                  name="Protein (g)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
