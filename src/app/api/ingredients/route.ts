import { NextRequest, NextResponse } from 'next/server'

/** Default weight in grams per piece for common ingredients (Swedish + English). */
const DEFAULT_WEIGHT_PER_PIECE: Record<string, number> = {
  egg: 50, ägg: 50, eggs: 50,
  banana: 120, banan: 120, bananas: 120,
  apple: 180, äpple: 180, apples: 180,
  bread: 30, bröd: 30, slice: 30, skiva: 30,
  orange: 150, apelsin: 150,
  milk: 250, mjölk: 250, glass: 250, glas: 250,
  oatmeal: 40, havregryn: 40, oats: 40,
  rice: 80, ris: 80,
  chicken: 150, kyckling: 150,
  potato: 150, potatis: 150,
}

interface ParsedIngredient {
  name: string
  amountG: number
  raw: string
}

/** Parse "2 eggs", "100 g oats", "100g havregryn", "1 banana" into { name, amountG }. */
function parseIngredientLine(line: string): ParsedIngredient | null {
  const raw = line.trim()
  if (!raw) return null
  // Match: optional number, optional unit (g, kg, ml, L, st, stk, etc.), rest is name
  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|L|st|stk|piece|pieces|portion|portions|portioner)?\s*(.+)$/i)
  if (!match) {
    // No number: treat whole line as name, assume 100g
    return { name: raw.trim().toLowerCase(), amountG: 100, raw }
  }
  const num = parseFloat(match[1].replace(',', '.'))
  const unit = (match[2] || '').toLowerCase()
  const name = match[3].trim().toLowerCase()
  if (!name) return null

  let amountG: number
  if (unit === 'g') amountG = num
  else if (unit === 'kg') amountG = num * 1000
  else if (unit === 'ml' || unit === 'l') amountG = num * (unit === 'l' ? 1000 : 1) // ml ≈ g for water; rough
  else {
    // pieces / st / stk / portion
    const key = name.split(/\s+/)[0]
    const perPiece = DEFAULT_WEIGHT_PER_PIECE[key] ?? DEFAULT_WEIGHT_PER_PIECE[name] ?? 100
    amountG = num * perPiece
  }
  return { name, amountG, raw }
}

/** Normalize ingredient name for nutrition API (accepts Swedish or English). */
function toFoodClass(name: string): string {
  return name.trim().replace(/\s+/g, '_').toLowerCase() || 'unknown'
}

const NUTRITION_API_TIMEOUT = 8000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'No ingredients text provided' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`

    const lines = text.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean)
    const parsed: ParsedIngredient[] = []
    for (const line of lines) {
      const p = parseIngredientLine(line)
      if (p && p.amountG > 0) parsed.push(p)
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse any ingredients. Try e.g. "2 eggs, 100 g oats, 1 banana"' },
        { status: 400 }
      )
    }

    const breakdown: Array<{ name: string; amountG: number; nutrition: Record<string, number>; source?: string }> = []
    let totalCalories = 0
    let totalProtein = 0
    let totalCarbs = 0
    let totalFat = 0
    let totalFiber = 0
    const sources = new Set<string>()

    for (const { name, amountG } of parsed) {
      const foodClass = toFoodClass(name)
      try {
        const res = await fetch(`${baseUrl}/api/nutrition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foodClass }),
          signal: AbortSignal.timeout(NUTRITION_API_TIMEOUT)
        })
        if (!res.ok) continue
        const data = await res.json()
        const nut = data.nutrition
        if (!nut || typeof nut.calories !== 'number') continue

        const factor = amountG / 100
        const nutrition = {
          calories: Math.round((nut.calories ?? 0) * factor),
          protein: Math.round((nut.protein ?? 0) * factor * 10) / 10,
          carbs: Math.round((nut.carbs ?? 0) * factor * 10) / 10,
          fat: Math.round((nut.fat ?? 0) * factor * 10) / 10,
          fiber: Math.round((nut.fiber ?? 0) * factor * 10) / 10
        }
        breakdown.push({ name: name.replace(/_/g, ' '), amountG, nutrition, source: data.source })
        if (data.source) sources.add(data.source)

        totalCalories += nutrition.calories
        totalProtein += nutrition.protein
        totalCarbs += nutrition.carbs
        totalFat += nutrition.fat
        totalFiber += nutrition.fiber
      } catch (_) {
        // Skip ingredient on timeout/error
      }
    }

    if (breakdown.length === 0) {
      return NextResponse.json(
        { error: 'Could not find nutrition for any ingredient. Try different names (Swedish or English).' },
        { status: 404 }
      )
    }

    const total = {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      fiber: Math.round(totalFiber * 10) / 10
    }

    return NextResponse.json({
      total,
      breakdown,
      source: Array.from(sources).join(', ') || 'Estimated'
    })
  } catch (e: any) {
    console.error('Ingredients API error:', e)
    return NextResponse.json({ error: e.message || 'Failed to get nutrition' }, { status: 500 })
  }
}
