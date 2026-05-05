export function normalizeText(input: string): string {
  return input
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeForSearch(input: string): string {
  return normalizeText(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function excerpt(input: string, max = 800): string {
  const text = normalizeText(input)
  return text.length <= max ? text : `${text.slice(0, max)}...`
}
