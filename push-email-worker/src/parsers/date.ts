export function extractBrazilianDate(text: string): string | undefined {
  const match = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  if (!match) return undefined
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}
