import { FastifyInstance } from "fastify";
import {
  posBootstrap,
  getProductsVersion,
  createOrderV2,
  listOrdersV2,
  transitionOrderV2,
} from "~/fastifyAPI/apiHandlers/ordersV2";

// Orders v2 standalone REST surface for programmatic integrations and games not
// running the loader. Same `loader-id` auth (workspaceFromLoaderId) as the rest
// of the API; each handler additionally checks the orders module flag. These
// routes and the sync `orders` block delegate to the SAME handler layer
// (~/services/orders), so behaviour can't drift between transports.
export const ordersV2Router = async (fastify: FastifyInstance) => {
  fastify.get("/pos/bootstrap", { config: { workspaceFromLoaderId: true } }, posBootstrap);
  fastify.get("/products", { config: { workspaceFromLoaderId: true } }, getProductsVersion);
  fastify.post("/orders", { config: { workspaceFromLoaderId: true } }, createOrderV2);
  fastify.get("/orders", { config: { workspaceFromLoaderId: true } }, listOrdersV2);
  fastify.post("/orders/:id/transition", { config: { workspaceFromLoaderId: true } }, transitionOrderV2);
};
