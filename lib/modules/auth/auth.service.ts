import bcrypt from 'bcryptjs'
import type { User } from '@/lib/types'
import type { AuthRepository } from './auth.repository'
import type { RegisterRequestDto, LoginRequestDto } from './auth.dto'

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async register(dto: RegisterRequestDto): Promise<User> {
    const existing = await this.repository.findByEmail(dto.email)
    if (existing) throw new Error('Email already in use')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.repository.create(dto.email, passwordHash, dto.name)
    return { ...user, createdAt: user.createdAt.toISOString() }
  }

  async login(dto: LoginRequestDto): Promise<{ userId: string; user: User }> {
    const dbUser = await this.repository.findByEmail(dto.email)
    if (!dbUser) throw new Error('Invalid email or password')

    const valid = await bcrypt.compare(dto.password, dbUser.passwordHash)
    if (!valid) throw new Error('Invalid email or password')

    return {
      userId: dbUser.id,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        createdAt: dbUser.createdAt.toISOString(),
      },
    }
  }

  async me(userId: string): Promise<User | null> {
    const user = await this.repository.findById(userId)
    if (!user) return null
    return { ...user, createdAt: user.createdAt.toISOString() }
  }
}
