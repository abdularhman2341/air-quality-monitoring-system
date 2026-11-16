import { describe, it, expect } from 'vitest'
import { passwordErrorKey } from '../src/utils/password.js'

describe('passwordErrorKey', () => {
  it('rejects a password shorter than 8 characters', () => {
    expect(passwordErrorKey('abc1234', 'abc1234')).toBe('signup.passwordTooShort')
  })

  it('accepts exactly 8 characters', () => {
    expect(passwordErrorKey('abcd1234', 'abcd1234')).toBeNull()
  })

  it('rejects a password longer than 72 bytes', () => {
    const password = 'ب'.repeat(37) // 37 Arabic letters = 74 bytes
    expect(passwordErrorKey(password, password)).toBe('signup.passwordTooLong')
  })

  it('accepts a password of exactly 72 bytes', () => {
    const password = 'ب'.repeat(36) // 36 Arabic letters = 72 bytes
    expect(passwordErrorKey(password, password)).toBeNull()
  })

  it('counts bytes, not characters', () => {
    const password = 'a'.repeat(73) // 73 English letters = 73 bytes
    expect(passwordErrorKey(password, password)).toBe('signup.passwordTooLong')
  })

  it('rejects a confirmation that does not match', () => {
    expect(passwordErrorKey('abcd1234', 'abcd12345')).toBe('signup.passwordMismatch')
  })

  it('checks the length before the confirmation', () => {
    expect(passwordErrorKey('abc', 'xyz')).toBe('signup.passwordTooShort')
  })
})
