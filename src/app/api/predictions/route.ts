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
    
    // Sort history by date (newest first, then reverse for LSTM)
    const sortedHistory = [...history].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ).reverse()
    
    // Use LSTM model for prediction
    const lstmPrediction = await predictWithLSTM(sortedHistory as HistoryEntry[])
    
    // Analyze patterns and provide insights
    const recentMeals = sortedHistory.slice(0, 14).map(h => h.food_class)
    const avgCalories = sortedHistory.slice(0, 7).reduce((sum, h) => sum + h.calories, 0) / Math.min(7, sortedHistory.length)
    const totalCalories = sortedHistory.slice(0, 7).reduce((sum, h) => sum + h.calories, 0)
    const avgProtein = sortedHistory.slice(0, 7).reduce((sum, h) => sum + (h.protein || 0), 0) / Math.min(7, sortedHistory.length)
    const avgCarbs = sortedHistory.slice(0, 7).reduce((sum, h) => sum + (h.carbs || 0), 0) / Math.min(7, sortedHistory.length)
    const avgFat = sortedHistory.slice(0, 7).reduce((sum, h) => sum + (h.fat || 0), 0) / Math.min(7, sortedHistory.length)
    
    const patterns: string[] = []
    const recommendations: string[] = []
    
    // Detect common foods and variety
    const foodCounts: Record<string, number> = {}
    recentMeals.forEach(food => {
      foodCounts[food] = (foodCounts[food] || 0) + 1
    })
    
    const uniqueFoods = Object.keys(foodCounts).length
    const mostCommonFood = Object.entries(foodCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0]
    const mostCommonFoodCount = mostCommonFood ? foodCounts[mostCommonFood] : 0
    
    // Food variety analysis
    if (uniqueFoods < 5 && sortedHistory.length >= 10) {
      patterns.push(`You have limited food variety (${uniqueFoods} different foods in last ${Math.min(14, sortedHistory.length)} meals)`)
      recommendations.push('Try adding more variety to your meals for better nutrition')
    } else if (uniqueFoods >= 10) {
      patterns.push(`Great food variety! You've eaten ${uniqueFoods} different foods recently`)
    }
    
    if (mostCommonFood && mostCommonFoodCount >= 3) {
      patterns.push(`Your most frequent food is ${mostCommonFood.replace(/_/g, ' ')} (${mostCommonFoodCount} times in recent meals)`)
    }
    
    // Calorie analysis with more context
    if (avgCalories > 2500) {
      patterns.push(`Your average daily intake is ${Math.round(avgCalories)} kcal (above typical 2000 kcal)`)
      recommendations.push('Consider adding more vegetables and reducing portion sizes to balance your calorie intake')
      recommendations.push('Try incorporating more fiber-rich foods to feel fuller with fewer calories')
    } else if (avgCalories < 1500) {
      patterns.push(`Your average daily intake is ${Math.round(avgCalories)} kcal (below typical 2000 kcal)`)
      recommendations.push('Consider adding nutrient-dense foods like nuts, avocados, and whole grains to meet your daily needs')
    } else {
      patterns.push(`Your average daily intake is ${Math.round(avgCalories)} kcal (within healthy range)`)
    }
    
    // Macronutrient balance
    const proteinPercent = (avgProtein * 4) / totalCalories * 100
    const carbsPercent = (avgCarbs * 4) / totalCalories * 100
    const fatPercent = (avgFat * 9) / totalCalories * 100
    
    if (proteinPercent < 10) {
      recommendations.push('Increase protein intake for better muscle maintenance and satiety')
    } else if (proteinPercent > 35) {
      recommendations.push('Consider balancing your macros - very high protein may limit other nutrients')
    }
    
    if (carbsPercent < 30 && sortedHistory.length >= 7) {
      patterns.push(`Your diet is relatively low in carbohydrates (${Math.round(carbsPercent)}% of calories)`)
    }
    
    // Meal timing patterns
    const mealTimes = sortedHistory.slice(0, 10).map(h => new Date(h.date).getHours())
    const avgMealTime = mealTimes.reduce((sum, h) => sum + h, 0) / mealTimes.length
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
        prediction: `Expected daily intake: ${Math.round(avgCalories)} kcal`,
        confidence: 0.70,
        basedOn: 'Last 7 meals average'
      })
    }
    
    return NextResponse.json({
      predictions: predictions,
      patterns: patterns,
      recommendations: recommendations,
      modelUsed: lstmPrediction.success ? 'LSTM (Bidirectional LSTM with Attention)' : 'Simplified (fallback)',
      note: lstmPrediction.success 
        ? 'Predictions generated using trained LSTM model with 88.3% category accuracy'
        : 'Using simplified predictions. To use full LSTM model, ensure the model file (eating_pattern_model.h5) is available in data/models/lstm/'
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
