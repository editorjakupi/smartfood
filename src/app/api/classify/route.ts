import { NextRequest, NextResponse } from 'next/server'

// Food-101 class names (for local CNN model)
const FOOD_CLASSES = [
  'apple_pie', 'baby_back_ribs', 'baklava', 'beef_carpaccio', 'beef_tartare',
  'beet_salad', 'beignets', 'bibimbap', 'bread_pudding', 'breakfast_burrito',
  'bruschetta', 'caesar_salad', 'cannoli', 'caprese_salad', 'carrot_cake',
  'ceviche', 'cheesecake', 'cheese_plate', 'chicken_curry', 'chicken_quesadilla',
  'chicken_wings', 'chocolate_cake', 'chocolate_mousse', 'churros', 'clam_chowder',
  'club_sandwich', 'crab_cakes', 'creme_brulee', 'croque_madame', 'cup_cakes',
  'deviled_eggs', 'donuts', 'dumplings', 'edamame', 'eggs_benedict',
  'escargots', 'falafel', 'filet_mignon', 'fish_and_chips', 'foie_gras',
  'french_fries', 'french_onion_soup', 'french_toast', 'fried_calamari', 'fried_rice',
  'frozen_yogurt', 'garlic_bread', 'gnocchi', 'greek_salad', 'grilled_cheese_sandwich',
  'grilled_salmon', 'guacamole', 'gyoza', 'hamburger', 'hot_and_sour_soup',
  'hot_dog', 'huevos_rancheros', 'hummus', 'ice_cream', 'lasagna',
  'lobster_bisque', 'lobster_roll_sandwich', 'macaroni_and_cheese', 'macarons', 'miso_soup',
  'mussels', 'nachos', 'omelette', 'onion_rings', 'oysters',
  'pad_thai', 'paella', 'pancakes', 'panna_cotta', 'peking_duck',
  'pho', 'pizza', 'pork_chop', 'poutine', 'prime_rib',
  'pulled_pork_sandwich', 'ramen', 'ravioli', 'red_velvet_cake', 'risotto',
  'samosa', 'sashimi', 'scallops', 'seaweed_salad', 'shrimp_and_grits',
  'spaghetti_bolognese', 'spaghetti_carbonara', 'spring_rolls', 'steak', 'strawberry_shortcake',
  'sushi', 'tacos', 'takoyaki', 'tiramisu', 'tuna_tartare',
  'waffles'
]

// Basic nutrition data per food class (kcal per 100g)
const NUTRITION_DATA: Record<string, Record<string, number>> = {
  'pizza': { calories: 266, protein: 11, carbs: 33, fat: 10, fiber: 2 },
  'hamburger': { calories: 295, protein: 17, carbs: 24, fat: 14, fiber: 1 },
  'sushi': { calories: 150, protein: 6, carbs: 30, fat: 0.5, fiber: 0 },
  'salad': { calories: 35, protein: 2, carbs: 7, fat: 0.3, fiber: 3 },
  'pasta': { calories: 220, protein: 8, carbs: 43, fat: 1.3, fiber: 2 },
  'chicken_wings': { calories: 290, protein: 27, carbs: 8, fat: 19, fiber: 0 },
  'french_fries': { calories: 312, protein: 3, carbs: 41, fat: 15, fiber: 4 },
  'ice_cream': { calories: 207, protein: 4, carbs: 24, fat: 11, fiber: 0 },
  'chocolate_cake': { calories: 371, protein: 5, carbs: 50, fat: 17, fiber: 2 },
  'grilled_salmon': { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
  'caesar_salad': { calories: 190, protein: 8, carbs: 8, fat: 15, fiber: 2 },
  'ramen': { calories: 436, protein: 16, carbs: 60, fat: 15, fiber: 2 },
}

// Get nutrition estimate for food class
function getNutrition(foodClass: string): Record<string, number> {
  // Check for exact match
  if (NUTRITION_DATA[foodClass]) {
    return NUTRITION_DATA[foodClass]
  }
  
  // Check for partial match
  for (const key of Object.keys(NUTRITION_DATA)) {
    if (foodClass.includes(key) || key.includes(foodClass)) {
      return NUTRITION_DATA[key]
    }
  }
  
  // Default estimate based on food type
  if (foodClass.includes('salad') || foodClass.includes('vegetable')) {
    return { calories: 80, protein: 3, carbs: 12, fat: 2, fiber: 4 }
  }
  if (foodClass.includes('cake') || foodClass.includes('dessert')) {
    return { calories: 350, protein: 4, carbs: 45, fat: 16, fiber: 1 }
  }
  if (foodClass.includes('meat') || foodClass.includes('steak') || foodClass.includes('beef')) {
    return { calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0 }
  }
  if (foodClass.includes('fish') || foodClass.includes('seafood')) {
    return { calories: 180, protein: 22, carbs: 0, fat: 9, fiber: 0 }
  }
  
  // Generic default
  return { calories: 200, protein: 10, carbs: 25, fat: 8, fiber: 2 }
}

// Map Google Cloud Vision labels to Food-101 classes
function mapVisionLabelToFoodClass(label: string): string | null {
  const normalizedLabel = label.toLowerCase().trim()
  
  // Direct mappings
  const mappings: Record<string, string> = {
    'pizza': 'pizza',
    'hamburger': 'hamburger',
    'hot dog': 'hot_dog',
    'hotdog': 'hot_dog',
    'ice cream': 'ice_cream',
    'icecream': 'ice_cream',
    'cake': 'chocolate_cake',
    'donut': 'donuts',
    'doughnut': 'donuts',
    'sushi': 'sushi',
    'salad': 'caesar_salad',
    'sandwich': 'club_sandwich',
    'pasta': 'spaghetti_bolognese',
    'spaghetti': 'spaghetti_bolognese',
    'bread': 'garlic_bread',
    'chicken': 'chicken_wings',
    'fried chicken': 'chicken_wings',
    'fish': 'fish_and_chips',
    'steak': 'steak',
    'soup': 'french_onion_soup',
    'ramen': 'ramen',
    'taco': 'tacos',
    'burrito': 'breakfast_burrito',
    'pancake': 'pancakes',
    'waffle': 'waffles',
    'french fries': 'french_fries',
    'fries': 'french_fries',
    'fried rice': 'fried_rice',
    'rice': 'fried_rice',
    'noodles': 'ramen',
  }
  
  // Try exact match
  if (mappings[normalizedLabel]) {
    return mappings[normalizedLabel]
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(mappings)) {
    if (normalizedLabel.includes(key) || key.includes(normalizedLabel)) {
      return value
    }
  }
  
  // Check if label matches any Food-101 class directly
  const foodClassMatch = FOOD_CLASSES.find(fc => 
    fc.toLowerCase().replace(/_/g, ' ') === normalizedLabel ||
    normalizedLabel.includes(fc.toLowerCase().replace(/_/g, ' '))
  )
  
  if (foodClassMatch) {
    return foodClassMatch
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    // Get base URL from request headers (works in both local and Vercel)
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`
    const body = await request.json().catch(() => ({}))
    const { image } = body
    
    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'No image provided or invalid image format' },
        { status: 400 }
      )
    }

    // Validate base64 image format
    if (!image.startsWith('data:image/') && !/^[A-Za-z0-9+/=]+$/.test(image.replace(/^data:image\/\w+;base64,/, ''))) {
      return NextResponse.json(
        { error: 'Invalid image format. Expected base64 encoded image.' },
        { status: 400 }
      )
    }

    // Remove data URL prefix if present, keep base64 data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    
    if (!base64Data || base64Data.length === 0) {
      return NextResponse.json(
        { error: 'Empty image data' },
        { status: 400 }
      )
    }

    // Classification priority (same as GitHub remote):
    // 1. Google Cloud Vision API (if configured)
    // 2. Local CNN model via TensorFlow.js (fallback)
    let modelUsed = ''
    let foodClass: string | null = null
    let confidence = 0
    let label = ''

    // 1. Primary: Google Cloud Vision API (if configured)
    if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      try {
        console.log('Trying Google Cloud Vision API...')
        const visionResponse = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_CLOUD_VISION_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: base64Data },
                features: [{ type: 'LABEL_DETECTION', maxResults: 10 }]
              }]
            }),
            signal: AbortSignal.timeout(10000)
          }
        )
        if (visionResponse.ok) {
          const visionData = await visionResponse.json()
          const labels = visionData.responses?.[0]?.labelAnnotations || []
          if (labels.length > 0) {
            for (const labelAnnotation of labels) {
              const mappedClass = mapVisionLabelToFoodClass(labelAnnotation.description)
              if (mappedClass) {
                foodClass = mappedClass
                label = mappedClass.replace(/_/g, ' ')
                confidence = labelAnnotation.score ?? 0.8
                modelUsed = 'google-cloud-vision'
                console.log(`Successfully used Google Cloud Vision API: ${label} (${foodClass})`)
                break
              }
            }
            if (!foodClass && labels.length > 0) {
              const topLabel = labels[0]
              foodClass = topLabel.description.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '')
              label = topLabel.description
              confidence = topLabel.score ?? 0.7
              modelUsed = 'google-cloud-vision'
              console.log(`Used Google Cloud Vision API (unmapped): ${label}`)
            }
          }
        } else {
          const errorData = await visionResponse.json().catch(() => ({}))
          console.log('Google Cloud Vision API error:', errorData)
          if (visionResponse.status === 429) {
            return NextResponse.json(
              { error: 'Too many requests. Vision quota reached. Please try again in a few minutes.' },
              { status: 429 }
            )
          }
        }
      } catch (visionError: any) {
        console.log('Google Cloud Vision API failed:', visionError?.message ?? visionError)
      }
    } else {
      console.log('Google Cloud Vision API not configured')
    }

    // 2. Fallback: If Vision failed or not configured, try local CNN (TensorFlow.js)
    if (!foodClass) {
      try {
        console.log('Attempting to use CNN model (TensorFlow.js)...')
        const { predictCNN } = await import('@/lib/cnn-tfjs')
        const cnnResult = await predictCNN(base64Data)
        if (cnnResult && cnnResult.class) {
          foodClass = cnnResult.class
          label = cnnResult.label
          confidence = cnnResult.confidence
          modelUsed = 'local-cnn-tfjs'
          console.log(`Successfully used CNN model (TensorFlow.js): ${label} (${foodClass})`)
        } else {
          console.log('CNN model (TensorFlow.js) returned no result')
        }
      } catch (cnnError: any) {
        console.log('CNN model (TensorFlow.js) not available:', cnnError?.message ?? cnnError)
        console.log('Note: Convert CNN to TensorFlow.js in notebook (see README).')
      }
    }

    if (!foodClass) {
      const errorMessage = !process.env.GOOGLE_CLOUD_VISION_API_KEY
        ? 'Google Cloud Vision API key not configured. Please set GOOGLE_CLOUD_VISION_API_KEY in your .env.local file.\n\nGet your API key at: https://console.cloud.google.com/apis/credentials'
        : 'Both Google Cloud Vision API and local CNN model failed. Please check:\n1. Google Cloud Vision API key is valid\n2. CNN TensorFlow.js model exists at: data/models/cnn/tfjs/model.json (convert in notebook, see README)'
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    // Validate food class
    if (!foodClass || foodClass.length === 0) {
      return NextResponse.json(
        { error: 'Invalid food class returned from model' },
        { status: 500 }
      )
    }

    // Get nutrition data - try Livsmedelsverket API first, then fallback
    let nutrition: Record<string, number>
    let nutritionSource = 'Estimated'
    
    try {
      // Try Livsmedelsverket API first
      // Use baseUrl from request headers (already set at function start)
      const nutritionResponse = await fetch(`${baseUrl}/api/nutrition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodClass }),
        signal: AbortSignal.timeout(10000)
      })
      
      if (nutritionResponse.ok) {
        const nutritionData = await nutritionResponse.json()
        if (nutritionData.nutrition) {
          nutrition = nutritionData.nutrition
          nutritionSource = nutritionData.source || 'Estimated'
        } else {
          nutrition = getNutrition(foodClass)
        }
      } else {
        nutrition = getNutrition(foodClass)
      }
    } catch (error) {
      // Fallback to hardcoded data
      nutrition = getNutrition(foodClass)
    }

    return NextResponse.json({
      class: foodClass,
      label: label || (foodClass ? foodClass.replace(/_/g, ' ') : 'Unknown'),
      confidence: confidence,
      nutrition: nutrition,
      nutritionSource: nutritionSource,
      model: modelUsed
    })
  } catch (error: any) {
    console.error('Classification error:', error)
    
    return NextResponse.json({
      error: error.message || 'Classification failed. Please try again.'
    }, { status: 500 })
  }
}
