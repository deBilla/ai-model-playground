import { z } from 'zod'

export const RegisterRequestSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100).optional(),
})

export const LoginRequestSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type RegisterRequestDto = z.infer<typeof RegisterRequestSchema>
export type LoginRequestDto = z.infer<typeof LoginRequestSchema>
