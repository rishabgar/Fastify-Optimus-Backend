import fastifyJwt from "@fastify/jwt";
import shopTypeModel from "./shop-type.model.js";
import shopTypeRoutes from "./shop-type.routes.js";
import { createShopTypeService } from "./shop-type.service.js";

export { shopTypeModel } from "./shop-type.model.js";
export { createShopTypeService } from "./shop-type.service.js";

export default async function shopTypeModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("shopTypeModel", shopTypeModel);

  const service = options.shopTypeService ?? createShopTypeService();
  await app.register(shopTypeRoutes, { service });
}
