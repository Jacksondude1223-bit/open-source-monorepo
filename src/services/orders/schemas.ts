import { z } from "zod";

// Shared validation for both transports. The REST routes parse request bodies
// with these; the sync handler parses the `orders` block with `syncOrdersBlockSchema`.
// Keeping them in one place is what guarantees REST and sync can't drift.

export const orderSourceSchema = z.enum([
  "register",
  "kiosk",
  "drive_thru",
  "api",
]);

export const orderActionSchema = z.enum([
  "claim",
  "release",
  "complete",
  "cancel",
  "set_awaiting_pickup",
  "hand_to_customer",
]);

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const createOrderBodySchema = z.object({
  idempotencyKey: z.string().min(1),
  customerId: z.string().min(1),
  cashierId: z.string().optional(),
  source: orderSourceSchema.default("api"),
  queueId: z.string().optional(),
  items: z.array(orderItemInputSchema).min(1),
  instantComplete: z.boolean().optional(),
});

export const transitionBodySchema = z.object({
  idempotencyKey: z.string().optional(),
  action: orderActionSchema,
  actorId: z.string().min(1),
});

// One op inside a sync tick's `orders.ops` array. A create op mirrors the REST
// create body; a transition op mirrors the REST transition body plus an orderId.
export const syncCreateOpSchema = createOrderBodySchema.extend({
  op: z.literal("create"),
});

export const syncTransitionOpSchema = z.object({
  op: z.literal("transition"),
  idempotencyKey: z.string().optional(),
  orderId: z.string().min(1),
  action: orderActionSchema,
  actorId: z.string().min(1),
});

export const syncOrderOpSchema = z.discriminatedUnion("op", [
  syncCreateOpSchema,
  syncTransitionOpSchema,
]);

export const syncOrdersBlockSchema = z.object({
  ops: z.array(syncOrderOpSchema).optional(),
  activeQueues: z.array(z.string()).optional(),
  catalogVersion: z.number().optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type TransitionBody = z.infer<typeof transitionBodySchema>;
export type SyncOrdersBlock = z.infer<typeof syncOrdersBlockSchema>;
