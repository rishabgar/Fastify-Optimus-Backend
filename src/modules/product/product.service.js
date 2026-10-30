import { randomUUID } from "node:crypto";
import { HttpError } from "../../shared/http/http-error.js";
import { productRepository } from "./product.repository.js";

function notFound(message, field) {
  return new HttpError(404, message, { field });
}

function validationError(message, field) {
  return new HttpError(400, message, { field });
}

function duplicateSkuError() {
  return new HttpError(409, "Could not generate a unique product SKU");
}

function defaultGenerateSku() {
  return `MP-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuantity(value, unit) {
  if (unit === "mg") return { normalized_value: value / 1000, normalized_unit: "g" };
  if (unit === "kg") return { normalized_value: value * 1000, normalized_unit: "g" };
  if (unit === "ltr") return { normalized_value: value * 1000, normalized_unit: "ml" };
  return { normalized_value: value, normalized_unit: unit };
}

function normalizeImages(images = []) {
  if (images.filter((image) => image.is_main === true).length > 1) {
    throw validationError("Only one product image may be the main image", "product_images");
  }
  return images.map((image) => ({
    ...image,
    url: image.url.trim(),
    ...(image.alt === undefined ? {} : { alt: image.alt.trim() }),
  }));
}

function normalizeVariants(variants, generateSku) {
  if (variants.filter((variant) => variant.is_default === true).length !== 1) {
    throw validationError("Exactly one variant must be the default", "variants.is_default");
  }

  const generatedSkus = new Set();
  return variants.map((variant) => {
    const sku = generateSku();
    if (generatedSkus.has(sku)) throw duplicateSkuError();
    generatedSkus.add(sku);
    return {
      ...variant,
      label: variant.label.trim(),
      sku,
      ...normalizeQuantity(variant.quantity_value, variant.quantity_unit),
    };
  });
}

export function createProductService({
  repository = productRepository,
  generateSku = defaultGenerateSku,
} = {}) {
  return {
    async create(input) {
      const productImages = normalizeImages(input.product_images);
      const variants = normalizeVariants(input.variants, generateSku);

      if (!(await repository.findAvailableCategory(input.product_category_id))) {
        throw validationError("Product category is unavailable", "product_category_id");
      }
      try {
        const product = await repository.create({
          product_name: input.product_name.trim(),
          brand_name: input.brand_name.trim(),
          ...(input.product_description === undefined
            ? {}
            : { product_description: input.product_description.trim() }),
          product_category_id: input.product_category_id,
          product_images: productImages,
          variants,
        });
        return { product_id: product._id };
      } catch (error) {
        if (error?.code === 11000) throw duplicateSkuError();
        throw error;
      }
    },

    async listByShopAndCategory(shopId, categoryId, query) {
      const [shop, category] = await Promise.all([
        repository.findAvailableShop(shopId),
        repository.findAvailableCategory(categoryId),
      ]);
      if (!shop) throw notFound("Shop not found", "shop_id");
      if (!category) {
        throw notFound("Product category not found", "product_category_id");
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const result = await repository.listByShopAndCategory({
        shopId,
        categoryId,
        skip: (page - 1) * limit,
        limit,
      });
      return result.items;
    },

    async listByShop(shopId, query) {
      if (!(await repository.findAvailableShop(shopId))) {
        throw notFound("Shop not found", "shop_id");
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const result = await repository.listByShop({
        shopId,
        skip: (page - 1) * limit,
        limit,
        ...(query.search
          ? { search: escapeRegExp(query.search.trim()) }
          : {}),
        ...(query.product_type
          ? { productType: query.product_type }
          : {}),
        ...(query.in_stock === undefined
          ? {}
          : { inStock: query.in_stock }),
        sortBy: query.sort_by ?? "created_at",
        sortDirection: query.sort_direction ?? "desc",
      });
      return result.items;
    },

    async listNearby(params, query) {
      if (!(await repository.findAvailableShopType(params.shop_type_id))) {
        throw notFound("Shop type not found", "shop_type_id");
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const maxDistance =
        query.distance === undefined
          ? 1000
          : query.distance_unit === "m"
            ? query.distance
            : query.distance * 1000;
      if (maxDistance > 100000) {
        throw validationError(
          "Distance must not exceed 100 km or 100000 m",
          "distance",
        );
      }
      return repository.listNearby({
        latitude: params.latitude,
        longitude: params.longitude,
        shopTypeId: params.shop_type_id,
        maxDistance,
        ...(query.product_category_id
          ? { categoryId: query.product_category_id }
          : {}),
        ...(query.product_type
          ? { productType: query.product_type }
          : {}),
        ...(query.in_stock === undefined
          ? {}
          : { inStock: query.in_stock }),
        sortBy: query.sort_by ?? "distance",
        sortOrder: query.sort_order ?? "asc",
        skip: (page - 1) * limit,
        limit,
      });
    },

    async getDetail(productId) {
      const product = await repository.getPublicDetail(productId);
      if (!product) throw notFound("Product not found", "product_id");
      return product;
    },
  };
}
