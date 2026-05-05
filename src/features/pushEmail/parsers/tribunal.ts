function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const TRIBUNAL_PATTERNS: Array<[RegExp, string]> = [
  [/\btjsp\b|tribunal de justica de sao paulo/i, 'TJSP'],
  [/\btjdft\b|tribunal de justica do distrito federal/i, 'TJDFT'],
  [/\btjgo\b|tribunal de justica do estado de goias/i, 'TJGO'],
  [/\btjmg\b|tribunal de justica de minas gerais/i, 'TJMG'],
  [/\btjrj\b|tribunal de justica do rio de janeiro/i, 'TJRJ'],
  [/\btrf1\b|tribunal regional federal da 1/i, 'TRF1'],
  [/\btrf2\b|tribunal regional federal da 2/i, 'TRF2'],
  [/\btrf3\b|tribunal regional federal da 3/i, 'TRF3'],
  [/\btrf4\b|tribunal regional federal da 4/i, 'TRF4'],
  [/\btrf5\b|tribunal regional federal da 5/i, 'TRF5'],
  [/\btrf6\b|tribunal regional federal da 6/i, 'TRF6'],
  [/\btst\b|tribunal superior do trabalho/i, 'TST'],
  [/\bstj\b|superior tribunal de justica/i, 'STJ'],
  [/\bstf\b|supremo tribunal federal/i, 'STF'],
  [/\bpje\b/i, 'PJe'],
  [/\be-saj\b|esaj/i, 'e-SAJ'],
]

export function detectTribunal(text: string): string | undefined {
  const normalized = searchable(text)
  return TRIBUNAL_PATTERNS.find(([pattern]) => pattern.test(normalized))?.[1]
}
