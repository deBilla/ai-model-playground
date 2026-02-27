// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before any module that imports it
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { AuthRepository } from '@/lib/modules/auth/auth.repository'
import { prisma } from '@/lib/db'

const NOW = new Date('2025-01-15T10:00:00Z')

const FULL_USER = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '$2b$12$hash',
  name: 'Test User',
  createdAt: NOW,
}

// What the DB returns for "select public fields" queries
const PUBLIC_USER = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: NOW,
}

const SELECT_PUBLIC = { id: true, email: true, name: true, createdAt: true }

describe('AuthRepository', () => {
  let repo: AuthRepository

  beforeEach(() => {
    repo = new AuthRepository()
    vi.clearAllMocks()
  })

  // ── findByEmail ────────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('calls findUnique with the correct where clause', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(FULL_USER)

      const result = await repo.findByEmail('test@example.com')

      expect(prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'test@example.com' } })
      expect(result).toEqual(FULL_USER)
    })

    it('returns null when no user matches the email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await repo.findByEmail('missing@example.com')

      expect(result).toBeNull()
    })

    it('returns the full user record including passwordHash', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(FULL_USER)

      const result = await repo.findByEmail('test@example.com')

      // passwordHash must be present so AuthService can compare it
      expect(result).toHaveProperty('passwordHash')
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('queries with the correct id and selects only public fields', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(PUBLIC_USER as never)

      const result = await repo.findById('user-1')

      expect(prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { id: 'user-1' },
        select: SELECT_PUBLIC,
      })
      expect(result).toEqual(PUBLIC_USER)
    })

    it('returns null for an unknown id', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      expect(await repo.findById('no-such-id')).toBeNull()
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts with the correct data and selects public fields', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(PUBLIC_USER as never)

      const result = await repo.create('test@example.com', '$2b$hash', 'Test User')

      expect(prisma.user.create).toHaveBeenCalledExactlyOnceWith({
        data: { email: 'test@example.com', passwordHash: '$2b$hash', name: 'Test User' },
        select: SELECT_PUBLIC,
      })
      expect(result).toEqual(PUBLIC_USER)
    })

    it('passes undefined name when not provided (allows DB default)', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue({ ...PUBLIC_USER, name: null } as never)

      await repo.create('anon@example.com', '$2b$hash')

      const call = vi.mocked(prisma.user.create).mock.calls[0][0]
      expect(call.data.name).toBeUndefined()
    })

    it('never stores plain-text passwords — data only contains passwordHash', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(PUBLIC_USER as never)

      await repo.create('user@example.com', '$2b$12$hashedvalue', 'User')

      const call = vi.mocked(prisma.user.create).mock.calls[0][0]
      // The stored value is the hash, not a plain password
      expect(call.data.passwordHash).toBe('$2b$12$hashedvalue')
      expect(call.data).not.toHaveProperty('password')
    })
  })
})
