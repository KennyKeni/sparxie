import { z } from 'zod'

/** Bounded provider status that may accompany a resolved destination. */
export const resolvedDestinationProviderStatuses = ['hidden', 'closed'] as const
export const resolvedDestinationProviderStatusSchema = z.enum(resolvedDestinationProviderStatuses)
export type ResolvedDestinationProviderStatus =
  z.infer<typeof resolvedDestinationProviderStatusSchema>
