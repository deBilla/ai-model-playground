import { prisma } from '@/lib/db'
import { GUEST_SESSION_DAYS } from '@/lib/constants'

const SELECT_PUBLIC = { id: true, email: true, name: true, createdAt: true, isGuest: true } as const

export class AuthRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: SELECT_PUBLIC,
    })
  }

  async create(email: string, passwordHash: string, name?: string) {
    return prisma.user.create({
      data: { email, passwordHash, name },
      select: SELECT_PUBLIC,
    })
  }

  async createGuest() {
    const guestExpiry = new Date(Date.now() + GUEST_SESSION_DAYS * 24 * 60 * 60 * 1000)
    return prisma.user.create({
      data: { isGuest: true, guestExpiry },
      select: SELECT_PUBLIC,
    })
  }

  async findGuestById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { ...SELECT_PUBLIC, isGuest: true },
    })
  }

  async convertGuestToUser(id: string, email: string, passwordHash: string, name?: string) {
    return prisma.user.update({
      where: { id },
      data: { email, passwordHash, name, isGuest: false, guestExpiry: null },
      select: SELECT_PUBLIC,
    })
  }

  async mergeAndDeleteGuest(guestId: string, targetUserId: string): Promise<void> {
    await prisma.$transaction([
      prisma.comparison.updateMany({
        where: { userId: guestId },
        data: { userId: targetUserId },
      }),
      prisma.user.delete({ where: { id: guestId } }),
    ])
  }

  async deleteExpiredGuests(): Promise<number> {
    const result = await prisma.user.deleteMany({
      where: { isGuest: true, guestExpiry: { lte: new Date() } },
    })
    return result.count
  }
}
