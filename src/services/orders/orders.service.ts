import { ObjectId, WithId } from "mongodb";
import { readminCollections } from "~/services/mongo.service";
import {
  Order,
  OrderItem,
  OrderLogEvent,
  OrderSource,
  OrderStatus,
} from "~/services/NewMongoTypes/Order.type";
import { ORDER_TRANSITIONS, OrderAction, ACTIVE_ORDER_STATUSES } from "./stateMachine";
import { resolvePosConfig, getCatalogPayload, CatalogPayload } from "./catalog.service";

// Cap on how many active orders a single queue returns per sync tick. The plan
// flags unbounded `queueState` as a payload-size risk; this is the backstop.
const MAX_ACTIVE_PER_QUEUE = 50;

// ── Shared op inputs / outputs ───────────────────────────────────────────────

// Everything the handler layer needs to place an order in the right group/game/
// distribution. Both transports resolve this from `req.workspace` / the per-game
// config before calling in, so the op functions stay transport-agnostic.
export type OrderContext = {
  groupId: string;
  gameId: string;
  placeId: string;
  distribution: number;
};

export type CreateOrderInput = {
  idempotencyKey: string;
  customerId: string;
  cashierId?: string;
  source: OrderSource;
  queueId?: string;
  items: { productId: string; quantity: number }[];
  instantComplete?: boolean;
};

export type TransitionInput = {
  idempotencyKey?: string;
  orderId: string;
  action: OrderAction;
  actorId: string;
};

export type OrderOpError = { code: string; message: string };
export type OrderOpOutcome =
  | { success: true; order: WithId<Order> }
  | { success: false; error: OrderOpError };

// The per-op result echoed back so the client can match it to the op it sent.
export type OrderOpResult = {
  idempotencyKey: string;
  success: boolean;
  order?: WithId<Order>;
  error?: OrderOpError;
};

export type SyncOrdersRequest = {
  ops?: Array<
    | ({ op: "create" } & CreateOrderInput)
    | ({ op: "transition" } & TransitionInput)
  >;
  activeQueues?: string[];
  catalogVersion?: number;
};

export type SyncOrdersResponse = {
  opResults: OrderOpResult[];
  queueState: Record<string, WithId<Order>[]>;
  catalog?: CatalogPayload;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function safeObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

// Atomic per-(group, game, UTC-day) order number. $inc on an upserted counter
// doc so concurrent creates never hand out the same number.
async function nextOrderNumber(groupId: string, gameId: string): Promise<number> {
  const day = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  const res = await readminCollections.order_counter.findOneAndUpdate(
    { groupId, gameId, day },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return res?.seq ?? 1;
}

// ── create ───────────────────────────────────────────────────────────────────

export async function createOrderOp(
  ctx: OrderContext,
  input: CreateOrderInput,
): Promise<OrderOpOutcome> {
  // Idempotency: a retried sync tick (or REST retry) carrying the same key
  // resolves to the already-created order rather than duplicating it.
  if (input.idempotencyKey) {
    const existing = await readminCollections.orders.findOne({
      groupId: ctx.groupId,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) return { success: true, order: existing };
  }

  if (!input.items || input.items.length === 0) {
    return { success: false, error: { code: "empty_order", message: "Order has no items" } };
  }

  // Resolve prices/names from the catalog — the client never sends prices.
  const objectIds = input.items
    .map((i) => safeObjectId(i.productId))
    .filter((id): id is ObjectId => id !== null);
  const products = await readminCollections.product
    .find({ groupId: ctx.groupId, _id: { $in: objectIds } })
    .toArray();
  const byId = new Map(products.map((p) => [p._id!.toString(), p]));

  const items: OrderItem[] = [];
  let total = 0;
  let anyPriced = false;
  for (const line of input.items) {
    const product = byId.get(line.productId);
    if (!product) {
      return {
        success: false,
        error: { code: "unknown_product", message: `Unknown product ${line.productId}` },
      };
    }
    const quantity = Math.max(1, Math.floor(line.quantity || 1));
    const item: OrderItem = { productId: line.productId, name: product.name, quantity };
    if (typeof product.price === "number") {
      item.unitPrice = product.price;
      total += product.price * quantity;
      anyPriced = true;
    }
    items.push(item);
  }

  // Validate / default the queue against the resolved config.
  const config = await resolvePosConfig(ctx.groupId, ctx.gameId);
  let queueId = input.queueId;
  if (queueId) {
    if (config.queues.length && !config.queues.some((q) => q.id === queueId)) {
      return { success: false, error: { code: "invalid_queue", message: `Unknown queue ${queueId}` } };
    }
  } else {
    queueId = config.queues[0]?.id || "default";
  }

  const now = new Date();
  const actor = input.cashierId || input.customerId;
  const orderNumber = await nextOrderNumber(ctx.groupId, ctx.gameId);
  const involvedUsers = Array.from(
    new Set([input.cashierId, input.customerId].filter((v): v is string => !!v)),
  );

  // Retail / instant-complete skips prep entirely — created already finished.
  const status: OrderStatus = input.instantComplete ? "completed" : "submitted";
  const log: OrderLogEvent[] = [
    { event: "submitted", userId: actor, date: now, idempotencyKey: input.idempotencyKey },
  ];
  if (input.instantComplete) {
    log.push({ event: "completed", userId: actor, date: now });
  }

  const doc: Order = {
    groupId: ctx.groupId,
    distribution: ctx.distribution,
    gameId: ctx.gameId,
    placeId: ctx.placeId,
    schemaVersion: 2,
    customerId: input.customerId,
    cashierId: input.cashierId,
    source: input.source,
    queueId,
    orderNumber,
    items,
    total: anyPriced ? total : undefined,
    status,
    log,
    involvedUsers,
    created: now,
    lastModified: now,
    idempotencyKey: input.idempotencyKey || undefined,
    ...(input.instantComplete ? { completed: now, finished: now } : {}),
  };

  try {
    const res = await readminCollections.orders.insertOne(doc);
    return { success: true, order: { ...doc, _id: res.insertedId } };
  } catch (e: any) {
    // Lost an idempotency-key race — return the winner.
    if (e?.code === 11000 && input.idempotencyKey) {
      const existing = await readminCollections.orders.findOne({
        groupId: ctx.groupId,
        idempotencyKey: input.idempotencyKey,
      });
      if (existing) return { success: true, order: existing };
    }
    return { success: false, error: { code: "create_failed", message: "Failed to create order" } };
  }
}

// ── transition ───────────────────────────────────────────────────────────────

export async function transitionOrderOp(
  ctx: OrderContext,
  input: TransitionInput,
): Promise<OrderOpOutcome> {
  const orderObjectId = safeObjectId(input.orderId);
  if (!orderObjectId) {
    return { success: false, error: { code: "invalid_order", message: "Invalid order id" } };
  }
  const rule = ORDER_TRANSITIONS[input.action];
  if (!rule) {
    return { success: false, error: { code: "invalid_action", message: `Unknown action ${input.action}` } };
  }

  // True idempotency: this exact op already applied (its key is in the log).
  if (input.idempotencyKey) {
    const already = await readminCollections.orders.findOne({
      _id: orderObjectId,
      groupId: ctx.groupId,
      "log.idempotencyKey": input.idempotencyKey,
    });
    if (already) return { success: true, order: already };
  }

  const now = new Date();
  const set: Partial<Order> = { status: rule.to, lastModified: now };
  if (rule.timestamp) set[rule.timestamp] = now;
  if (rule.setPreparedBy) set.preparedBy = input.actorId;

  const logEvent: OrderLogEvent = {
    event: rule.to,
    userId: input.actorId,
    date: now,
    idempotencyKey: input.idempotencyKey,
  };

  // Status-preconditioned atomic update → resolves bumpbar/touch/kiosk races.
  const updated = await readminCollections.orders.findOneAndUpdate(
    { _id: orderObjectId, groupId: ctx.groupId, status: { $in: rule.from } },
    {
      $set: set,
      $push: { log: logEvent },
      $addToSet: { involvedUsers: input.actorId },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    const current = await readminCollections.orders.findOne({
      _id: orderObjectId,
      groupId: ctx.groupId,
    });
    if (!current) {
      return { success: false, error: { code: "not_found", message: "Order not found" } };
    }
    // Already in the target status — treat a redundant transition as success.
    if (current.status === rule.to) return { success: true, order: current };
    return {
      success: false,
      error: {
        code: "conflict",
        message: `Cannot ${input.action} an order in status ${current.status}`,
      },
    };
  }
  return { success: true, order: updated };
}

// ── queue state + sync orchestration ─────────────────────────────────────────

export async function getQueueState(
  groupId: string,
  gameId: string,
  queueIds: string[],
): Promise<Record<string, WithId<Order>[]>> {
  const state: Record<string, WithId<Order>[]> = {};
  // De-dupe requested queues.
  for (const queueId of Array.from(new Set(queueIds))) {
    state[queueId] = await readminCollections.orders
      .find({ groupId, gameId, queueId, status: { $in: ACTIVE_ORDER_STATUSES } })
      .sort({ created: 1 })
      .limit(MAX_ACTIVE_PER_QUEUE)
      .toArray();
  }
  return state;
}

// The single entrypoint the activity-sync handler delegates to. Runs each
// batched op through the same op functions the REST routes use, returns the
// requested queues' active orders, and includes a catalog delta only when the
// client's cached version is stale.
export async function processSyncOrders(
  ctx: OrderContext,
  block: SyncOrdersRequest,
): Promise<SyncOrdersResponse> {
  const opResults: OrderOpResult[] = [];

  for (const op of block.ops ?? []) {
    if (op.op === "create") {
      const outcome = await createOrderOp(ctx, op);
      opResults.push(toOpResult(op.idempotencyKey, outcome));
    } else if (op.op === "transition") {
      const outcome = await transitionOrderOp(ctx, op);
      opResults.push(toOpResult(op.idempotencyKey ?? "", outcome));
    }
  }

  const queueState = await getQueueState(ctx.groupId, ctx.gameId, block.activeQueues ?? []);

  const config = await resolvePosConfig(ctx.groupId, ctx.gameId);
  let catalog: CatalogPayload | undefined;
  if (
    typeof block.catalogVersion !== "number" ||
    block.catalogVersion < config.catalogVersion
  ) {
    catalog = await getCatalogPayload(ctx.groupId, ctx.gameId);
  }

  return { opResults, queueState, catalog };
}

function toOpResult(idempotencyKey: string, outcome: OrderOpOutcome): OrderOpResult {
  if (outcome.success) {
    return { idempotencyKey, success: true, order: outcome.order };
  }
  return { idempotencyKey, success: false, error: outcome.error };
}
