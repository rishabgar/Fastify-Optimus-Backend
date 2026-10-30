import { randomUUID } from "node:crypto";
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

const MAX_SKU_GENERATION_ATTEMPTS = 3;

function fieldError(statusCode, message, field) {
  return new HttpError(statusCode, message, { field });
}

function ensureUnique(values, field, message) {
  if (new Set(values).size !== values.length) {
    throw fieldError(400, message, field);
  }
}

function defaultGenerateSellerSku() {
  return `SP-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

function prepareCommonVariants(variants, generateSellerSku) {
  return variants.map((variant) => ({
    ...variant,
    seller_sku: generateSellerSku(),
  }));
}

function prepareIndividualVariants(variants, generateSellerSku) {
  return variants.map((variant) => ({
    ...variant,
    seller_sku: generateSellerSku(),
    ...NORMALIZERS[variant.quantity_unit](variant.quantity_value),
  }));
}

function isSellerSkuConflict(error) {
  return error?.code === 11000 && error.keyPattern?.["variants.seller_sku"];
}

function isCommonProductConflict(error) {
  return (
    error?.code === 11000 &&
    error.keyPattern?.shop_id &&
    error.keyPattern?.product_id
  );
}

export function createSellerProductService({
  repository = sellerProductRepository,
  generateSellerSku = defaultGenerateSellerSku,
} = {}) {
  async function createWithUniqueSkus(input, prepareVariants) {
    for (
      let attempt = 1;
      attempt <= MAX_SKU_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await repository.createSellerProduct({
          ...input,
          variants: prepareVariants(input.variants, generateSellerSku),
        });
      } catch (error) {
        if (!isSellerSkuConflict(error)) throw error;
        if (attempt === MAX_SKU_GENERATION_ATTEMPTS) {
          throw new HttpError(409, "Could not generate a unique seller SKU");
        }
      }
    }
  }

  async function createCommon(input, sellerId) {
    const [masterProduct, duplicate] = await Promise.all([
      repository.findAvailableMasterProduct(input.product_id),
      repository.findCommonByShopAndProduct(input.shop_id, input.product_id),
    ]);
    if (!masterProduct) {
      throw fieldError(400, "Active master product not found", "product_id");
    }
    if (duplicate) {
      throw fieldError(
        409,
        "This shop has already added the common product",
        "product_id",
      );
    }

    const selectedVariantIds = input.variants.map(
      (variant) => variant.product_variant_id,
    );
    ensureUnique(
      selectedVariantIds,
      "variants.product_variant_id",
      "Product variants must be unique",
    );
    const activeVariantIds = new Set(
      masterProduct.variants
        .filter((variant) => variant.is_active)
        .map((variant) => variant._id.toString()),
    );
    if (selectedVariantIds.some((id) => !activeVariantIds.has(id))) {
      throw fieldError(
        400,
        "One or more product variants are invalid or inactive",
        "variants.product_variant_id",
      );
    }
    return createWithUniqueSkus(
      { ...input, seller_id: sellerId },
      prepareCommonVariants,
    );
  }

  async function createIndividual(input, sellerId, shop) {
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
    return createWithUniqueSkus(
      { ...input, seller_id: sellerId },
      prepareIndividualVariants,
    );
  }

  return {
    async createSellerProduct(input, sellerId) {
      const shop = await repository.findOwnedShop(input.shop_id, sellerId);
      if (!shop) {
        throw fieldError(404, "Shop not found", "shop_id");
      }
      if (!shop.is_active) {
        throw fieldError(409, "Shop is inactive", "shop_id");
      }

      try {
        return input.product_type === "common"
          ? await createCommon(input, sellerId)
          : await createIndividual(input, sellerId, shop);
      } catch (error) {
        if (isCommonProductConflict(error)) {
          throw fieldError(
            409,
            "This shop has already added the common product",
            "product_id",
          );
        }
        throw error;
      }
    },
  };
}
