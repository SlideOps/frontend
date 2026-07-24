import { z } from 'zod';

/** The Node registration form. The credential is required but never echoed back. */
export const nodeSchema = z.object({
  name: z.string().trim().min(1, 'Give this Node a name.'),
  hostname: z.string().trim().min(1, 'Enter the hostname.'),
  address: z.string().trim().min(1, 'Enter an address SlideOps can reach.'),
  port: z.coerce
    .number({ invalid_type_error: 'Enter a port number.' })
    .int('Enter a whole number.')
    .min(1, 'Enter a valid port.')
    .max(65535, 'Enter a valid port.'),
  ssh_username: z.string().trim().min(1, 'Enter the SSH username.'),
  project_id: z.string().optional(),
  auth_kind: z.enum(['password', 'private_key']),
  secret: z.string().min(1, 'Enter the credential SlideOps will store encrypted.'),
});

export type NodeFormValues = z.infer<typeof nodeSchema>;
