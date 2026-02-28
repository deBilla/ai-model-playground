import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MetricsBadge from '@/components/MetricsBadge'

const base = {
  promptTokens: 100,
  completionTokens: 200,
  totalTokens: 300,
  estimatedCost: 0.0045,
  latencyMs: 1200,
}

describe('MetricsBadge', () => {
  it('renders total token count', () => {
    render(<MetricsBadge {...base} />)
    expect(screen.getByText('300 tok')).toBeInTheDocument()
  })

  it('renders formatted cost (< $0.01 uses 6 decimal precision)', () => {
    render(<MetricsBadge {...base} estimatedCost={0.0045} />)
    expect(screen.getByText('$0.0045')).toBeInTheDocument()
  })

  it('renders cost >= $0.01 with 4 decimal places', () => {
    render(<MetricsBadge {...base} estimatedCost={0.0123} />)
    expect(screen.getByText('$0.0123')).toBeInTheDocument()
  })

  it('formats latency in seconds when >= 1000ms', () => {
    render(<MetricsBadge {...base} latencyMs={1200} />)
    expect(screen.getByText('1.20s')).toBeInTheDocument()
  })

  it('formats latency in ms when < 1000ms', () => {
    render(<MetricsBadge {...base} latencyMs={450} />)
    expect(screen.getByText('450ms')).toBeInTheDocument()
  })

  it('shows TTFT pill when timeToFirstToken > 0', () => {
    render(<MetricsBadge {...base} timeToFirstToken={300} />)
    expect(screen.getByText('TTFT 300ms')).toBeInTheDocument()
  })

  it('formats TTFT in seconds when >= 1000ms', () => {
    render(<MetricsBadge {...base} timeToFirstToken={1500} />)
    expect(screen.getByText('TTFT 1.50s')).toBeInTheDocument()
  })

  it('hides TTFT pill when timeToFirstToken is 0', () => {
    render(<MetricsBadge {...base} timeToFirstToken={0} />)
    expect(screen.queryByText(/TTFT/)).not.toBeInTheDocument()
  })

  it('hides TTFT pill when timeToFirstToken is not provided', () => {
    render(<MetricsBadge {...base} />)
    expect(screen.queryByText(/TTFT/)).not.toBeInTheDocument()
  })

  it('shows tok/s pill when tokensPerSecond > 0', () => {
    render(<MetricsBadge {...base} tokensPerSecond={45.6} />)
    expect(screen.getByText('45.6 tok/s')).toBeInTheDocument()
  })

  it('rounds tok/s to one decimal place', () => {
    render(<MetricsBadge {...base} tokensPerSecond={12.345} />)
    expect(screen.getByText('12.3 tok/s')).toBeInTheDocument()
  })

  it('hides tok/s pill when tokensPerSecond is 0', () => {
    render(<MetricsBadge {...base} tokensPerSecond={0} />)
    expect(screen.queryByText(/tok\/s/)).not.toBeInTheDocument()
  })

  it('hides tok/s pill when tokensPerSecond is not provided', () => {
    render(<MetricsBadge {...base} />)
    expect(screen.queryByText(/tok\/s/)).not.toBeInTheDocument()
  })

  it('renders all five pills when all optional props are positive', () => {
    render(<MetricsBadge {...base} timeToFirstToken={200} tokensPerSecond={30} />)
    // tokens, cost, latency, TTFT, tok/s
    expect(screen.getByText('300 tok')).toBeInTheDocument()
    expect(screen.getByText('$0.0045')).toBeInTheDocument()
    expect(screen.getByText('1.20s')).toBeInTheDocument()
    expect(screen.getByText('TTFT 200ms')).toBeInTheDocument()
    expect(screen.getByText('30.0 tok/s')).toBeInTheDocument()
  })

  it('renders exactly three pills when optional props are absent', () => {
    render(<MetricsBadge {...base} />)
    const pills = document.querySelectorAll('span.font-mono')
    expect(pills).toHaveLength(3)
  })
})
