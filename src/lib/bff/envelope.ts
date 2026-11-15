import { NextResponse } from 'next/server';
import { z } from 'zod';

export const backendErrorEnvelopeSchema = z.object({
  success: z.literal(false).optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
  data: z.record(z.string(), z.string()).nullable().optional(),
});

/**
 * Creates a standardized JSON error envelope returned by Next.js BFF Route Handlers.
 */
export function buildBffErrorResponse(
  status: number,
  errorCode: string,
  message: string,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      errorCode,
      message,
      ...extra,
    },
    { status }
  );
}
