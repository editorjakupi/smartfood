import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/barcode?code=3017620422003
 * Looks up product by barcode (EAN/UPC) via Open Food Facts API.
 * Returns product name and nutrition per 100g for use in SmartFood.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim()
  if (!code || !/^\d+$/.test(code)) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 })
  }
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments`
    const res = await fetch(url, { headers: { 'User-Agent': 'SmartFood/1.0' } })
    if (!res.ok) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    const data = await res.json()
    const product = data.product
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    const nut = product.nutriments || {}
    const get = (key: string) => nut[key] ?? nut[`${key}_100g`] ?? null
    const name = product.product_name || product.brands || 'Unknown product'
    const energyKcal = get('energy-kcal') ?? (get('energy') != null ? Math.round((get('energy') as number) / 4.184) : null)
    const nutritionPer100 = {
      calories: energyKcal,
      protein: get('proteins'),
      carbs: get('carbohydrates'),
      fat: get('fat'),
      fiber: get('fiber')
    }
    // Normalize to numbers where possible
    const toNum = (v: unknown): number | null => (v == null || v === '') ? null : typeof v === 'number' ? v : parseFloat(String(v))
    return NextResponse.json({
      product_name: name,
      brands: product.brands || null,
      barcode: code,
      nutrition_per_100g: {
        calories: toNum(nutritionPer100.calories),
        protein: toNum(nutritionPer100.protein),
        carbs: toNum(nutritionPer100.carbs),
        fat: toNum(nutritionPer100.fat),
        fiber: toNum(nutritionPer100.fiber)
      }
    })
  } catch (e) {
    console.error('Barcode lookup error:', e)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
