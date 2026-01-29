// LSTM Model Integration
// Uses Python microservice for predictions (simpler than TensorFlow.js on Node 24)

import * as fs from 'fs'
import * as path from 'path'

interface ScalerParams {
  min: number[]
  max: number[]
  features: string[]
}

interface ModelConfig {
  sequence_length: number
  features: string[]
  food_categories: string[]
  num_categories: number
  calories_mae: number
  calories_mape: number
  category_accuracy: number
}

interface HistoryEntry {
  date: string
  food_class: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

let scalerParams: ScalerParams | null = null
let modelConfig: ModelConfig | null = null
let modelAvailable = false

// Map food classes to categories (breakfast, lunch, dinner, snack)
const FOOD_CATEGORY_MAP: Record<string, number> = {
  // Breakfast foods (category 0)
  'bagel': 0, 'breakfast_burrito': 0, 'eggs_benedict': 0, 'french_toast': 0,
  'omelette': 0, 'pancakes': 0, 'waffles': 0,
  
  // Lunch foods (category 1)
  'beet_salad': 1, 'caprese_salad': 1, 'caesar_salad': 1, 'club_sandwich': 1,
  'croque_madame': 1, 'deviled_eggs': 1, 'falafel': 1, 'fish_and_chips': 1,
  'french_fries': 1, 'grilled_cheese_sandwich': 1, 'greek_salad': 1, 'hamburger': 1,
  'hot_dog': 1, 'hummus': 1, 'macaroni_and_cheese': 1, 'miso_soup': 1,
  'nachos': 1, 'onion_rings': 1, 'pad_thai': 1, 'pizza': 1,
  'pulled_pork_sandwich': 1, 'ramen': 1, 'samosa': 1, 'seaweed_salad': 1,
  'spring_rolls': 1, 'tacos': 1, 'takoyaki': 1, 'wings': 1,
  
  // Dinner foods (category 2)
  'baby_back_ribs': 2, 'beef_carpaccio': 2, 'beef_tartare': 2, 'bibimbap': 2,
  'crab_cakes': 2, 'filet_mignon': 2, 'fried_calamari': 2, 'fried_rice': 2,
  'grilled_salmon': 2, 'hot_and_sour_soup': 2, 'lasagna': 2, 'oysters': 2,
  'paella': 2, 'pork_chop': 2, 'poutine': 2, 'prime_rib': 2,
  'ravioli': 2, 'risotto': 2, 'sashimi': 2, 'scallops': 2,
  'shrimp_and_grits': 2, 'spaghetti_bolognese': 2, 'spaghetti_carbonara': 2,
  'steak': 2, 'sushi': 2, 'tuna_tartare': 2,
  
  // Snacks/Desserts (category 3)
  'apple_pie': 3, 'beignets': 3, 'bread_pudding': 3, 'cannoli': 3,
  'carrot_cake': 3, 'cheesecake': 3, 'chocolate_cake': 3, 'churros': 3,
  'cup_cakes': 3, 'donuts': 3, 'frozen_yogurt': 3, 'ice_cream': 3,
  'macarons': 3, 'mussels': 3, 'panna_cotta': 3, 'red_velvet_cake': 3,
  'tiramisu': 3
}

// Default category if food not found in map
const getDefaultCategory = (hour: number): number => {
  if (hour >= 6 && hour < 11) return 0 // breakfast
  if (hour >= 11 && hour < 15) return 1 // lunch
  if (hour >= 15 && hour < 19) return 2 // dinner
  return 3 // snack
}

// Load config files
export async function loadLSTMModel(): Promise<boolean> {
  try {
    const modelDir = path.join(process.cwd(), 'data', 'models', 'lstm')
    
    const scalerPath = path.join(modelDir, 'scaler_params.json')
    const configPath = path.join(modelDir, 'model_config.json')
    const modelPath = path.join(modelDir, 'eating_pattern_model.h5')
    
    if (!fs.existsSync(modelPath)) {
      console.log('LSTM model file (.h5) not found. Using simplified predictions.')
      return false
    }
    
    if (!fs.existsSync(scalerPath) || !fs.existsSync(configPath)) {
      console.log('LSTM config files not found. Using simplified predictions.')
      return false
    }
    
    // Load scaler params
    const scalerData = fs.readFileSync(scalerPath, 'utf-8')
    scalerParams = JSON.parse(scalerData) as ScalerParams
    
    // Load model config
    const configData = fs.readFileSync(configPath, 'utf-8')
    modelConfig = JSON.parse(configData) as ModelConfig
    
    modelAvailable = true
    console.log('✓ LSTM model config loaded (Python microservice mode)')
    console.log(`  Model accuracy: ${(modelConfig.category_accuracy * 100).toFixed(1)}%`)
    console.log(`  Calories MAE: ${modelConfig.calories_mae.toFixed(1)} kcal`)
    
    return true
  } catch (error: any) {
    console.error('Error loading LSTM config:', error.message)
    return false
  }
}

// Try TensorFlow.js LSTM model first (works in both local and deployment)
// Falls back to Python server (local only), then simplified predictions
async function callLSTMModel(history: HistoryEntry[]): Promise<{
  calories: number
  category: number
  categoryConfidence: number
} | null> {
  // PRIMARY: Try TensorFlow.js implementation (works everywhere)
  try {
    const { predictLSTM } = await import('./lstm-tfjs')
    const result = await predictLSTM(history)
    
    if (result) {
      return result
    }
  } catch (tfjsError: any) {
    console.log('TensorFlow.js LSTM not available, trying Python server:', tfjsError.message)
  }
  
  // FALLBACK: Try Python server (local development only)
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)
  
  if (!isServerless) {
    try {
      // Dynamically import server manager
      const lstmServer = await import('./lstm-server')
      const { getServerUrl, isServerReady, startLSTMServer } = lstmServer
      
      // Ensure server is running
      if (!isServerReady()) {
        const started = await startLSTMServer()
        if (!started) {
          return null
        }
      }
      
      // Prepare sequence for Python service
      const sequence = prepareSequence(history)
      if (!sequence) {
        return null
      }
      
      const serverUrl = lstmServer.getServerUrl()
      
      const response = await fetch(`${serverUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence }),
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.error) {
          throw new Error(result.error)
        }
        return {
          calories: result.calories,
          category: result.category,
          categoryConfidence: result.categoryConfidence
        }
      }
    } catch (pythonError: any) {
      // Python server not available, continue to simplified predictions
      console.log('Python LSTM server not available:', pythonError.message)
    }
  }
  
  return null
}

// Normalize features using scaler params
function normalizeFeatures(features: number[]): number[] {
  if (!scalerParams) return features
  
  return features.map((val, idx) => {
    const min = scalerParams!.min[idx]
    const max = scalerParams!.max[idx]
    return (val - min) / (max - min)
  })
}

// Prepare sequence from history
function prepareSequence(history: HistoryEntry[]): number[][] | null {
  if (!modelConfig || !scalerParams) return null
  
  const SEQUENCE_LENGTH = modelConfig.sequence_length
  
  if (history.length < SEQUENCE_LENGTH) {
    return null
  }
  
  // Take last SEQUENCE_LENGTH entries
  const recentHistory = history.slice(-SEQUENCE_LENGTH)
  
  const sequence: number[][] = []
  
  for (const entry of recentHistory) {
    const date = new Date(entry.date)
    const hour = date.getHours()
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0
    
    // Map food_class to category
    const foodClassLower = entry.food_class.toLowerCase().trim()
    let category = FOOD_CATEGORY_MAP[foodClassLower]
    
    if (category === undefined) {
      const normalized = foodClassLower.replace(/[\s_-]/g, '_')
      category = FOOD_CATEGORY_MAP[normalized]
    }
    
    if (category === undefined) {
      category = getDefaultCategory(hour)
    }
    
    // Calculate meal_number (0-3 based on time of day)
    let mealNumber = 0
    if (hour >= 6 && hour < 11) mealNumber = 0
    else if (hour >= 11 && hour < 15) mealNumber = 1
    else if (hour >= 15 && hour < 19) mealNumber = 2
    else mealNumber = 3
    
    // Build feature vector
    const featureVector = [
      entry.calories,
      category,
      hour,
      dayOfWeek,
      isWeekend,
      entry.protein || 0,
      entry.carbs || 0,
      entry.fat || 0,
      mealNumber
    ]
    
    // Normalize
    const normalized = normalizeFeatures(featureVector)
    sequence.push(normalized)
  }
  
  return sequence
}

// Make prediction using LSTM model (via Python service or simplified)
export async function predictWithLSTM(history: HistoryEntry[]): Promise<{
  predictedCalories: number
  predictedCategory: string
  categoryConfidence: number
  success: boolean
}> {
  try {
    // Try to load config if not loaded
    if (!modelConfig || !scalerParams) {
      await loadLSTMModel()
    }
    
    if (!modelConfig || !scalerParams || !modelAvailable) {
      return predictSimplified(history)
    }
    
    const sequence = prepareSequence(history)
    if (!sequence) {
      return predictSimplified(history)
    }
    
    // Try LSTM model (TensorFlow.js first, then Python server, then simplified)
    const lstmResult = await callLSTMModel(sortedHistory as HistoryEntry[])
    if (lstmResult) {
      const predictedCategory = modelConfig.food_categories[lstmResult.category] || 'snack'
      return {
        predictedCalories: Math.round(lstmResult.calories),
        predictedCategory,
        categoryConfidence: Math.round(lstmResult.categoryConfidence * 100) / 100,
        success: true
      }
    }
    
    // Fallback to simplified (works immediately)
    return predictSimplified(history)
  } catch (error: any) {
    console.error('LSTM prediction error:', error)
    return predictSimplified(history)
  }
}

// Simplified prediction (fallback) - uses statistical patterns
function predictSimplified(history: HistoryEntry[]): {
  predictedCalories: number
  predictedCategory: string
  categoryConfidence: number
  success: boolean
} {
  if (history.length === 0) {
    return {
      predictedCalories: 500,
      predictedCategory: 'lunch',
      categoryConfidence: 0.5,
      success: false
    }
  }
  
  // Calculate average calories from recent meals
  const recentMeals = history.slice(0, 7)
  const avgCalories = recentMeals.reduce((sum, h) => sum + h.calories, 0) / recentMeals.length
  
  // Predict category based on current time and patterns
  const now = new Date()
  const hour = now.getHours()
  
  // Analyze category patterns from history
  const categoryCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  recentMeals.forEach(entry => {
    const entryHour = new Date(entry.date).getHours()
    const category = getDefaultCategory(entryHour)
    categoryCounts[category]++
  })
  
  // Find most common category
  const mostCommonCategory = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0]
  
  let predictedCategory = 'lunch'
  let categoryConfidence = 0.6
  
  if (mostCommonCategory !== undefined) {
    const categoryNames = ['breakfast', 'lunch', 'dinner', 'snack']
    predictedCategory = categoryNames[parseInt(mostCommonCategory)]
    categoryConfidence = 0.7
  } else {
    // Time-based fallback
    if (hour >= 6 && hour < 11) {
      predictedCategory = 'breakfast'
    } else if (hour >= 11 && hour < 15) {
      predictedCategory = 'lunch'
    } else if (hour >= 15 && hour < 19) {
      predictedCategory = 'dinner'
    } else {
      predictedCategory = 'snack'
    }
  }
  
  return {
    predictedCalories: Math.round(avgCalories),
    predictedCategory,
    categoryConfidence,
    success: false
  }
}

// Initialize config and try to load TensorFlow.js model on module load
if (typeof window === 'undefined') {
  // Load config
  loadLSTMModel().then(() => {
    // Try to load TensorFlow.js model (works in both local and deployment)
    import('./lstm-tfjs').then(({ loadLSTMModelTFJS }) => {
      loadLSTMModelTFJS().catch((err: any) => {
        console.log('TensorFlow.js LSTM model will use fallback:', err.message)
        console.log('Run: python convert_lstm_to_tfjs_simple.py to convert LSTM (see README)')
      })
    }).catch(() => {
      // TensorFlow.js module not available
    })
    
    // In local development, also try to start Python server as fallback
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)
    if (!isServerless) {
      import('./lstm-server').then(({ startLSTMServer }) => {
        startLSTMServer().catch((err: any) => {
          console.log('Python LSTM server will use fallback mode:', err.message)
        })
      }).catch(() => {
        // Server module not available
      })
    }
  }).catch(err => {
    console.log('LSTM config will use simplified predictions:', err.message)
  })
}
