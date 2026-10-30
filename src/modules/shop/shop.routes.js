import { requireSeller } from "../../shared/http/auth-guards.js";
import { createShopController } from "./shop.controller.js";
import {
  createShopSchema,
  customerShopListSchema,
  developmentUpdateSchema,
  nearbyShopListSchema,
  sellerShopListSchema,
  shopParamsSchema,
  updateShopSchema,
} from "./shop.schema.js";

export default async function shopRoutes(app, { service, isProduction }) {
  const controller = createShopController(service);
  const sellerOnly = { onRequest: requireSeller };

  if (!isProduction) {
    app.post(
      "/seller/shops",
      { ...sellerOnly, schema: { body: createShopSchema } },
      controller.create,
    );
    app.get(
      "/seller/shops",
      { ...sellerOnly, schema: { querystring: sellerShopListSchema } },
      controller.listSeller,
    );
    app.delete(
      "/seller/shops/:shop_id",
      { ...sellerOnly, schema: { params: shopParamsSchema } },
      controller.remove,
    );
    app.get(
      "/shops",
      { schema: { querystring: customerShopListSchema } },
      controller.listCustomer,
    );
    app.patch(
      "/dev/shops/:shop_id",
      {
        schema: {
          params: shopParamsSchema,
          body: developmentUpdateSchema,
        },
      },
      controller.updateForDevelopment,
    );
  } else {
    app.get("/shops", (request, reply) => reply.callNotFound());
  }
  app.patch(
    "/shop_id/:shop_id",
    {
      ...sellerOnly,
      schema: { params: shopParamsSchema, body: updateShopSchema },
    },
    controller.update,
  );
  app.get(
    "/nearby",
    { schema: { querystring: nearbyShopListSchema } },
    controller.listNearby,
  );
  app.get(
    "/:shop_id",
    { ...sellerOnly, schema: { params: shopParamsSchema } },
    controller.getDetail,
  );
}
