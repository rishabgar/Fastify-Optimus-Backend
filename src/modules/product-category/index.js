import fastifyJwt from "@fastify/jwt";
import productCategoryModel from "./product-category.model.js";
import productCategoryRoutes from "./product-category.routes.js";
import { createProductCategoryService } from "./product-category.service.js";

export { productCategoryModel } from "./product-category.model.js";

export default async function productCategoryModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("productCategoryModel", productCategoryModel);

  const service =
    options.productCategoryService ?? createProductCategoryService();
  await app.register(productCategoryRoutes, {
    service,
    isDevelopment: options.isDevelopment,
  });
}
