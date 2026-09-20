import { z } from "zod";

/** Formato de `PushSubscription.toJSON()` (3.9) — o que `PushManager.subscribe()` devolve no navegador. */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;
