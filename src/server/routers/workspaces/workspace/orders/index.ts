import { z } from "zod";
import { Filter } from "mongodb";
import { router } from "~/server/trpc";
import { readminCollections } from "~/services/mongo.service";
import { Order, OrderStatus } from "~/services/NewMongoTypes/Order.type";
import StringToObjectID from "~/utils/StringToObjectID";
import BetterRobloxSearch from "~/services/roblox.service";
import { transitionOrderOp } from "~/services/orders/orders.service";
import { orderActionSchema } from "~/services/orders/schemas";
import { ordersProcedure, assertOrdersPermission } from "./_helpers";
import { workspaceProductsRouter } from "./products";
import { workspacePosRouter } from "./pos";
import { workspaceDevicesRouter } from "./devices";

const statusEnum = z.enum([
  "submitted",
  "claimed",
  "released",
  "completed",
  "cancelled",
  "awaiting_customer",
  "handed_to_customer",
]);
const sourceEnum = z.enum(["register", "kiosk", "drive_thru", "api"]);

export const workspaceOrderRouter = router({
  products: workspaceProductsRouter,
  pos: workspacePosRouter,
  devices: workspaceDevicesRouter,

  // ── list (orders feed with the full filter set) ─────────────────────────────
  list: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string().optional(),
        status: statusEnum.optional(),
        source: sourceEnum.optional(),
        queueId: z.string().optional(),
        distributionNum: z.number().nullable().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        nameSearch: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const { workspace } = ctx;

      const filter: Filter<Order> = {
        groupId: input.groupId,
        distribution:
          input.distributionNum ?? workspace.currentDistribution,
      };
      if (input.gameId) filter.gameId = input.gameId;
      if (input.status) filter.status = input.status;
      if (input.source) filter.source = input.source;
      if (input.queueId) filter.queueId = input.queueId;
      if (input.dateFrom || input.dateTo) {
        filter.created = {};
        if (input.dateFrom) (filter.created as any).$gte = new Date(input.dateFrom);
        if (input.dateTo) (filter.created as any).$lte = new Date(input.dateTo);
      }
      if (input.nameSearch) {
        const userIds = (await BetterRobloxSearch(input.nameSearch, workspace.groupId)).map((a) =>
          a.toString(),
        );
        filter.$or = [
          { customerId: { $in: userIds } },
          { cashierId: { $in: userIds } },
          { preparedBy: { $in: userIds } },
        ];
      }

      const limit = input.pageSize || 15;
      const actualPage = input.page || 0;
      const [orders, count] = await Promise.all([
        readminCollections.orders
          .find(filter, { skip: limit * actualPage, limit, sort: { created: -1 } })
          .toArray(),
        readminCollections.orders.countDocuments(filter),
      ]);

      return {
        response: orders,
        pagination: {
          page: actualPage,
          pageSize: limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    }),

  getById: ordersProcedure
    .input(z.object({ groupId: z.string(), orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      return readminCollections.orders.findOne({
        _id: StringToObjectID(input.orderId),
        groupId: input.groupId,
      });
    }),

  // Stat cards — counts + average handling time for a game/distribution.
  getCounts: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string().optional(),
        distribution: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const distribution = input.distribution ?? ctx.workspace.currentDistribution;
      const base: Filter<Order> = { groupId: input.groupId, distribution };
      if (input.gameId) base.gameId = input.gameId;

      const inStatus = (statuses: OrderStatus[]): Filter<Order> => ({
        ...base,
        status: { $in: statuses },
      });

      const [totalOrders, beganOrders, cancelledOrders, finishedOrders, durationAgg] =
        await Promise.all([
          readminCollections.orders.countDocuments(base),
          readminCollections.orders.countDocuments(
            inStatus(["submitted", "claimed", "released"]),
          ),
          readminCollections.orders.countDocuments(inStatus(["cancelled"])),
          readminCollections.orders.countDocuments(
            inStatus(["completed", "awaiting_customer", "handed_to_customer"]),
          ),
          readminCollections.orders
            .aggregate([
              {
                $match: {
                  ...base,
                  status: { $in: ["completed", "awaiting_customer", "handed_to_customer"] },
                },
              },
              {
                $group: {
                  _id: null,
                  avg_time: {
                    $avg: {
                      $subtract: [
                        { $ifNull: ["$lastModified", "$created"] },
                        { $ifNull: ["$created", 0] },
                      ],
                    },
                  },
                },
              },
            ])
            .toArray(),
        ]);

      return {
        totalOrders,
        beganOrders,
        cancelledOrders,
        finishedOrders,
        averageDuration: durationAgg[0]?.avg_time || 0,
      };
    }),

  // Web staff actions — advance/cancel/correct an order. Status-preconditioned
  // server-side (409 on race), gated on orders.manage.
  transition: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        orderId: z.string(),
        action: orderActionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "manage");
      const outcome = await transitionOrderOp(
        {
          groupId: input.groupId,
          gameId: "",
          placeId: "",
          distribution: ctx.workspace.currentDistribution,
        },
        {
          orderId: input.orderId,
          action: input.action,
          actorId: ctx.user.dbUser.robloxId,
        },
      );
      return outcome;
    }),

  // ── stats: per-user summary ─────────────────────────────────────────────────
  getUserSummary: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string().optional(),
        distribution: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const distribution = input.distribution ?? ctx.workspace.currentDistribution;
      const match: Filter<Order> = { groupId: input.groupId, distribution };
      if (input.gameId) match.gameId = input.gameId;

      // Count log events per (user, event) and avg claim→complete per preparer.
      const [eventCounts, prepDurations] = await Promise.all([
        readminCollections.orders
          .aggregate([
            { $match: match },
            { $unwind: "$log" },
            { $group: { _id: { userId: "$log.userId", event: "$log.event" }, count: { $sum: 1 } } },
          ])
          .toArray(),
        readminCollections.orders
          .aggregate([
            {
              $match: {
                ...match,
                claimed: { $exists: true },
                completed: { $exists: true },
              },
            },
            {
              $project: {
                preparedBy: 1,
                dur: { $subtract: ["$completed", "$claimed"] },
              },
            },
            {
              $group: {
                _id: "$preparedBy",
                avgClaimToComplete: { $avg: "$dur" },
                count: { $sum: 1 },
              },
            },
          ])
          .toArray(),
      ]);

      const byUser: Record<
        string,
        { userId: string; created: number; claimed: number; completed: number; avgClaimToComplete: number }
      > = {};
      const ensure = (userId: string) =>
        (byUser[userId] ??= {
          userId,
          created: 0,
          claimed: 0,
          completed: 0,
          avgClaimToComplete: 0,
        });
      for (const row of eventCounts as { _id: { userId: string; event: OrderStatus }; count: number }[]) {
        const u = ensure(row._id.userId);
        if (row._id.event === "submitted") u.created += row.count;
        else if (row._id.event === "claimed") u.claimed += row.count;
        else if (row._id.event === "completed" || row._id.event === "handed_to_customer")
          u.completed += row.count;
      }
      for (const row of prepDurations as { _id: string; avgClaimToComplete: number }[]) {
        if (!row._id) continue;
        ensure(row._id).avgClaimToComplete = row.avgClaimToComplete || 0;
      }

      return Object.values(byUser).sort((a, b) => b.completed - a.completed);
    }),

  // ── stats: dashboard ────────────────────────────────────────────────────────
  getDashboard: ordersProcedure
    .input(
      z.object({
        groupId: z.string(),
        gameId: z.string().optional(),
        distribution: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertOrdersPermission(ctx.department, "view");
      const distribution = input.distribution ?? ctx.workspace.currentDistribution;
      const match: Filter<Order> = { groupId: input.groupId, distribution };
      if (input.gameId) match.gameId = input.gameId;

      const [ordersOverTime, topProducts, perQueue, durationAgg, total, cancelled] =
        await Promise.all([
          readminCollections.orders
            .aggregate([
              { $match: match },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$created" } },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ])
            .toArray(),
          readminCollections.orders
            .aggregate([
              { $match: match },
              { $unwind: "$items" },
              {
                $group: {
                  _id: "$items.name",
                  quantity: { $sum: "$items.quantity" },
                },
              },
              { $sort: { quantity: -1 } },
              { $limit: 10 },
            ])
            .toArray(),
          readminCollections.orders
            .aggregate([
              { $match: match },
              { $group: { _id: "$queueId", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ])
            .toArray(),
          readminCollections.orders
            .aggregate([
              {
                $match: {
                  ...match,
                  status: { $in: ["completed", "awaiting_customer", "handed_to_customer"] },
                },
              },
              {
                $group: {
                  _id: null,
                  avg_time: {
                    $avg: {
                      $subtract: [
                        { $ifNull: ["$lastModified", "$created"] },
                        { $ifNull: ["$created", 0] },
                      ],
                    },
                  },
                },
              },
            ])
            .toArray(),
          readminCollections.orders.countDocuments(match),
          readminCollections.orders.countDocuments({ ...match, status: "cancelled" }),
        ]);

      return {
        ordersOverTime: (ordersOverTime as { _id: string; count: number }[]).map((d) => ({
          date: d._id,
          count: d.count,
        })),
        topProducts: (topProducts as { _id: string; quantity: number }[]).map((p) => ({
          name: p._id,
          quantity: p.quantity,
        })),
        perQueueVolume: (perQueue as { _id: string; count: number }[]).map((q) => ({
          queueId: q._id,
          count: q.count,
        })),
        averageDuration: durationAgg[0]?.avg_time || 0,
        total,
        cancelled,
        cancelRate: total > 0 ? cancelled / total : 0,
      };
    }),
});
