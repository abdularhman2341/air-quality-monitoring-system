// One CSV field: quoted when it has a quote, comma or new line, with inner
// quotes doubled (RFC 4180).
export function cell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
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
