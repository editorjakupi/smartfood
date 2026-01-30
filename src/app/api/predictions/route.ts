import { NextRequest, NextResponse } from 'next/server'
import { dbOperations } from '@/lib/db'
import { predictWithLSTM } from '@/lib/lstm-model'

interface HistoryEntry {
  date: string
  food_class: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || request.cookies.get('smartfood_user_id')?.value || 'anonymous'
    
    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }
    
    // Get user history
    const history = await dbOperations.getUserHistory(userId)
    
    if (history.length < 5) {
      return NextResponse.json({
        predictions: [],
        message: 'Need at least 5 meals in history to make predictions',
        recommendations: [
          'Continue logging meals to get personalized predictions',
          'The LSTM model learns from your eating patterns over time'
        ]
      })
    }
    
    // Sort history by date (oldest first for LSTM; keep for pattern analysis)
    const sortedHistory = [...history].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // Use LSTM model for prediction (expects oldest-first)
    const lstmPrediction = await predictWithLSTM(sortedHistory as HistoryEntry[])
    
    // Recent meals = last N in list (most recent in time)
    const recentCount = Math.min(14, sortedHistory.length)
    const recentMeals = sortedHistory.slice(-recentCount)
    const recentFoodClasses = recentMeals.map(h => (h.food_class || '').trim().toLowerCase())
    
    // Generic labels to deprioritise when showing "most frequent food"
    const genericLabels = new Set(['food', 'ingredient', 'other', 'unknown', ''])
    
    const foodCounts: Record<string, number> = {}
    recentFoodClasses.forEach(fc => {
      if (fc) {
        foodCounts[fc] = (foodCounts[fc] || 0) + 1
      }
    })
    
    const uniqueFoods = Object.keys(foodCounts).length
    const sortedByCount = Object.entries(foodCounts).sort(([, a], [, b]) => b - a)
    const mostCommonEntry = sortedByCount.find(([name]) => !genericLabels.has(name)) ?? sortedByCount[0]
    const mostCommonFood = mostCommonEntry?.[0]
    const mostCommonFoodCount = mostCommonFood ? foodCounts[mostCommonFood] : 0
    const displayFoodName = mostCommonFood
      ? (genericLabels.has(mostCommonFood) ? 'other / unspecified' : mostCommonFood.replace(/_/g, ' '))
      : ''
    
    const patterns: string[] = []
    const recommendations: string[] = []
    
    // Food variety analysis (based on recent meals)
    if (uniqueFoods < 5 && sortedHistory.length >= 10) {
      patterns.push(`You have limited food variety (${uniqueFoods} different foods in last ${recentCount} meals)`)
      recommendations.push('Try adding more variety to your meals for better nutrition')
    } else if (uniqueFoods >= 10) {
      patterns.push(`Great food variety! You've eaten ${uniqueFoods} different foods recently`)
    }
    
    if (displayFoodName && mostCommonFoodCount >= 2) {
      patterns.push(`Your most frequent food in recent meals is ${displayFoodName} (${mostCommonFoodCount} times in last ${recentCount} meals)`)
    }
    
    // Average daily intake: group by calendar day, sum calories per day, then average
    const caloriesByDay: Record<string, number> = {}
    sortedHistory.forEach(h => {
      const day = new Date(h.date).toISOString().slice(0, 10)
      caloriesByDay[day] = (caloriesByDay[day] || 0) + (h.calories || 0)
    })
    const dailyTotals = Object.values(caloriesByDay)
    const avgDailyKcal = dailyTotals.length > 0
      ? dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length
      : recentMeals.reduce((sum, h) => sum + (h.calories || 0), 0) / Math.max(1, recentMeals.length)
    
    if (avgDailyKcal > 2500) {
      patterns.push(`Your average daily intake is ${Math.round(avgDailyKcal)} kcal (above typical 2000 kcal)`)
      recommendations.push('Consider adding more vegetables and reducing portion sizes to balance your calorie intake')
      recommendations.push('Try incorporating more fiber-rich foods to feel fuller with fewer calories')
    } else if (avgDailyKcal < 1500) {
      patterns.push(`Your average daily intake is ${Math.round(avgDailyKcal)} kcal (below typical 2000 kcal)`)
      recommendations.push('Consider adding nutrient-dense foods like nuts, avocados, and whole grains to meet your daily needs')
    } else {
      patterns.push(`Your average daily intake is ${Math.round(avgDailyKcal)} kcal (within healthy range)`)
    }
    
    // Macronutrient % from recent meals only
    const recentTotalCal = recentMeals.reduce((s, h) => s + (h.calories || 0), 0)
    const recentProtein = recentMeals.reduce((s, h) => s + (h.protein || 0), 0)
    const recentCarbs = recentMeals.reduce((s, h) => s + (h.carbs || 0), 0)
    const recentFat = recentMeals.reduce((s, h) => s + (h.fat || 0), 0)
    const proteinPercent = recentTotalCal > 0 ? ((recentProtein * 4) / recentTotalCal) * 100 : 0
    const carbsPercent = recentTotalCal > 0 ? ((recentCarbs * 4) / recentTotalCal) * 100 : 0
    const fatPercent = recentTotalCal > 0 ? ((recentFat * 9) / recentTotalCal) * 100 : 0
    
    if (proteinPercent < 10 && recentCount >= 5) {
      recommendations.push('Increase protein intake for better muscle maintenance and satiety')
    } else if (proteinPercent > 35) {
      recommendations.push('Consider balancing your macros - very high protein may limit other nutrients')
    }
    
    if (carbsPercent < 30 && recentCount >= 5 && recentTotalCal > 0) {
      patterns.push(`In recent meals, carbohydrates are relatively low (${Math.round(carbsPercent)}% of calories)`)
    }
    
    // Meal timing from recent meals
    const mealTimes = recentMeals.slice(-10).map(h => new Date(h.date).getHours())
    const avgMealTime = mealTimes.length > 0 ? mealTimes.reduce((sum, h) => sum + h, 0) / mealTimes.length : 12
    if (avgMealTime > 20 || avgMealTime < 6) {
      patterns.push('You tend to eat meals late in the evening or early morning')
      recommendations.push('Consider eating larger meals earlier in the day for better metabolism')
    }
    
    // Build predictions array
    const predictions = []
    
    if (lstmPrediction.success) {
      predictions.push({
        type: 'next_meal_category',
        prediction: `Based on your patterns, your next meal is likely to be ${lstmPrediction.predictedCategory}`,
        confidence: lstmPrediction.categoryConfidence,
        basedOn: `${sortedHistory.length} meals analyzed with LSTM model`,
        details: {
          category: lstmPrediction.predictedCategory,
          confidence: lstmPrediction.categoryConfidence
        }
      })
      
      predictions.push({
        type: 'next_meal_calories',
        prediction: `Expected calories for next meal: ${lstmPrediction.predictedCalories} kcal`,
        confidence: 0.75,
        basedOn: 'LSTM model prediction',
        details: {
          calories: lstmPrediction.predictedCalories
        }
      })
    } else {
      // Fallback predictions
      const timeOfDay = new Date().getHours()
      let predictedMeal = 'balanced meal'
      
      if (timeOfDay >= 6 && timeOfDay < 11) {
        predictedMeal = 'breakfast'
      } else if (timeOfDay >= 11 && timeOfDay < 15) {
        predictedMeal = 'lunch'
      } else if (timeOfDay >= 15 && timeOfDay < 19) {
        predictedMeal = 'afternoon snack'
      } else {
        predictedMeal = 'dinner'
      }
      
      predictions.push({
        type: 'next_meal',
        prediction: `Based on your patterns, you're likely to have ${predictedMeal} next`,
        confidence: 0.65,
        basedOn: `${sortedHistory.length} meals analyzed (simplified prediction)`
      })
      
      predictions.push({
        type: 'daily_calories',
        prediction: `Expected daily intake: ${Math.round(avgDailyKcal)} kcal`,
        confidence: 0.70,
        basedOn: 'Average from your logged days'
      })
    }
    
    const lstmModelUsed = lstmPrediction.success
    const noteSimplified = sortedHistory.length < 14
      ? 'Need at least 14 meals in history for LSTM predictions; using simplified estimates until then.'
      : 'Using simplified predictions. Ensure data/models/lstm/tfjs/model.json and config files exist (see README).'

    return NextResponse.json({
      predictions: predictions,
      patterns: patterns,
      recommendations: recommendations,
      modelUsed: lstmModelUsed ? 'LSTM (Bidirectional LSTM with Attention)' : 'Simplified (fallback)',
      lstmModelUsed,
      note: lstmModelUsed
        ? 'Predictions from trained LSTM model (TensorFlow.js).'
        : noteSimplified
    })
  } catch (error: any) {
    console.error('Predictions error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate predictions',
        message: error.message || 'Database error'
      },
      { status: 500 }
    )
  }
}
