import { describe, it, expect } from 'vitest'
import { cn } from '../lib/utils.js'

describe('cn()', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('merges Tailwind utility classes, keeping the last wins', () => {
    const result = cn('p-2', 'p-4', 'bg-red-500', 'bg-red-600')
    expect(result.split(' ').sort()).toEqual(
      ['bg-red-600', 'p-4'].sort()
    )
  })

  it('handles falsy or undefined inputs gracefully', () => {
    expect(cn(null, undefined, 'baz')).toBe('baz')
    expect(cn(false, 'a', 0, 'b')).toBe('a b')
  })
})
