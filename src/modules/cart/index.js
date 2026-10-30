import fastifyJwt from "@fastify/jwt";
import cartModel from "./cart.model.js";
import cartRoutes from "./cart.routes.js";
import { createCartService } from "./cart.service.js";

export { cartModel } from "./cart.model.js";

export default async function cartModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("cartModel", cartModel);

  const cartService = options.cartService ?? createCartService();
  await app.register(cartRoutes, { cartService });
}
