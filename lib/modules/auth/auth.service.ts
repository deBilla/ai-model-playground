import bcrypt from 'bcryptjs'
import type { User } from '@/lib/types'
import type { AuthRepository } from './auth.repository'
import type { RegisterRequestDto, LoginRequestDto } from './auth.dto'

function toUser(u: { id: string; email: string | null; name: string | null; isGuest: boolean; createdAt: Date }): User {
  return { id: u.id, email: u.email, name: u.name, isGuest: u.isGuest, createdAt: u.createdAt.toISOString() }
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async register(dto: RegisterRequestDto): Promise<User> {
    const existing = await this.repository.findByEmail(dto.email)
    if (existing) throw new Error('Email already in use')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.repository.create(dto.email, passwordHash, dto.name)
    return toUser(user)
  }

  async login(dto: LoginRequestDto): Promise<{ userId: string; user: User }> {
    const dbUser = await this.repository.findByEmail(dto.email)
    // Reject guest accounts and accounts without a password hash — same error to avoid enumeration
    if (!dbUser || dbUser.isGuest || !dbUser.passwordHash) throw new Error('Invalid email or password')

    const valid = await bcrypt.compare(dto.password, dbUser.passwordHash)
    if (!valid) throw new Error('Invalid email or password')

    return {
      userId: dbUser.id,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        isGuest: false,
        createdAt: dbUser.createdAt.toISOString(),
      },
    }
  }

  async me(userId: string): Promise<User | null> {
    const user = await this.repository.findById(userId)
    if (!user) return null
    return toUser(user)
  }

  async createGuest(): Promise<User> {
    const user = await this.repository.createGuest()
    return toUser(user)
  }

  async getGuestById(id: string): Promise<User | null> {
    const user = await this.repository.findGuestById(id)
    if (!user || !user.isGuest) return null
    return toUser(user)
  }

  async registerFromGuest(guestId: string, dto: RegisterRequestDto): Promise<User> {
    const guest = await this.repository.findGuestById(guestId)
    if (!guest || !guest.isGuest) {
      // Guest not found or not a guest — fall back to regular registration
      return this.register(dto)
    }

    const existing = await this.repository.findByEmail(dto.email)
    if (existing) throw new Error('Email already in use')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.repository.convertGuestToUser(guestId, dto.email, passwordHash, dto.name)
    return toUser(user)
  }

  async mergeGuestOnLogin(guestId: string, realUserId: string): Promise<void> {
    await this.repository.mergeAndDeleteGuest(guestId, realUserId)
  }

  async deleteExpiredGuests(): Promise<number> {
    return this.repository.deleteExpiredGuests()
  }
}
