import { HttpError } from "../../shared/http/http-error.js";
import { sellerProductRepository } from "./seller-product.repository.js";

const NORMALIZERS = {
  mg: (value) => ({ normalized_value: value / 1000, normalized_unit: "g" }),
  g: (value) => ({ normalized_value: value, normalized_unit: "g" }),
  kg: (value) => ({ normalized_value: value * 1000, normalized_unit: "g" }),
  ml: (value) => ({ normalized_value: value, normalized_unit: "ml" }),
  ltr: (value) => ({ normalized_value: value * 1000, normalized_unit: "ml" }),
  pcs: (value) => ({ normalized_value: value, normalized_unit: "pcs" }),
};

const COMMON_FIELDS = new Set([
  "product_name_override",
  "product_description_override",
  "product_images_override",
  "variants",
  "is_active",
]);

const INDIVIDUAL_FIELDS = new Set([
  "product_name",
  "brand_name",
  "product_description",
  "product_category_id",
  "product_images",
  "variants",
  "is_active",
]);

const COMMON_VARIANT_FIELDS = new Set([
  "price",
  "mrp",
  "discount_percent",
  "product_quantity",
  "available_quantity",
  "is_active",
]);

const INDIVIDUAL_VARIANT_FIELDS = new Set([
  ...COMMON_VARIANT_FIELDS,
  "label",
  "quantity_value",
  "quantity_unit",
]);

function fieldError(statusCode, message, field) {
  return new HttpError(statusCode, message, { field });
}

function id(value) {
  return value?.toString();
}

function assertAllowedFields(input, allowedFields, productType) {
  const invalidField = Object.keys(input).find(
    (field) => field !== "product_id" && !allowedFields.has(field),
  );
  if (invalidField) {
    throw fieldError(
      400,
      `${invalidField} cannot be updated for a ${productType} product`,
      invalidField,
    );
  }
}

function addTopLevelUpdates(input, allowedFields, set, unset) {
  for (const field of allowedFields) {
    if (field === "variants" || input[field] === undefined) continue;
    if (input[field] === null) {
      unset[field] = 1;
    } else if (typeof input[field] === "string") {
      set[field] = input[field].trim();
    } else {
      set[field] = input[field];
    }
  }
}

function assertUniqueVariantIds(variants) {
  const ids = variants.map((variant) => variant.product_variant_id);
  if (new Set(ids).size !== ids.length) {
    throw fieldError(
      400,
      "Product variants must be unique",
      "variants.product_variant_id",
    );
  }
}

function addVariantUpdates({
  inputVariants,
  existingVariants,
  allowedFields,
  commonProduct,
  activeMasterVariantIds,
  set,
  arrayFilters,
}) {
  if (!inputVariants) return;
  assertUniqueVariantIds(inputVariants);

  const existingById = new Map(
    existingVariants.map((variant) => [
      id(commonProduct ? variant.product_variant_id : variant._id),
      variant,
    ]),
  );

  inputVariants.forEach((inputVariant, index) => {
    const variantId = inputVariant.product_variant_id;
    const existingVariant = existingById.get(variantId);
    if (!existingVariant || (commonProduct && !activeMasterVariantIds.has(variantId))) {
      throw fieldError(
        400,
        "One or more product variants are invalid or inactive",
        "variants.product_variant_id",
      );
    }

    const invalidField = Object.keys(inputVariant).find(
      (field) => field !== "product_variant_id" && !allowedFields.has(field),
    );
    if (invalidField) {
      throw fieldError(
        400,
        `${invalidField} cannot be updated for this product variant`,
        `variants.${invalidField}`,
      );
    }

    if (
      inputVariant.product_quantity !== undefined ||
      inputVariant.available_quantity !== undefined
    ) {
      const productQuantity =
        inputVariant.product_quantity ?? existingVariant.product_quantity;
      const availableQuantity =
        inputVariant.available_quantity ?? existingVariant.available_quantity;
      const reservedQuantity = existingVariant.reserved_quantity ?? 0;
      if (availableQuantity + reservedQuantity > productQuantity) {
        throw fieldError(
          400,
          "Available and reserved quantity cannot exceed product quantity",
          "variants.available_quantity",
        );
      }
    }

    const identifier = `variant${index}`;
    arrayFilters.push({
      [`${identifier}.${commonProduct ? "product_variant_id" : "_id"}`]:
        variantId,
    });
    for (const field of allowedFields) {
      if (inputVariant[field] === undefined) continue;
      set[`variants.$[${identifier}].${field}`] =
        typeof inputVariant[field] === "string"
          ? inputVariant[field].trim()
          : inputVariant[field];
    }

    if (
      !commonProduct &&
      (inputVariant.quantity_value !== undefined ||
        inputVariant.quantity_unit !== undefined)
    ) {
      const quantityValue =
        inputVariant.quantity_value ?? existingVariant.quantity_value;
      const quantityUnit =
        inputVariant.quantity_unit ?? existingVariant.quantity_unit;
      const normalized = NORMALIZERS[quantityUnit](quantityValue);
      set[`variants.$[${identifier}].normalized_value`] =
        normalized.normalized_value;
      set[`variants.$[${identifier}].normalized_unit`] =
        normalized.normalized_unit;
    }
  });
}

export function createUpdateSellerProductService({
  repository = sellerProductRepository,
} = {}) {
  return {
    async updateSellerProduct(input, sellerId) {
      const product = await repository.findOwnedProduct(
        input.product_id,
        sellerId,
      );
      if (!product) {
        throw fieldError(404, "Seller product not found", "product_id");
      }

      const shop = await repository.findOwnedShop(product.shop_id, sellerId);
      if (!shop) throw fieldError(404, "Shop not found", "shop_id");

      const commonProduct = product.product_type === "common";
      const allowedFields = commonProduct ? COMMON_FIELDS : INDIVIDUAL_FIELDS;
      assertAllowedFields(input, allowedFields, product.product_type);

      const set = {};
      const unset = {};
      const arrayFilters = [];
      addTopLevelUpdates(input, allowedFields, set, unset);

      let activeMasterVariantIds = new Set();
      if (commonProduct && input.variants) {
        const masterProduct = await repository.findAvailableMasterProduct(
          product.product_id,
        );
        if (!masterProduct) {
          throw fieldError(409, "Master product is unavailable", "product_id");
        }
        activeMasterVariantIds = new Set(
          masterProduct.variants
            .filter((variant) => variant.is_active)
            .map((variant) => id(variant._id)),
        );
      }

      if (!commonProduct && input.product_category_id !== undefined) {
        const category = await repository.findAvailableCategory(
          input.product_category_id,
          shop.shop_type_id,
        );
        if (!category) {
          throw fieldError(
            400,
            "Active product category is not available for this shop type",
            "product_category_id",
          );
        }
      }

      addVariantUpdates({
        inputVariants: input.variants,
        existingVariants: product.variants,
        allowedFields: commonProduct
          ? COMMON_VARIANT_FIELDS
          : INDIVIDUAL_VARIANT_FIELDS,
        commonProduct,
        activeMasterVariantIds,
        set,
        arrayFilters,
      });

      const updated = await repository.updateOwnedProduct(
        input.product_id,
        sellerId,
        { set, unset, arrayFilters },
      );
      if (!updated) {
        throw fieldError(404, "Seller product not found", "product_id");
      }
      return updated;
    },
  };
}
