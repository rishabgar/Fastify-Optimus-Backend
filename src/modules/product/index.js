import fastifyJwt from "@fastify/jwt";
import { productModel } from "./product.model.js";
import productRoutes from "./product.routes.js";
import { createProductService } from "./product.service.js";

export { productModel } from "./product.model.js";

export default async function productModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("productModel", productModel);

  const service = options.productService ?? createProductService();
  await app.register(productRoutes, { service });
}
