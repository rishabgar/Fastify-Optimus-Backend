import { requireAdmin } from "../../shared/http/auth-guards.js";
import { HttpError } from "../../shared/http/http-error.js";
import { createProductController } from "./product.controller.js";
import {
  createProductSchema,
  nearbyProductParamsSchema,
  nearbyProductQuerySchema,
  productDetailParamsSchema,
  productListQuerySchema,
  shopCategoryProductParamsSchema,
  shopProductListQuerySchema,
  shopProductParamsSchema,
  shopProductSummaryParamsSchema,
  shopProductSummaryQuerySchema,
} from "./product.schema.js";

async function rejectControlledFields(request) {
  if (
    request.body?.variants?.some((variant) => Object.hasOwn(variant, "sku"))
  ) {
    throw new HttpError(400, "sku must not be provided");
  }
}

export default async function productRoutes(app, { service }) {
  const controller = createProductController(service);

  app.post(
    "/admin/create",
    {
      onRequest: requireAdmin,
      preValidation: rejectControlledFields,
      schema: { body: createProductSchema },
    },
    controller.create,
  );

  app.get(
    "/details/:product_id",
    {
      schema: { params: productDetailParamsSchema },
    },
    controller.getDetail,
  );

  app.get(
    "/summary/:shop_id",
    {
      schema: {
        params: shopProductSummaryParamsSchema,
        querystring: shopProductSummaryQuerySchema,
      },
    },
    controller.listSummaryByShop,
  );

  app.get(
    "/summary/:shop_id/:product_category_id",
    {
      schema: {
        params: shopCategoryProductParamsSchema,
        querystring: shopProductSummaryQuerySchema,
      },
    },
    controller.listSummaryByShopAndCategory,
  );

  app.get(
    "/:shop_type_id/:latitude/:longitude",
    {
      schema: {
        params: nearbyProductParamsSchema,
        querystring: nearbyProductQuerySchema,
      },
    },
    controller.listNearby,
  );

  app.get(
    "/:shop_id/:product_category_id",
    {
      schema: {
        params: shopCategoryProductParamsSchema,
        querystring: productListQuerySchema,
      },
    },
    controller.listByShopAndCategory,
  );

  app.get(
    "/:shop_id",
    {
      schema: {
        params: shopProductParamsSchema,
        querystring: shopProductListQuerySchema,
      },
    },
    controller.listByShop,
  );
}
