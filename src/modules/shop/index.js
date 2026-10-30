import fastifyJwt from "@fastify/jwt";
import shopModel from "./shop.model.js";
import shopRoutes from "./shop.routes.js";
import { createShopService } from "./shop.service.js";

export { shopModel } from "./shop.model.js";
export { createShopService } from "./shop.service.js";

export default async function shopModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("shopModel", shopModel);

  const service = options.shopService ?? createShopService();
  await app.register(shopRoutes, {
    service,
    isProduction: options.isProduction,
  });
}
