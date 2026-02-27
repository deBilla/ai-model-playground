import { describe, it, expect } from 'vitest'
import {
  formatCost,
  calculateCost,
  getModel,
  isValidProviderId,
  MODELS,
} from '@/lib/models.config'

describe('formatCost', () => {
  it('strips trailing zeros for sub-$0.01 amounts', () => {
    expect(formatCost(0.001)).toBe('$0.001')
    expect(formatCost(0.000123)).toBe('$0.000123')
    expect(formatCost(0.0001)).toBe('$0.0001')
  })

  it('does not produce trailing zeros like $0.001000', () => {
    // 0.001 with 6 decimal places would be "0.001000" — verify stripped
    expect(formatCost(0.001)).not.toContain('0.001000')
    expect(formatCost(0.001)).toBe('$0.001')
  })

  it('strips trailing zeros for $0.01–$1 range', () => {
    expect(formatCost(0.1)).toBe('$0.1')
    expect(formatCost(0.01)).toBe('$0.01')
    expect(formatCost(0.5)).toBe('$0.5')
  })

  it('keeps 2 decimal places for amounts >= $1', () => {
    expect(formatCost(1)).toBe('$1.00')
    expect(formatCost(2.5)).toBe('$2.50')
    expect(formatCost(10.123)).toBe('$10.12')
  })

  it('handles zero cost', () => {
    expect(formatCost(0)).toBe('$0')
  })

  it('always starts with $', () => {
    expect(formatCost(0.000001)).toMatch(/^\$/)
    expect(formatCost(0.05)).toMatch(/^\$/)
    expect(formatCost(5)).toMatch(/^\$/)
  })
})

describe('calculateCost', () => {
  it('calculates cost correctly for openai model', () => {
    const model = getModel('openai')!
    // 1M input tokens at $5 + 1M output tokens at $15 = $20
    expect(calculateCost(model, 1_000_000, 1_000_000)).toBeCloseTo(20)
  })

  it('calculates proportional cost for smaller token counts', () => {
    const model = getModel('openai')!
    // 100 input tokens at $5/M = $0.0005; 100 output tokens at $15/M = $0.0015 → $0.002
    expect(calculateCost(model, 100, 100)).toBeCloseTo(0.002)
  })

  it('returns 0 for zero tokens', () => {
    const model = getModel('openai')!
    expect(calculateCost(model, 0, 0)).toBe(0)
  })

  it('weights output tokens heavier than input for openai', () => {
    const model = getModel('openai')!
    const inputOnly = calculateCost(model, 1000, 0)
    const outputOnly = calculateCost(model, 0, 1000)
    expect(outputOnly).toBeGreaterThan(inputOnly)
  })
})

describe('getModel', () => {
  it('returns the correct model for valid IDs', () => {
    expect(getModel('openai')?.label).toBe('GPT-4o')
    expect(getModel('anthropic')?.label).toBe('Claude 3.5 Sonnet')
    expect(getModel('xai')?.label).toBe('Grok 3')
  })

  it('returns undefined for unknown IDs', () => {
    expect(getModel('unknown')).toBeUndefined()
    expect(getModel('')).toBeUndefined()
  })
})

describe('isValidProviderId', () => {
  it('accepts all known provider IDs', () => {
    MODELS.forEach((m) => {
      expect(isValidProviderId(m.id)).toBe(true)
    })
  })

  it('rejects unknown IDs', () => {
    expect(isValidProviderId('google')).toBe(false)
    expect(isValidProviderId('')).toBe(false)
    expect(isValidProviderId('OPENAI')).toBe(false)
  })
})
