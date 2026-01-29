// LSTM Model using TensorFlow.js
// Runs directly in Node.js without Python servers
// Works in both local development and serverless deployment (Vercel)
// Uses pure JavaScript TensorFlow.js (works with Node.js 24+)

import * as tf from '@tensorflow/tfjs'
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

let lstmModel: tf.LayersModel | null = null
let scalerParams: ScalerParams | null = null
let modelConfig: ModelConfig | null = null

// Map food classes to categories (breakfast, lunch, dinner, snack)
const FOOD_CATEGORY_MAP: Record<string, number> = {
  'bagel': 0, 'breakfast_burrito': 0, 'eggs_benedict': 0, 'french_toast': 0,
  'omelette': 0, 'pancakes': 0, 'waffles': 0,
  'beet_salad': 1, 'caprese_salad': 1, 'caesar_salad': 1, 'club_sandwich': 1,
  'croque_madame': 1, 'deviled_eggs': 1, 'falafel': 1, 'fish_and_chips': 1,
  'french_fries': 1, 'grilled_cheese_sandwich': 1, 'greek_salad': 1, 'hamburger': 1,
  'hot_dog': 1, 'hummus': 1, 'macaroni_and_cheese': 1, 'miso_soup': 1,
  'nachos': 1, 'onion_rings': 1, 'pad_thai': 1, 'pizza': 1,
  'pulled_pork_sandwich': 1, 'ramen': 1, 'samosa': 1, 'seaweed_salad': 1,
  'spring_rolls': 1, 'tacos': 1, 'takoyaki': 1, 'wings': 1,
  'baby_back_ribs': 2, 'beef_carpaccio': 2, 'beef_tartare': 2, 'bibimbap': 2,
  'crab_cakes': 2, 'filet_mignon': 2, 'fried_calamari': 2, 'fried_rice': 2,
  'grilled_salmon': 2, 'hot_and_sour_soup': 2, 'lasagna': 2, 'oysters': 2,
  'paella': 2, 'pork_chop': 2, 'poutine': 2, 'prime_rib': 2,
  'ravioli': 2, 'risotto': 2, 'sashimi': 2, 'scallops': 2,
  'shrimp_and_grits': 2, 'spaghetti_bolognese': 2, 'spaghetti_carbonara': 2,
  'steak': 2, 'sushi': 2, 'tuna_tartare': 2,
  'apple_pie': 3, 'beignets': 3, 'bread_pudding': 3, 'cannoli': 3,
  'carrot_cake': 3, 'cheesecake': 3, 'chocolate_cake': 3, 'churros': 3,
  'cup_cakes': 3, 'donuts': 3, 'frozen_yogurt': 3, 'ice_cream': 3,
  'macarons': 3, 'mussels': 3, 'panna_cotta': 3, 'red_velvet_cake': 3,
  'tiramisu': 3
}

const getDefaultCategory = (hour: number): number => {
  if (hour >= 6 && hour < 11) return 0
  if (hour >= 11 && hour < 15) return 1
  if (hour >= 15 && hour < 19) return 2
  return 3
}

// Find TensorFlow.js model directory
function findTFJSModelPath(): string | null {
  const paths = [
    path.join(process.cwd(), 'data', 'models', 'lstm', 'tfjs', 'model.json'),
    path.join(process.cwd(), 'public', 'models', 'lstm', 'tfjs', 'model.json')
  ]
  
  for (const modelPath of paths) {
    if (fs.existsSync(modelPath)) {
      return path.dirname(modelPath)
    }
  }
  
  return null
}

// Load LSTM model and configs
export async function loadLSTMModelTFJS(): Promise<boolean> {
  if (lstmModel !== null && scalerParams !== null && modelConfig !== null) {
    return true
  }
  
  try {
    const modelDir = path.join(process.cwd(), 'data', 'models', 'lstm')
    const scalerPath = path.join(modelDir, 'scaler_params.json')
    const configPath = path.join(modelDir, 'model_config.json')
    const tfjsModelDir = findTFJSModelPath()
    
    if (!tfjsModelDir) {
      console.log('LSTM TensorFlow.js model not found. Expected at:')
      console.log('  - data/models/lstm/tfjs/model.json')
      console.log('Run: python convert_lstm_to_tfjs_simple.py to convert LSTM model (see README)')
      return false
    }
    
    if (!fs.existsSync(scalerPath) || !fs.existsSync(configPath)) {
      console.log('LSTM config files not found')
      return false
    }
    
    // Load scaler params
    const scalerData = fs.readFileSync(scalerPath, 'utf-8')
    scalerParams = JSON.parse(scalerData) as ScalerParams
    
    // Load model config
    const configData = fs.readFileSync(configPath, 'utf-8')
    modelConfig = JSON.parse(configData) as ModelConfig
    
    // Load TensorFlow.js model
    console.log(`Loading LSTM model from: ${tfjsModelDir}`)
    const modelUrl = `file://${tfjsModelDir}`
    lstmModel = await tf.loadLayersModel(modelUrl)
    
    console.log('✓ LSTM model loaded successfully (TensorFlow.js)')
    console.log(`  Model accuracy: ${(modelConfig.category_accuracy * 100).toFixed(1)}%`)
    
    return true
  } catch (error: any) {
    console.error('Error loading LSTM model:', error.message)
    return false
  }
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
  
  const recentHistory = history.slice(-SEQUENCE_LENGTH)
  const sequence: number[][] = []
  
  for (const entry of recentHistory) {
    const date = new Date(entry.date)
    const hour = date.getHours()
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0
    
    const foodClassLower = entry.food_class.toLowerCase().trim()
    let category = FOOD_CATEGORY_MAP[foodClassLower]
    
    if (category === undefined) {
      const normalized = foodClassLower.replace(/[\s_-]/g, '_')
      category = FOOD_CATEGORY_MAP[normalized]
    }
    
    if (category === undefined) {
      category = getDefaultCategory(hour)
    }
    
    let mealNumber = 0
    if (hour >= 6 && hour < 11) mealNumber = 0
    else if (hour >= 11 && hour < 15) mealNumber = 1
    else if (hour >= 15 && hour < 19) mealNumber = 2
    else mealNumber = 3
    
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
    
    const normalized = normalizeFeatures(featureVector)
    sequence.push(normalized)
  }
  
  return sequence
}

// Predict using LSTM model
export async function predictLSTM(history: HistoryEntry[]): Promise<{
  calories: number
  category: number
  categoryConfidence: number
} | null> {
  try {
    // Load model if not loaded
    if (!lstmModel || !scalerParams || !modelConfig) {
      const loaded = await loadLSTMModelTFJS()
      if (!loaded) {
        return null
      }
    }
    
    if (!lstmModel || !scalerParams || !modelConfig) {
      return null
    }
    
    const sequence = prepareSequence(history)
    if (!sequence) {
      return null
    }
    
    // Convert to tensor
    const sequenceTensor = tf.tensor3d([sequence])
    
    // Make prediction
    const predictions = lstmModel.predict(sequenceTensor) as tf.Tensor[]
    
    // Get outputs
    const caloriesPred = await predictions[0].array() // calories output
    const categoryPred = await predictions[1].array() // category probabilities
    
    const calories = (caloriesPred as number[][])[0][0]
    const categoryProbs = (categoryPred as number[][])[0]
    
    // Denormalize calories
    const calMin = scalerParams.min[0]
    const calMax = scalerParams.max[0]
    const predictedCalories = calories * (calMax - calMin) + calMin
    
    // Get category
    const categoryIndex = categoryProbs.indexOf(Math.max(...categoryProbs))
    const categoryConfidence = categoryProbs[categoryIndex]
    
    // Cleanup tensors
    sequenceTensor.dispose()
    predictions.forEach(t => t.dispose())
    
    return {
      calories: predictedCalories,
      category: categoryIndex,
      categoryConfidence: categoryConfidence
    }
  } catch (error: any) {
    console.error('LSTM prediction error:', error.message)
    return null
  }
}
