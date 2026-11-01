import fastifyJwt from "@fastify/jwt";
import orderModel from "./order.model.js";
import orderRoutes from "./order.routes.js";
import { createOrderService } from "./order.service.js";

export { orderModel } from "./order.model.js";
export { createOrderService } from "./order.service.js";

export default async function orderModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");
  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("orderModel", orderModel);
  await app.register(orderRoutes, { service: options.orderService ?? createOrderService({ rewardService: options.rewardService }) });
}
