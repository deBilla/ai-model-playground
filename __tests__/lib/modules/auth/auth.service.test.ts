// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '@/lib/modules/auth/auth.service'
import type { AuthRepository } from '@/lib/modules/auth/auth.repository'

// Mock bcryptjs before importing anything that depends on it
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

import bcrypt from 'bcryptjs'
const mockedBcrypt = vi.mocked(bcrypt)

const NOW = new Date('2025-01-15T10:00:00Z')

const DB_USER = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '$2b$12$hashedpassword',
  name: 'Test User',
  createdAt: NOW,
}

const PUBLIC_USER = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: NOW,
}

function makeMockRepo(): AuthRepository {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  } as unknown as AuthRepository
}

describe('AuthService', () => {
  let repo: AuthRepository
  let service: AuthService

  beforeEach(() => {
    repo = makeMockRepo()
    service = new AuthService(repo)
    vi.clearAllMocks()
  })

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('hashes the password with bcrypt cost factor 12', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(null)
      vi.mocked(repo.create).mockResolvedValue(PUBLIC_USER)
      mockedBcrypt.hash.mockResolvedValue('hashed_pw' as never)

      await service.register({ email: 'new@example.com', password: 'secret123' })

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('secret123', 12)
    })

    it('passes hashed password to repo.create, never the plain-text password', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(null)
      vi.mocked(repo.create).mockResolvedValue(PUBLIC_USER)
      mockedBcrypt.hash.mockResolvedValue('hashed_pw' as never)

      await service.register({ email: 'new@example.com', password: 'secret123', name: 'Alice' })

      expect(repo.create).toHaveBeenCalledWith('new@example.com', 'hashed_pw', 'Alice')
    })

    it('returns a User DTO with ISO createdAt string', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(null)
      vi.mocked(repo.create).mockResolvedValue(PUBLIC_USER)
      mockedBcrypt.hash.mockResolvedValue('hashed_pw' as never)

      const result = await service.register({ email: 'new@example.com', password: 'secret123' })

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: NOW.toISOString(),
      })
    })

    it('throws "Email already in use" when email is taken and does not call create', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(DB_USER)

      await expect(
        service.register({ email: 'test@example.com', password: 'secret123' }),
      ).rejects.toThrow('Email already in use')

      expect(repo.create).not.toHaveBeenCalled()
    })

    it('forwards optional name to repo.create', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(null)
      vi.mocked(repo.create).mockResolvedValue(PUBLIC_USER)
      mockedBcrypt.hash.mockResolvedValue('h' as never)

      await service.register({ email: 'a@b.com', password: 'secret123', name: 'Bob' })

      const [, , name] = vi.mocked(repo.create).mock.calls[0]
      expect(name).toBe('Bob')
    })
  })

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns userId and a User DTO on valid credentials', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(DB_USER)
      mockedBcrypt.compare.mockResolvedValue(true as never)

      const result = await service.login({ email: 'test@example.com', password: 'secret123' })

      expect(result.userId).toBe('user-1')
      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        createdAt: NOW.toISOString(),
      })
    })

    it('compares against the stored password hash (not plain text)', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(DB_USER)
      mockedBcrypt.compare.mockResolvedValue(true as never)

      await service.login({ email: 'test@example.com', password: 'mypassword' })

      expect(mockedBcrypt.compare).toHaveBeenCalledWith('mypassword', DB_USER.passwordHash)
    })

    it('throws "Invalid email or password" when email is not found', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(null)

      await expect(
        service.login({ email: 'nobody@example.com', password: 'secret123' }),
      ).rejects.toThrow('Invalid email or password')
    })

    it('throws "Invalid email or password" when password is wrong', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(DB_USER)
      mockedBcrypt.compare.mockResolvedValue(false as never)

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow('Invalid email or password')
    })

    it('does not reveal which field is wrong (same error for both cases)', async () => {
      vi.mocked(repo.findByEmail).mockResolvedValue(null)
      const errorOnBadEmail = await service.login({ email: 'x@x.com', password: 'pw123456' }).catch((e: Error) => e.message)

      vi.mocked(repo.findByEmail).mockResolvedValue(DB_USER)
      mockedBcrypt.compare.mockResolvedValue(false as never)
      const errorOnBadPw = await service.login({ email: 'test@example.com', password: 'pw123456' }).catch((e: Error) => e.message)

      expect(errorOnBadEmail).toBe(errorOnBadPw)
    })
  })

  // ── me ────────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns a User DTO when the user is found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(PUBLIC_USER)

      const result = await service.me('user-1')

      expect(result).toMatchObject({ id: 'user-1', createdAt: NOW.toISOString() })
      expect(repo.findById).toHaveBeenCalledWith('user-1')
    })

    it('returns null when the user does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      expect(await service.me('no-such-id')).toBeNull()
    })
  })
})
