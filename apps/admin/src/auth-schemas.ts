import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6 digit code.'),
});
export type CodeValues = z.infer<typeof codeSchema>;
