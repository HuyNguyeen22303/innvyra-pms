import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9._-]+$/);
export const loginSchema = z.object({
  body: z
    .object({
      username: usernameSchema,
      password: z.string().min(1).max(128),
    })
    .strict(),
});
export type LoginInput = z.infer<typeof loginSchema>['body'];
export const adminInputSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(1).max(191),
  email: z.email().max(191).toLowerCase().optional(),
  hotelId: z
    .string()
    .regex(/^[1-9]\d{0,19}$/)
    .transform(BigInt)
    .refine((id) => id <= 18446744073709551615n),
  password: z
    .string()
    .min(15)
    .max(128)
    .refine(
      (password) => password.trim().length >= 15 && new Set(password).size >= 8,
      'Use a long, varied password or passphrase',
    ),
});
