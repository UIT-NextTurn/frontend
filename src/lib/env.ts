import 'server-only';

import { z } from 'zod';

const serverEnvSchema = z.object({
  NEXTTURN_BACKEND_URL: z
    .string()
    .trim()
    .min(1, 'NEXTTURN_BACKEND_URL is required')
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'NEXTTURN_BACKEND_URL must be an http or https URL' }
    )
    .transform((value) => value.replace(/\/+$/, '')),
});

export interface ServerEnv {
  backendUrl: string;
}

export class ServerEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerEnvError';
  }
}

/**
 * Validates and returns server-only environment configuration at request time.
 */
export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NEXTTURN_BACKEND_URL: process.env.NEXTTURN_BACKEND_URL,
  });

  if (!result.success) {
    throw new ServerEnvError('Server backend URL configuration is missing or invalid.');
  }

  return {
    backendUrl: result.data.NEXTTURN_BACKEND_URL,
  };
}
