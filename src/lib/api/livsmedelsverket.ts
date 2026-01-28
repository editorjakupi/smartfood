/**
 * Livsmedelsverket API Client
 * 
 * Interface for fetching nutrition data from Livsmedelsverket.
 */

// Use environment variable if available, otherwise fallback to default URL
const BASE_URL = process.env.LIVSMEDELSVERKET_API_URL || 'https://dataportal.livsmedelsverket.se/livsmedel'

interface Food {
  nummer: number
  namn: string
  typ: string
}

interface NutritionValue {
  namn: string
  euroFIRkod: string
  varde: number
  enhet: string
}

interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  [key: string]: number
}

export class LivsmedelsverketAPI {
  private baseUrl: string
  
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || BASE_URL
  }
  
  /**
   * Search for foods by name.
   */
  async searchFood(query: string): Promise<Food[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/livsmedel`, {
        next: { revalidate: 3600 }, // Cache for 1 hour
        headers: {
          'User-Agent': 'SmartFood-App/1.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(20000) // 20 second timeout
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const foods: Food[] = await response.json()
      
      // Filter by query
      const queryLower = query.toLowerCase().replace(/_/g, ' ')
      return foods.filter(food => 
        food.namn?.toLowerCase().includes(queryLower)
      )
    } catch (error) {
      console.error('Search error:', error)
      return []
    }
  }
  
  /**
   * Get food by number.
   */
  async getFood(nummer: number): Promise<Food | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/livsmedel/${nummer}`, {
        headers: {
          'User-Agent': 'SmartFood-App/1.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(20000) // 20 second timeout
      })
      
      if (!response.ok) {
        return null
      }
      
      return await response.json()
    } catch (error) {
      console.error('Get food error:', error)
      return null
    }
  }
  
  /**
   * Get nutrition values for a food.
   */
  async getNutritionValues(nummer: number): Promise<NutritionValue[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/livsmedel/${nummer}/naringsvarden`,
        {
          headers: {
            'User-Agent': 'SmartFood-App/1.0',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(20000) // 20 second timeout
        }
      )
      
      if (!response.ok) {
        return []
      }
      
      return await response.json()
    } catch (error) {
      console.error('Nutrition error:', error)
      return []
    }
  }
  
  /**
   * Get formatted nutrition data for a food class.
   */
  async getNutritionForFood(foodClass: string): Promise<NutritionData | null> {
    try {
      // Search for the food
      const foods = await this.searchFood(foodClass)
      
      if (foods.length === 0) {
        return null
      }
      
      // Get nutrition for first match
      const nutritionValues = await this.getNutritionValues(foods[0].nummer)
      
      // Format nutrition data
      const nutrition: NutritionData = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0
      }
      
      nutritionValues.forEach(item => {
        const name = item.namn?.toLowerCase() || ''
        const value = item.varde || 0
        
        if (name.includes('energi') && name.includes('kcal')) {
          nutrition.calories = value
        } else if (name.includes('protein')) {
          nutrition.protein = value
        } else if (name.includes('kolhydrat')) {
          nutrition.carbs = value
        } else if (name === 'fett' || (name.includes('fett') && !name.includes('fettsyra'))) {
          nutrition.fat = value
        } else if (name.includes('fiber')) {
          nutrition.fiber = value
        }
      })
      
      return nutrition
    } catch (error) {
      console.error('Get nutrition error:', error)
      return null
    }
  }
}

// Default instance
export const livsmedelsverketAPI = new LivsmedelsverketAPI()

export default livsmedelsverketAPI
