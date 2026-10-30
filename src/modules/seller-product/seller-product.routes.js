import { requireSeller } from "../../shared/http/auth-guards.js";
import { HttpError } from "../../shared/http/http-error.js";
import { createSellerProductController } from "./seller-product.controller.js";
import {
  createSellerProductSchema,
  sellerProductParamsSchema,
  updateSellerProductSchema,
} from "./seller-product.schema.js";

const UPDATE_CONTROLLED_FIELDS = [
  "_id",
  "seller_id",
  "shop_id",
  "product_type",
  "master_product_id",
  "is_deleted",
  "createdAt",
  "updatedAt",
];

async function rejectControlledFields(request) {
  const body = request.body ?? {};
  if (Object.hasOwn(request.body ?? {}, "seller_id")) {
    throw new HttpError(400, "seller_id must not be provided");
  }
  if (
    request.body?.variants?.some((variant) =>
      Object.hasOwn(variant, "seller_sku"),
    )
  ) {
    throw new HttpError(400, "seller_sku must not be provided");
  }
  if (body.product_type === "individual" && Object.hasOwn(body, "product_id")) {
    throw new HttpError(
      400,
      "product_id must not be provided for an individual product",
    );
  }
  if (
    body.product_type === "individual" &&
    body.variants?.some((variant) =>
      Object.hasOwn(variant, "product_variant_id"),
    )
  ) {
    throw new HttpError(
      400,
      "product_variant_id must not be provided for an individual product",
    );
  }
}

async function rejectUpdateControlledFields(request) {
  const body = request.body ?? {};
  const controlledField = UPDATE_CONTROLLED_FIELDS.find((field) =>
    Object.hasOwn(body, field),
  );
  if (controlledField) {
    throw new HttpError(400, `${controlledField} must not be provided`);
  }
  const controlledVariantField = body.variants?.find((variant) =>
    ["seller_sku", "sku", "reserved_quantity"].some((field) =>
      Object.hasOwn(variant, field),
    ),
  );
  if (controlledVariantField) {
    const field = ["seller_sku", "sku", "reserved_quantity"].find(
      (name) => Object.hasOwn(controlledVariantField, name),
    );
    throw new HttpError(400, `${field} must not be provided`);
  }
}

export default async function sellerProductRoutes(app, { service }) {
  const controller = createSellerProductController(service);

  app.post(
    "/seller/create",
    {
      onRequest: requireSeller,
      preValidation: rejectControlledFields,
      schema: { body: createSellerProductSchema },
    },
    controller.createSellerProduct,
  );

  app.patch(
    "/",
    {
      onRequest: requireSeller,
      preValidation: rejectUpdateControlledFields,
      schema: { body: updateSellerProductSchema },
    },
    controller.updateSellerProduct,
  );

  app.delete(
    "/:product_id",
    {
      onRequest: requireSeller,
      schema: { params: sellerProductParamsSchema },
    },
    controller.deleteSellerProduct,
  );
}
