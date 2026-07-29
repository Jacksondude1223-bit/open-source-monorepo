import { FastifyReply, FastifyRequest } from "fastify";
import { Filter, ObjectId } from "mongodb";
import { z } from "zod";
import { readminCollections } from "~/services/mongo.service";
import { Order, OrderStatus } from "~/services/NewMongoTypes/Order.type";
import {
  createOrderOp,
  transitionOrderOp,
  OrderContext,
  OrderOpError,
} from "~/services/orders/orders.service";
import {
  getCatalogPayload,
  getCatalogProducts,
  resolvePosConfig,
} from "~/services/orders/catalog.service";
import {
  createOrderBodySchema,
  transitionBodySchema,
} from "~/services/orders/schemas";

// ── shared ───────────────────────────────────────────────────────────────────

// v2 uses the documented `{ error: { code, message } }` envelope (a clean new
// surface), distinct from the legacy `{ success, reason }` shape.
function sendError(res: FastifyReply, status: number, code: string, message: string) {
  return res.status(status).send({ error: { code, message } });
}

// Module gate: every v2 route is invisible unless the workspace has the orders
// module enabled (mirrors the tRPC `moduleEnabledProcedure('orders')`).
function ensureOrdersModule(req: FastifyRequest, res: FastifyReply): boolean {
  if (!req.workspace?.enabledModules?.orders) {
    sendError(res, 403, "module_disabled", "The orders module is not enabled for this workspace.");
    return false;
  }
  return true;
}

function safeObjectId(id?: string): ObjectId | null {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

// Map an op error code to an HTTP status.
function statusForOpError(error: OrderOpError): number {
  switch (error.code) {
    case "not_found":
    case "invalid_order":
      return 404;
    case "conflict":
      return 409;
    case "unknown_product":
    case "invalid_queue":
    case "empty_order":
    case "invalid_action":
      return 400;
    default:
      return 500;
  }
}

// ── GET /v2/pos/bootstrap?gameId= ───────────────────────────────────────────
export const posBootstrap = async (req: FastifyRequest, res: FastifyReply) => {
  if (!ensureOrdersModule(req, res)) return;
  const groupId = req.workspace.groupId;
  const { gameId } = req.query as { gameId?: string };
  const payload = await getCatalogPayload(groupId, gameId);
  return res.send(payload);
};

// ── GET /v2/products?since=&gameId= (cheap version check + delta) ────────────
export const getProductsVersion = async (req: FastifyRequest, res: FastifyReply) => {
  if (!ensureOrdersModule(req, res)) return;
  const groupId = req.workspace.groupId;
  const { since, gameId } = req.query as { since?: string; gameId?: string };
  const config = await resolvePosConfig(groupId, gameId);
  const sinceVersion = since ? parseInt(since, 10) : undefined;
  if (
    typeof sinceVersion === "number" &&
    !Number.isNaN(sinceVersion) &&
    sinceVersion >= config.catalogVersion
  ) {
    return res.send({ catalogVersion: config.catalogVersion, upToDate: true });
  }
  const { products, categories } = await getCatalogProducts(groupId);
  return res.send({
    catalogVersion: config.catalogVersion,
    upToDate: false,
    products,
    categories,
  });
};

// The REST create body mirrors the sync create op plus gameId/placeId (a headless
// caller must say which game the order belongs to).
const restCreateOrderBodySchema = createOrderBodySchema.extend({
  gameId: z.string().min(1),
  placeId: z.string().optional(),
});

// ── POST /v2/orders ─────────────────────────────────────────────────────────
export const createOrderV2 = async (req: FastifyRequest, res: FastifyReply) => {
  if (!ensureOrdersModule(req, res)) return;
  const parsed = restCreateOrderBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  }
  const ctx: OrderContext = {
    groupId: req.workspace.groupId,
    gameId: parsed.data.gameId,
    placeId: parsed.data.placeId ?? "",
    distribution: req.workspace.currentDistribution,
  };
  const outcome = await createOrderOp(ctx, parsed.data);
  if (!outcome.success) {
    return sendError(res, statusForOpError(outcome.error), outcome.error.code, outcome.error.message);
  }
  return res.send({ order: outcome.order });
};

// ── GET /v2/orders?status=&queueId=&gameId=&cursor=&limit= ───────────────────
export const listOrdersV2 = async (req: FastifyRequest, res: FastifyReply) => {
  if (!ensureOrdersModule(req, res)) return;
  const groupId = req.workspace.groupId;
  const { status, queueId, gameId, cursor, limit } = req.query as Record<
    string,
    string | undefined
  >;

  const filter: Filter<Order> = { groupId };
  if (gameId) filter.gameId = gameId;
  if (queueId) filter.queueId = queueId;
  if (status) filter.status = status as OrderStatus;
  const cursorId = safeObjectId(cursor);
  if (cursorId) filter._id = { $lt: cursorId };

  const lim = Math.min(Math.max(parseInt(limit ?? "50", 10) || 50, 1), 100);
  const rows = await readminCollections.orders
    .find(filter)
    .sort({ _id: -1 })
    .limit(lim + 1)
    .toArray();

  const hasMore = rows.length > lim;
  const page = hasMore ? rows.slice(0, lim) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? last._id.toString() : null;
  return res.send({ orders: page, nextCursor });
};

// ── POST /v2/orders/:id/transition ──────────────────────────────────────────
export const transitionOrderV2 = async (req: FastifyRequest, res: FastifyReply) => {
  if (!ensureOrdersModule(req, res)) return;
  const parsed = transitionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body");
  }
  const { id } = req.params as { id: string };
  const ctx: OrderContext = {
    groupId: req.workspace.groupId,
    gameId: "",
    placeId: "",
    distribution: req.workspace.currentDistribution,
  };
  const outcome = await transitionOrderOp(ctx, {
    orderId: id,
    action: parsed.data.action,
    actorId: parsed.data.actorId,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (!outcome.success) {
    return sendError(res, statusForOpError(outcome.error), outcome.error.code, outcome.error.message);
  }
  return res.send({ order: outcome.order });
};
