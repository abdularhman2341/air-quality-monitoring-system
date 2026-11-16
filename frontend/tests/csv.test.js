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
