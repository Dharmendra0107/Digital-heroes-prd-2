import Papa from 'papaparse'

export interface CsvMergeResult {
  totalRows: number
  validRows: number
  headers: string[]
  records: Array<{
    rowIndex: number
    number: string
    name?: string
    category?: string
    barcodeData?: string
  }>
  errors: string[]
}

function cleanField(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
}

/**
 * Validates and extracts variable data records from uploaded CSV
 */
export function processVariableDataCSV(csvContent: string): CsvMergeResult {
  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  })

  const headers = parseResult.meta.fields || []
  const errors: string[] = parseResult.errors.map(
    (error) => `CSV parsing issue at row ${(error.row ?? 0) + 1}: ${error.message}`
  )

  // Ensure necessary column exists (e.g. number, bib, or id)
  const hasNumberField = headers.some((h) =>
    ['number', 'bib', 'bib_number', 'race_number', 'id'].includes(h)
  )

  if (!hasNumberField) {
    errors.push(
      'CSV must include at least one column for competitor numbering (e.g., "number", "bib", or "id").'
    )
  }

  const records: CsvMergeResult['records'] = []

  parseResult.data.forEach((row, idx) => {
    // Find number value
    const numberVal =
      row.number || row.bib || row.bib_number || row.race_number || row.id || ''

    const number = cleanField(numberVal)
    if (!number) {
      errors.push(`Row ${idx + 1}: Missing competitor number. Skipped.`)
      return
    }

    const nameVal = row.name || row.full_name || row.athlete || row.runner || ''
    const categoryVal = row.category || row.division || row.class || row.wave || ''
    const barcodeVal = row.barcode || row.chip || row.timing_chip || `DH-${number}`
    const normalized = {
      number,
      name: cleanField(nameVal),
      category: cleanField(categoryVal),
      barcode: cleanField(barcodeVal),
    }
    const oversizedField = Object.entries(normalized).find(([, value]) => value.length > 200)
    if (oversizedField) {
      errors.push(`Row ${idx + 1}: ${oversizedField[0]} exceeds the 200 character limit. Skipped.`)
      return
    }

    records.push({
      rowIndex: idx + 1,
      number: normalized.number,
      name: normalized.name || undefined,
      category: normalized.category || undefined,
      barcodeData: normalized.barcode,
    })
  })

  return {
    totalRows: parseResult.data.length,
    validRows: records.length,
    headers,
    records,
    errors,
  }
}
