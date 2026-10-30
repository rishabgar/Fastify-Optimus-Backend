import fastifyJwt from "@fastify/jwt";
import { sellerProductModel } from "./seller-product.model.js";
import sellerProductRoutes from "./seller-product.routes.js";
import { createSellerProductService } from "./seller-product.service.js";
import { createDeleteSellerProductService } from "./delete-seller-product.service.js";
import { createUpdateSellerProductService } from "./update-seller-product.service.js";

export { sellerProductModel } from "./seller-product.model.js";
export { createDeleteSellerProductService } from "./delete-seller-product.service.js";
export { createUpdateSellerProductService } from "./update-seller-product.service.js";

export default async function sellerProductModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("sellerProductModel", sellerProductModel);

  const service =
    options.sellerProductService ?? {
      ...createSellerProductService(),
      ...createDeleteSellerProductService(),
      ...createUpdateSellerProductService(),
    };
  await app.register(sellerProductRoutes, { service });
}
