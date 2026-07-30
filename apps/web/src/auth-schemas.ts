import { z } from 'zod';

/** The shared password rule. Kept in one place so every screen agrees. */
export const passwordRule = z.string().min(12, 'Use at least 12 characters.');

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z.string().email('Enter a valid email.'),
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Re-enter your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match.',
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6 digit code.'),
});
export type CodeValues = z.infer<typeof codeSchema>;

export const passwordConfirmSchema = z.object({
  password: z.string().min(1, 'Enter your password.'),
});
export type PasswordConfirmValues = z.infer<typeof passwordConfirmSchema>;

/*
 * Changing a password.
 *
 * The current password is only ever checked for presence here. Its rule lives on
 * the server, and applying today's length rule to a password set under an older
 * one would lock someone out of the very screen that lets them fix it.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Re-enter your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match.',
  })
  // Caught here as well as on the server, so the answer is immediate rather than
  // a round trip that comes back saying nothing happened.
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one.',
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
