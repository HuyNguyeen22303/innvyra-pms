import { z } from 'zod';

export const platformEmail = z.string().trim().toLowerCase().pipe(z.email().max(191));
export const platformPassword = z
  .string()
  .min(15)
  .max(128)
  .refine(
    (value) => value.trim().length >= 15 && new Set(value).size >= 8,
    'Use a long, varied password or passphrase',
  );
export const platformBootstrapInput = z
  .object({
    email: platformEmail,
    fullName: z.string().trim().min(1).max(191),
    password: platformPassword,
  })
  .strict();
export const platformLoginSchema = z.object({
  body: z
    .object({
      email: platformEmail,
      password: z.string().min(1).max(128),
    })
    .strict(),
});
export const platformPasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: platformPassword,
    })
    .strict()
    .refine((input) => input.currentPassword !== input.newPassword, {
      message: 'Choose a different password',
      path: ['newPassword'],
    }),
});
export type PlatformLoginInput = z.infer<typeof platformLoginSchema>['body'];
export type PlatformPasswordInput = z.infer<typeof platformPasswordSchema>['body'];
export type PlatformBootstrapInput = z.infer<typeof platformBootstrapInput>;
