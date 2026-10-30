import { requireAdmin } from "../../shared/http/auth-guards.js";
import { createProductCategoryController } from "./product-category.controller.js";
import {
  adminCategoryListSchema,
  categoryParamsSchema,
  createCategorySchema,
  productCategoryParamsSchema,
  publicCategoryListSchema,
  shopCategoryParamsSchema,
  shopTypeCategoryParamsSchema,
  updateCategorySchema,
} from "./product-category.schema.js";

export default async function productCategoryRoutes(
  app,
  { service, isDevelopment },
) {
  const controller = createProductCategoryController(service);
  const adminOnly = { onRequest: requireAdmin };

  app.post(
    "/create",
    {
      ...adminOnly,
      schema: { body: createCategorySchema },
    },
    controller.create,
  );

  app.patch(
    "/update/:product_category_id",
    {
      ...adminOnly,
      schema: {
        params: productCategoryParamsSchema,
        body: updateCategorySchema,
      },
    },
    controller.update,
  );

  app.delete(
    "/delete/:product_category_id",
    {
      ...adminOnly,
      schema: { params: productCategoryParamsSchema },
    },
    controller.remove,
  );

  app.get(
    "/shop_id/:shop_id",
    { schema: { params: shopCategoryParamsSchema } },
    controller.listByShop,
  );

  app.get(
    "/shop_type_id/:shop_type_id",
    { schema: { params: shopTypeCategoryParamsSchema } },
    controller.listByShopType,
  );

  if (isDevelopment) {
    app.get(
      "/admin/product-categories",
      {
        ...adminOnly,
        schema: { querystring: adminCategoryListSchema },
      },
      controller.listAdmin,
    );
    app.get(
      "/admin/product-categories/:category_id",
      {
        ...adminOnly,
        schema: { params: categoryParamsSchema },
      },
      controller.getById,
    );
    app.patch(
      "/admin/product-categories/:category_id/restore",
      {
        ...adminOnly,
        schema: { params: categoryParamsSchema },
      },
      controller.restore,
    );
    app.get(
      "/product-categories",
      { schema: { querystring: publicCategoryListSchema } },
      controller.listPublic,
    );
  }
}
