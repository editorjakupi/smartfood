import { NextRequest, NextResponse } from 'next/server'

const LIVSMEDELSVERKET_API = 'https://dataportal.livsmedelsverket.se/livsmedel'

interface NutritionData {
  namn: string  // Swedish field name
  varde: number  // Swedish field name
  enhet: string  // Swedish field name
}

// Translate English food class names to Swedish for Livsmedelsverket API search
// This ensures better matching with the Swedish food database
function translateToSwedish(foodClass: string): string[] {
  const normalized = foodClass.toLowerCase().trim().replace(/_/g, ' ')
  
  // Comprehensive mapping of English food names to Swedish equivalents
  const translations: Record<string, string[]> = {
    // Common foods
    'pizza': ['pizza'],
    'hamburger': ['hamburgare', 'burgare'],
    'sushi': ['sushi'],
    'pasta': ['pasta', 'spaghetti', 'lasagne', 'makaroner'],
    'spaghetti': ['spaghetti', 'pasta'],
    'lasagna': ['lasagne'],
    'macaroni': ['makaroner'],
    
    // Meats
    'chicken': ['kyckling', 'höna'],
    'chicken_wings': ['kycklingvingar', 'kyckling'],
    'chicken_curry': ['kycklingcurry', 'kyckling'],
    'beef': ['nötkött', 'biff'],
    'steak': ['biff', 'nötkött'],
    'pork': ['fläskkött', 'gris'],
    'pork_chop': ['fläskkotlett', 'fläskkött'],
    'pulled_pork': ['pulled pork', 'fläskkött'],
    
    // Fish and seafood
    'fish': ['fisk'],
    'salmon': ['lax'],
    'grilled_salmon': ['lax', 'grillad lax'],
    'tuna': ['tonfisk'],
    'sashimi': ['sashimi', 'sushi'],
    'lobster': ['hummer'],
    'crab': ['krabba'],
    'shrimp': ['räka', 'räkor'],
    'mussels': ['musslor'],
    'oysters': ['ostron'],
    
    // Vegetables and salads
    'salad': ['sallad'],
    'caesar_salad': ['caesarsallad', 'sallad'],
    'greek_salad': ['grekisk sallad', 'sallad'],
    'caprese_salad': ['capresesallad', 'sallad'],
    'beet_salad': ['rödbetssallad', 'sallad'],
    'seaweed_salad': ['sjögrässallad', 'sallad'],
    'vegetable': ['grönsaker'],
    
    // Bread and grains
    'bread': ['bröd', 'limpa'],
    'garlic_bread': ['vitlöksbröd', 'bröd'],
    'rice': ['ris'],
    'fried_rice': ['stekt ris', 'ris'],
    'risotto': ['risotto', 'ris'],
    
    // Potatoes
    'potato': ['potatis'],
    'french_fries': ['pommes frites', 'frites', 'potatis'],
    'poutine': ['poutine', 'potatis'],
    
    // Fast food
    'hot_dog': ['korv', 'varmkorv'],
    'tacos': ['tacos'],
    'burrito': ['burrito'],
    'nachos': ['nachos'],
    'quesadilla': ['quesadilla'],
    
    // Soups
    'soup': ['soppa'],
    'french_onion_soup': ['löksoppa', 'soppa'],
    'clam_chowder': ['musselsoppa', 'soppa'],
    'miso_soup': ['misosoppa', 'soppa'],
    'ramen': ['ramen', 'nudlar'],
    'pho': ['pho', 'nudlar'],
    
    // Desserts
    'ice_cream': ['glass'],
    'frozen_yogurt': ['fryst yoghurt', 'glass'],
    'cake': ['kaka', 'tårta'],
    'chocolate_cake': ['chokladkaka', 'kaka'],
    'cheesecake': ['cheesecake', 'ostkaka'],
    'carrot_cake': ['morotskaka', 'kaka'],
    'red_velvet_cake': ['red velvet', 'kaka'],
    'tiramisu': ['tiramisu'],
    'panna_cotta': ['panna cotta'],
    'creme_brulee': ['crème brûlée'],
    'donuts': ['munkar', 'donuts'],
    'churros': ['churros'],
    'waffles': ['våfflor'],
    'pancakes': ['pannkakor'],
    'french_toast': ['fransk toast', 'pannkakor'],
    
    // Breakfast
    'eggs_benedict': ['ägg benedict', 'ägg'],
    'omelette': ['omelett', 'ägg'],
    'breakfast_burrito': ['frukostburrito', 'burrito'],
    
    // Other
    'guacamole': ['guacamole'],
    'hummus': ['hummus'],
    'falafel': ['falafel'],
    'samosa': ['samosa'],
    'spring_rolls': ['vårrullar'],
    'dumplings': ['dumplings', 'köttbullar'],
    'gyoza': ['gyoza', 'dumplings'],
    'pad_thai': ['pad thai', 'nudlar'],
    'paella': ['paella', 'ris'],
    'peking_duck': ['pekinganka', 'anka'],
    'foie_gras': ['foie gras', 'gåslever'],
    'escargots': ['sniglar'],
    'takoyaki': ['takoyaki'],
    'bibimbap': ['bibimbap', 'ris'],
    'ceviche': ['ceviche', 'fisk'],
    'tuna_tartare': ['tonfisktartar', 'tonfisk'],
    'beef_tartare': ['bifftartar', 'biff'],
    'beef_carpaccio': ['biffcarpaccio', 'biff'],
    'filet_mignon': ['filé mignon', 'biff'],
    'prime_rib': ['prime rib', 'biff'],
    'baby_back_ribs': ['revben', 'fläskkött'],
    'lobster_roll_sandwich': ['hummerrulle', 'hummer'],
    'club_sandwich': ['klubbsmörgås', 'smörgås'],
    'grilled_cheese_sandwich': ['grillad ostsmörgås', 'smörgås'],
    'pulled_pork_sandwich': ['pulled pork', 'fläskkött'],
    'fish_and_chips': ['fish and chips', 'fisk'],
    'fried_calamari': ['friterad bläckfisk', 'bläckfisk'],
    'scallops': ['kammusslor', 'musslor'],
    'shrimp_and_grits': ['räkor', 'ris'],
    'crab_cakes': ['krabbkakor', 'krabba'],
    'deviled_eggs': ['ägg'],
    'edamame': ['edamame', 'sojabönor'],
    'gnocchi': ['gnocchi', 'pasta'],
    'ravioli': ['ravioli', 'pasta'],
    'macaroni_and_cheese': ['makaroner och ost', 'makaroner'],
    'lobster_bisque': ['hummersoppa', 'hummer'],
    'hot_and_sour_soup': ['sur och stark soppa', 'soppa'],
    'cup_cakes': ['cupcakes', 'kaka'],
    'strawberry_shortcake': ['jordgubbstårta', 'tårta'],
    'baklava': ['baklava'],
    'cannoli': ['cannoli'],
    'bruschetta': ['bruschetta'],
    'onion_rings': ['lökringar'],
    'cheese_plate': ['osttallrik', 'ost'],
    'chocolate_mousse': ['chokladmousse'],
  }
  
  // Try exact match first
  if (translations[normalized]) {
    return translations[normalized]
  }
  
  // Try partial match (e.g., "chicken_wings" contains "chicken")
  for (const [english, swedish] of Object.entries(translations)) {
    if (normalized.includes(english) || english.includes(normalized)) {
      return swedish
    }
  }
  
  // If no translation found, return the original (might work if it's already Swedish or a common word)
  return [normalized]
}

// Get estimated nutrition based on food type
// Fallback when Livsmedelsverket API fails
function getEstimatedNutrition(foodClass: string): Record<string, number> {
  const foodLower = foodClass.toLowerCase()
  
  // Salad/vegetable foods
  if (foodLower.includes('salad') || foodLower.includes('vegetable') || 
      foodLower.includes('caesar') || foodLower.includes('greek')) {
    return { calories: 80, protein: 3, carbs: 12, fat: 2, fiber: 4 }
  }
  
  // Dessert/cake foods
  if (foodLower.includes('cake') || foodLower.includes('dessert') || 
      foodLower.includes('cheesecake') || foodLower.includes('chocolate') ||
      foodLower.includes('tiramisu') || foodLower.includes('ice_cream')) {
    return { calories: 350, protein: 4, carbs: 45, fat: 16, fiber: 1 }
  }
  
  // Meat/steak foods
  if (foodLower.includes('meat') || foodLower.includes('steak') || 
      foodLower.includes('beef') || foodLower.includes('pork') ||
      foodLower.includes('chicken') || foodLower.includes('ribs')) {
    return { calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0 }
  }
  
  // Fish/seafood
  if (foodLower.includes('fish') || foodLower.includes('seafood') ||
      foodLower.includes('salmon') || foodLower.includes('sushi') ||
      foodLower.includes('lobster') || foodLower.includes('crab')) {
    return { calories: 180, protein: 22, carbs: 0, fat: 9, fiber: 0 }
  }
  
  // Pizza/pasta
  if (foodLower.includes('pizza') || foodLower.includes('pasta') ||
      foodLower.includes('lasagna') || foodLower.includes('spaghetti')) {
    return { calories: 266, protein: 11, carbs: 33, fat: 10, fiber: 2 }
  }
  
  // Fast food
  if (foodLower.includes('burger') || foodLower.includes('hamburger') ||
      foodLower.includes('fries') || foodLower.includes('hot_dog')) {
    return { calories: 295, protein: 17, carbs: 24, fat: 14, fiber: 1 }
  }
  
  // Generic default
  return { calories: 200, protein: 10, carbs: 25, fat: 8, fiber: 2 }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { foodClass } = body
    
    if (!foodClass || typeof foodClass !== 'string' || foodClass.trim().length === 0) {
      return NextResponse.json(
        { error: 'No food class provided or invalid format' },
        { status: 400 }
      )
    }
    
    const sanitizedFoodClass = foodClass.trim().toLowerCase()

    // PRIMARY: Try to fetch from Livsmedelsverket API first (standard approach)
    try {
      console.log(`[Nutrition API] Attempting to fetch from Livsmedelsverket for: "${sanitizedFoodClass}"`)
      
      // Search for food with timeout - request more items per page
      const searchResponse = await fetch(
        `${LIVSMEDELSVERKET_API}/api/v1/livsmedel?limit=100`,
        { 
          next: { revalidate: 3600 }, // Cache for 1 hour
          signal: AbortSignal.timeout(10000) // 10 second timeout
        }
      )
      
      if (searchResponse.ok) {
        const responseData = await searchResponse.json()
        
        // API returns object with "livsmedel" array, not direct array
        const foods = responseData.livsmedel || []
        const totalRecords = responseData._meta?.totalRecords || 0
        
        console.log(`[Nutrition API] Received ${foods.length} foods from Livsmedelsverket (total: ${totalRecords})`)
        
        if (Array.isArray(foods) && foods.length > 0) {
          // Translate English food class to Swedish for better matching
          const swedishTerms = translateToSwedish(sanitizedFoodClass)
          const originalTerm = sanitizedFoodClass.replace(/_/g, ' ')
          
          console.log(`[Nutrition API] Translated "${originalTerm}" to Swedish: [${swedishTerms.join(', ')}]`)
          
          // Try matching with Swedish translations first, then original term
          const searchTerms = [...swedishTerms, originalTerm]
          
          // Try multiple matching strategies (prioritize exact matches)
          let matchingFood: any = null
          
          for (const searchTerm of searchTerms) {
            if (matchingFood) break // Stop if we found a match
            
            matchingFood = foods.find((food: any) => {
              const foodName = food.namn?.toLowerCase() || ''
              // Exact match first (highest priority)
              if (foodName === searchTerm) return true
              // Exact match without spaces
              if (foodName.replace(/\s+/g, '') === searchTerm.replace(/\s+/g, '')) return true
              // Word boundary match (to avoid "pizza" matching "pizzasallad")
              const searchWords = searchTerm.split(/\s+/)
              const foodWords = foodName.split(/\s+/)
              // Check if search term is a complete word in food name
              if (searchWords.length === 1 && foodWords.includes(searchTerm)) return true
              // If search term is multiple words, check if all words are present
              if (searchWords.length > 1 && searchWords.every(word => foodWords.includes(word))) return true
              return false
            })
            
            // If exact match found, break
            if (matchingFood) {
              console.log(`[Nutrition API] Found exact match with "${searchTerm}"`)
              break
            }
          }
          
          // If no exact match, try partial match with Swedish terms
          if (!matchingFood) {
            for (const searchTerm of swedishTerms) {
              matchingFood = foods.find((food: any) => {
                const foodName = food.namn?.toLowerCase() || ''
                return foodName.includes(searchTerm)
              })
              if (matchingFood) {
                console.log(`[Nutrition API] Found partial match with "${searchTerm}"`)
                break
              }
            }
          }
          
          // If still no match and we have pagination, try searching more pages
          if (!matchingFood && totalRecords > foods.length) {
            console.log(`[Nutrition API] No match in first page, searching additional pages...`)
            
            // Try a few more pages (limit to avoid too many requests)
            const maxPages = 10  // Search up to 10 more pages
            const itemsPerPage = 100  // Use same page size as initial request
            
            for (let page = 1; page <= maxPages && !matchingFood; page++) {
              try {
                const offset = page * itemsPerPage  // Start from 100, 200, 300, etc.
                const pageResponse = await fetch(
                  `${LIVSMEDELSVERKET_API}/api/v1/livsmedel?offset=${offset}&limit=${itemsPerPage}`,
                  { signal: AbortSignal.timeout(10000) }
                )
                
                if (pageResponse.ok) {
                  const pageData = await pageResponse.json()
                  const pageFoods = pageData.livsmedel || []
                  
                  // Use same Swedish translations for pagination search
                  const pageSearchTerms = [...swedishTerms, originalTerm]
                  
                  // Try exact and partial matches (prioritize exact matches)
                  for (const searchTerm of pageSearchTerms) {
                    if (matchingFood) break
                    
                    matchingFood = pageFoods.find((food: any) => {
                      const foodName = food.namn?.toLowerCase() || ''
                      // Exact match first (highest priority)
                      if (foodName === searchTerm) return true
                      // Exact match without spaces
                      if (foodName.replace(/\s+/g, '') === searchTerm.replace(/\s+/g, '')) return true
                      // Word boundary match (to avoid "pizza" matching "pizzasallad")
                      const searchWords = searchTerm.split(/\s+/)
                      const foodWords = foodName.split(/\s+/)
                      // Check if search term is a complete word in food name
                      if (searchWords.length === 1 && foodWords.includes(searchTerm)) return true
                      // If search term is multiple words, check if all words are present
                      if (searchWords.length > 1 && searchWords.every(word => foodWords.includes(word))) return true
                      return false
                    })
                    
                    if (matchingFood) break
                  }
                  
                  // If still no match, try partial match with Swedish terms
                  if (!matchingFood) {
                    for (const searchTerm of swedishTerms) {
                      matchingFood = pageFoods.find((food: any) => {
                        const foodName = food.namn?.toLowerCase() || ''
                        return foodName.includes(searchTerm)
                      })
                      if (matchingFood) break
                    }
                  }
                  
                  if (matchingFood) {
                    console.log(`[Nutrition API] Found match on page ${page + 1} (offset ${offset})`)
                  }
                }
              } catch (pageError) {
                // Continue to next page or give up
                console.log(`[Nutrition API] Error fetching page ${page + 1}:`, pageError)
                break
              }
            }
          }
          
          if (matchingFood && matchingFood.nummer) {
            console.log(`[Nutrition API] Found match: "${matchingFood.namn}" (nummer: ${matchingFood.nummer})`)
            
            // Fetch nutrition values
            const nutritionResponse = await fetch(
              `${LIVSMEDELSVERKET_API}/api/v1/livsmedel/${matchingFood.nummer}/naringsvarden`,
              { signal: AbortSignal.timeout(10000) }
            )
            
            if (nutritionResponse.ok) {
              const nutritionData = await nutritionResponse.json()
              console.log(`[Nutrition API] Received ${Array.isArray(nutritionData) ? nutritionData.length : 0} nutrition values`)
              
              if (Array.isArray(nutritionData) && nutritionData.length > 0) {
                // Format nutrition data - API uses Swedish field names
                const formattedNutrition: Record<string, number> = {}
                nutritionData.forEach((item: any) => {
                  const namn = (item.namn || '').toLowerCase()
                  const varde = item.varde || 0
                  
                  // Match Swedish nutrition field names (exact matches first, then partial)
                  if (namn.includes('energi') && (namn.includes('kcal') || namn.includes('energi (kcal)'))) {
                    formattedNutrition.calories = varde
                  } else if (namn === 'protein' || namn.includes('protein')) {
                    formattedNutrition.protein = varde
                  } else if (namn.includes('kolhydrat') && namn.includes('tillgängliga')) {
                    formattedNutrition.carbs = varde
                  } else if ((namn.includes('fett') && namn.includes('totalt')) || 
                             (namn === 'fett, totalt') ||
                             (namn.includes('fett') && !namn.includes('fettsyra') && !namn.includes('mättad') && !namn.includes('omättad'))) {
                    formattedNutrition.fat = varde
                  } else if (namn.includes('fibrer') || namn === 'fiber' || namn.includes('fiber')) {
                    formattedNutrition.fiber = varde
                  }
                })
                
                // Only return if we got at least calories
                if (formattedNutrition.calories > 0) {
                  console.log(`[Nutrition API] Successfully retrieved nutrition from Livsmedelsverket:`, formattedNutrition)
                  return NextResponse.json({
                    source: 'Livsmedelsverket',
                    foodName: matchingFood.namn || sanitizedFoodClass.replace(/_/g, ' '),
                    nutrition: formattedNutrition
                  })
                } else {
                  console.log(`[Nutrition API] No calories found in nutrition data`)
                }
              } else {
                console.log(`[Nutrition API] Empty nutrition data array`)
              }
            } else {
              console.log(`[Nutrition API] Failed to fetch nutrition values: ${nutritionResponse.status}`)
            }
          } else {
            console.log(`[Nutrition API] No matching food found for "${originalTerm}" (searched with Swedish terms: [${swedishTerms.join(', ')}])`)
            // Log first few food names for debugging
            if (foods.length > 0) {
              console.log(`[Nutrition API] Sample food names from first page:`, foods.slice(0, 10).map((f: any) => f.namn))
            }
            // Also log if we searched through multiple pages
            if (totalRecords > foods.length) {
              console.log(`[Nutrition API] Searched through ${Math.min(Math.ceil(totalRecords / 100), 11)} pages (${totalRecords} total foods)`)
            }
          }
        } else {
          console.log(`[Nutrition API] Empty foods array or invalid response`)
        }
      } else {
        console.log(`[Nutrition API] Failed to fetch foods list: ${searchResponse.status}`)
      }
    } catch (apiError: any) {
      // Log error but fall through to estimated values
      if (apiError.name !== 'AbortError') {
        console.error('[Nutrition API] Livsmedelsverket API error:', apiError.message)
      } else {
        console.log('[Nutrition API] Request timeout (10s)')
      }
    }

    // Fallback to estimated values based on food type
    // Note: LSTM predicts eating patterns (next meal), not nutrition for specific foods
    // LLM provides recommendations, not specific nutrition values
    // So we use estimated values based on food category
    
    const estimatedNutrition = getEstimatedNutrition(sanitizedFoodClass)

    return NextResponse.json({
      source: 'Estimated',
      foodName: sanitizedFoodClass.replace(/_/g, ' '),
      nutrition: estimatedNutrition
    })
  } catch (error: any) {
    console.error('Nutrition fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch nutrition data',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
