import { describe, it, expect } from 'vitest'
import { cell } from '../src/utils/csv.js'

describe('cell', () => {
  it('turns null and undefined into an empty string', () => {
    expect(cell(null)).toBe('')
    expect(cell(undefined)).toBe('')
  })

  it('leaves plain text and numbers as they are', () => {
    expect(cell('kitchen')).toBe('kitchen')
    expect(cell(850)).toBe('850')
  })

  it('wraps text containing a comma in quotes', () => {
    expect(cell('Riyadh, home')).toBe('"Riyadh, home"')
  })

  it('wraps text containing a new line in quotes', () => {
    expect(cell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('doubles quotes inside the text', () => {
    expect(cell('say "hi"')).toBe('"say ""hi"""')
  })
})

// F20: a device name such as =HYPERLINK(...) ran as a formula when the CSV
// was opened in Excel. Text that starts like a formula gets a leading ' so it
// shows as text (OWASP: CSV injection).
describe('cell and spreadsheet formulas (F20)', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tTAB'])('text starting %j is shown as text', (text) => {
    expect(cell(text)).toBe(`'${text}`)
  })

  // A carriage return alone also ends a row in Excel, so it is quoted like \n.
  it('text starting with a carriage return is shown as text and quoted', () => {
    expect(cell('\rCR')).toBe(`"'\rCR"`)
    expect(cell('a\rb')).toBe('"a\rb"')
  })

  it('quotes still work after the guard', () => {
    expect(cell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`)
    expect(cell('=1,2')).toBe(`"'=1,2"`)
  })

  it('numbers stay numbers, and text that does not start like a formula is unchanged', () => {
    expect(cell(-5)).toBe('-5')
    expect(cell('Kitchen = main')).toBe('Kitchen = main')
    expect(cell('2026-11-21T12:00:00Z')).toBe('2026-11-21T12:00:00Z')
    expect(cell(false)).toBe('false')
  })
})

