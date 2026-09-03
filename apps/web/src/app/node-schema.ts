import { z } from 'zod';

/**
 * The Node registration form. The credential comes from one of two places:
 * pasted directly, or picked from the SSH key library. Exactly one is
 * required, validated below rather than by a single shared field, since which
 * one is required depends on which source is chosen.
 */
export const nodeSchema = z
  .object({
    name: z.string().trim().min(1, 'Give this Node a name.'),
    // Optional, a label for reference only. Address is what SlideOps connects to.
    hostname: z.string().trim().optional(),
    address: z
      .string()
      .trim()
      .min(1, 'Enter an address SlideOps can reach, an IP or a domain name.'),
    port: z.coerce
      .number({ invalid_type_error: 'Enter a port number.' })
      .int('Enter a whole number.')
      .min(1, 'Enter a valid port.')
      .max(65535, 'Enter a valid port.'),
    ssh_username: z.string().trim().min(1, 'Enter the SSH username.'),
    project_id: z.string().optional(),
    tags: z.array(z.string()).optional(),
    credential_source: z.enum(['paste', 'saved_key']),
    auth_kind: z.enum(['password', 'private_key']),
    secret: z.string().optional(),
    ssh_key_id: z.string().optional(),
    // Only meaningful when credential_source is paste and auth_kind is
    // private_key: saves the pasted key into the library under this name at
    // the same time as registering the Node.
    save_key_as: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.credential_source === 'saved_key') {
      if (!values.ssh_key_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ssh_key_id'],
          message: 'Choose a saved key.',
        });
      }
      return;
    }
    if (!values.secret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secret'],
        message: 'Enter the credential SlideOps will store encrypted.',
      });
    }
  });

export type NodeFormValues = z.infer<typeof nodeSchema>;
