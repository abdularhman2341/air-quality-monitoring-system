// Text that a spreadsheet would run as a formula: it starts with = + - @
// or a tab or carriage return (OWASP, CSV injection). Numbers are left alone,
// so -5 stays a number.
function looksLikeFormula(value) {
  return typeof value === 'string' && /^[=+\-@\t\r]/.test(value)
}

// One CSV field: quoted when it has a quote, comma or line break, with inner
// quotes doubled (RFC 4180). Text that looks like a formula gets a leading '
// so Excel shows it as text: a device named =HYPERLINK(...) ran as a
// formula (F20).
export function cell(value) {
  const raw = value === null || value === undefined ? '' : String(value)
  const text = looksLikeFormula(value) ? `'${raw}` : raw
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCsv(filename, header, rows) {
  const lines = [header, ...rows].map((row) => row.map(cell).join(','))
  // The string starts with an invisible byte order mark (U+FEFF), so Excel
  // opens the file as UTF-8 and Arabic names show correctly. Keep it.
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
