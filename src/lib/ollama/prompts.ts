export const SYSTEM_PROMPTS = {
  nutrition: `Du ar en expert pa naring och kost.
Svara alltid pa svenska med korrekt grammatik.
Anvand information fran Livsmedelsverket for att ge korrekta svar.
Var kortfattad, praktisk och professionell.
Ge konkreta rad och undvik vaga formuleringar.`,

  recommendations: `Du ar en kostragivare.
Ge personliga kostrekommendationer baserat pa anvandardens naringsvarden och athistorik.
Svara alltid pa svenska.
Var konkret och praktisk.
Ge max 3-5 rekommendationer i punktform.
Undvik generella rad - fokusera pa anvandardens specifika situation.`,

  foodInfo: `Du ar en matexpert.
Svara pa fragor om matratters ingredienser, ursprung och tillagning.
Svara alltid pa svenska.
Var informativ men kortfattad.
Ge exempel nar det ar relevant.`,

  healthAdvice: `Du ar en halsodgivare.
Ge rad om kost och halsa baserat pa vetenskaplig evidens.
Svara alltid pa svenska.
Var tydlig med att du inte ersatter professionell sjukvard.
Rekommendera att konsultera lakare for medicinska fragor.`
}

export function createNutritionPrompt(  // build prompt with context
  question: string,
  context?: { foodClass?: string; nutrition?: Record<string, number> }
): string {
  let prompt = question
  
  if (context) {
    const parts = []
    if (context.foodClass) parts.push(`Matratt: ${context.foodClass}`)
    if (context.nutrition) {
      const str = Object.entries(context.nutrition).map(([k, v]) => `${k}: ${v}`).join(', ')
      parts.push(`Naringsvarden: ${str}`)
    }
    if (parts.length > 0) prompt = `Kontext: ${parts.join('. ')}\n\nFraga: ${question}`
  }
  
  return prompt
}

export function createRecommendationPrompt(  // build recommendation prompt
  nutrition: Record<string, number>,
  history: Array<{ foodClass: string; calories: number }>,
  goals?: { targetCalories?: number; dietary?: string[] }
): string {
  const parts = ['Ge kostrekommendationer baserat pa folande:']
  
  parts.push(`\nSenaste maltiden:`)  // current meal
  parts.push(`- Kalorier: ${nutrition.calories || 0} kcal`)
  parts.push(`- Protein: ${nutrition.protein || 0} g`)
  parts.push(`- Kolhydrater: ${nutrition.carbs || 0} g`)
  parts.push(`- Fett: ${nutrition.fat || 0} g`)
  
  if (history.length > 0) {  // history summary
    const total = history.reduce((sum, h) => sum + (h.calories || 0), 0)
    const avg = Math.round(total / history.length)
    const recent = history.slice(-5).map(h => h.foodClass).join(', ')
    parts.push(`\nHistorik (${history.length} maltider):`)
    parts.push(`- Genomsnitt: ${avg} kcal`)
    parts.push(`- Senaste: ${recent}`)
  }
  
  if (goals) {  // user goals
    parts.push(`\nMal:`)
    if (goals.targetCalories) parts.push(`- Kalorier: ${goals.targetCalories} kcal/dag`)
    if (goals.dietary?.length) parts.push(`- Restriktioner: ${goals.dietary.join(', ')}`)
  }
  
  parts.push(`\nGe 3-5 konkreta rekommendationer pa svenska.`)
  return parts.join('\n')
}

export default SYSTEM_PROMPTS
