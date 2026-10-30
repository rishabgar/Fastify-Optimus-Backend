import { requireAdmin } from "../../shared/http/auth-guards.js";
import { createShopTypeController } from "./shop-type.controller.js";
import {
  adminShopTypeListSchema,
  createShopTypeSchema,
  publicShopTypeListSchema,
  shopTypeDetailQuerySchema,
  shopTypeParamsSchema,
  updateShopTypeSchema,
} from "./shop-type.schema.js";

export default async function shopTypeRoutes(app, { service }) {
  const controller = createShopTypeController(service);
  const adminOnly = { onRequest: requireAdmin };

  app.post(
    "/admin/shop-types",
    { ...adminOnly, schema: { body: createShopTypeSchema } },
    controller.create,
  );
  app.get(
    "/admin/shop-types",
    { ...adminOnly, schema: { querystring: adminShopTypeListSchema } },
    controller.listAdmin,
  );
  app.get(
    "/admin/shop-types/:shop_type_id",
    {
      ...adminOnly,
      schema: {
        params: shopTypeParamsSchema,
        querystring: shopTypeDetailQuerySchema,
      },
    },
    controller.getById,
  );
  app.patch(
    "/admin/shop-types/:shop_type_id",
    {
      ...adminOnly,
      schema: {
        params: shopTypeParamsSchema,
        body: updateShopTypeSchema,
      },
    },
    controller.update,
  );
  app.delete(
    "/admin/shop-types/:shop_type_id",
    { ...adminOnly, schema: { params: shopTypeParamsSchema } },
    controller.remove,
  );
  app.patch(
    "/admin/shop-types/:shop_type_id/restore",
    { ...adminOnly, schema: { params: shopTypeParamsSchema } },
    controller.restore,
  );
  app.get(
    "/shop-types",
    { schema: { querystring: publicShopTypeListSchema } },
    controller.listPublic,
  );
}
