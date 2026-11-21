import { describe, it, expect } from 'vitest'
import { formatPpm, formatDuration, isWarmingUp } from '../src/utils/format.js'

// A fake translate function: returns the key and the values so we can check them.
const t = (key, values) => `${key} ${JSON.stringify(values)}`

describe('formatPpm', () => {
  it('rounds to the nearest whole number', () => {
    expect(formatPpm(412.4)).toBe('412')
    expect(formatPpm(412.5)).toBe('413')
  })

  it('adds a thousands separator', () => {
    expect(formatPpm(1234.6)).toBe('1,235')
  })

  it('handles zero', () => {
    expect(formatPpm(0)).toBe('0')
  })
})

describe('formatDuration', () => {
  it('shows seconds only under a minute', () => {
    expect(formatDuration(45_000, t)).toBe('duration.s {"s":45}')
  })

  it('shows minutes and seconds under an hour', () => {
    expect(formatDuration(125_000, t)).toBe('duration.ms {"m":2,"s":5}')
  })

  it('shows hours and minutes from one hour up', () => {
    expect(formatDuration(3_725_000, t)).toBe('duration.hm {"h":1,"m":2}')
  })

  it('treats a negative duration as zero', () => {
    expect(formatDuration(-5_000, t)).toBe('duration.s {"s":0}')
  })

  it('rounds milliseconds to the nearest second', () => {
    expect(formatDuration(59_600, t)).toBe('duration.ms {"m":1,"s":0}')
  })
})

describe('isWarmingUp', () => {
  it('is true for the first 24 readings after power-up (2 minutes at one reading every 5 s)', () => {
    expect(isWarmingUp({ seq: 1 })).toBe(true)
    expect(isWarmingUp({ seq: 24 })).toBe(true)
  })

  it('is false after the warm-up', () => {
    expect(isWarmingUp({ seq: 25 })).toBe(false)
    expect(isWarmingUp({ seq: 5000 })).toBe(false)
  })

  it('is false when there is no reading or no counter', () => {
    expect(isWarmingUp(null)).toBe(false)
    expect(isWarmingUp({ seq: null })).toBe(false)
    expect(isWarmingUp({})).toBe(false)
  })
})
