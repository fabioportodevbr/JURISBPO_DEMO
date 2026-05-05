const TRIBUNAL_PATTERNS: Array<[RegExp, string]> = [
  [/\bTJSP\b|Tribunal de Justi[cç]a de S[ãa]o Paulo/i, 'TJSP'],
  [/\bTJDFT\b|Tribunal de Justi[cç]a do Distrito Federal/i, 'TJDFT'],
  [/\bTJGO\b|Tribunal de Justi[cç]a do Estado de Goi[aá]s/i, 'TJGO'],
  [/\bTJMG\b|Tribunal de Justi[cç]a de Minas Gerais/i, 'TJMG'],
  [/\bTJRJ\b|Tribunal de Justi[cç]a do Rio de Janeiro/i, 'TJRJ'],
  [/\bTRF1\b|Tribunal Regional Federal da 1/i, 'TRF1'],
  [/\bTRF2\b|Tribunal Regional Federal da 2/i, 'TRF2'],
  [/\bTRF3\b|Tribunal Regional Federal da 3/i, 'TRF3'],
  [/\bTRF4\b|Tribunal Regional Federal da 4/i, 'TRF4'],
  [/\bTRF5\b|Tribunal Regional Federal da 5/i, 'TRF5'],
  [/\bTRF6\b|Tribunal Regional Federal da 6/i, 'TRF6'],
  [/\bTST\b|Tribunal Superior do Trabalho/i, 'TST'],
  [/\bSTJ\b|Superior Tribunal de Justi[cç]a/i, 'STJ'],
  [/\bSTF\b|Supremo Tribunal Federal/i, 'STF'],
  [/\bPJe\b/i, 'PJe'],
  [/\be-SAJ\b|ESAJ/i, 'e-SAJ']
]

export function detectTribunal(text: string): string | undefined {
  return TRIBUNAL_PATTERNS.find(([pattern]) => pattern.test(text))?.[1]
}
