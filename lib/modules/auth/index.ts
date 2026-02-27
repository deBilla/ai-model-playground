import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'

const authRepository = new AuthRepository()
export const authService = new AuthService(authRepository)
