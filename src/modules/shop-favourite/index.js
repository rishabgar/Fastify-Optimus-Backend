import fastifyJwt from "@fastify/jwt";
import shopFavouriteModel from "./shop-favourite.model.js";
import shopFavouriteRoutes from "./shop-favourite.routes.js";
import { createShopFavouriteService } from "./shop-favourite.service.js";

export { shopFavouriteModel } from "./shop-favourite.model.js";
export { createShopFavouriteService } from "./shop-favourite.service.js";

export default async function shopFavouriteModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("shopFavouriteModel", shopFavouriteModel);

  const service =
    options.shopFavouriteService ?? createShopFavouriteService();
  await app.register(shopFavouriteRoutes, { service });
}
