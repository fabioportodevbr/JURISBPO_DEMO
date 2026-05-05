export const CNJ_REGEX = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g

export function extractProcessNumber(text: string): string | undefined {
  const match = text.match(CNJ_REGEX)
  return match?.[0]
}
