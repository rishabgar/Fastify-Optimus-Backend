const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const productImageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1, maxLength: 2048 },
    alt: { type: "string", minLength: 1, maxLength: 500 },
    is_main: { type: "boolean" },
  },
};

const productVariantSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "quantity_value", "quantity_unit"],
  properties: {
    label: { type: "string", minLength: 1, maxLength: 150 },
    quantity_value: { type: "number", minimum: 0 },
    quantity_unit: {
      type: "string",
      enum: ["mg", "g", "kg", "ml", "ltr", "pcs"],
    },
    is_default: { type: "boolean" },
    is_active: { type: "boolean" },
    sort_order: { type: "integer", minimum: 0 },
  },
};

export const createProductSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "product_name",
    "brand_name",
    "product_category_id",
    "variants",
  ],
  properties: {
    product_name: { type: "string", minLength: 1, maxLength: 250 },
    brand_name: { type: "string", minLength: 1, maxLength: 250 },
    product_description: { type: "string", minLength: 1, maxLength: 5000 },
    product_images: {
      type: "array",
      items: productImageSchema,
    },
    product_category_id: objectIdSchema,
    variants: {
      type: "array",
      minItems: 1,
      items: productVariantSchema,
    },
  },
};

export const shopCategoryProductParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_id", "product_category_id"],
  properties: {
    shop_id: objectIdSchema,
    product_category_id: objectIdSchema,
  },
};

export const shopProductParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_id"],
  properties: {
    shop_id: objectIdSchema,
  },
};

export const productListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

export const shopProductListQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    search: { type: "string", minLength: 1, maxLength: 200 },
    product_type: { type: "string", enum: ["common", "individual"] },
    in_stock: { type: "boolean" },
    sort_by: {
      type: "string",
      enum: ["created_at", "name", "price"],
      default: "created_at",
    },
    sort_direction: {
      type: "string",
      enum: ["asc", "desc"],
      default: "desc",
    },
  },
};

export const nearbyProductParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["latitude", "longitude", "shop_type_id"],
  properties: {
    latitude: { type: "number", minimum: -90, maximum: 90 },
    longitude: { type: "number", minimum: -180, maximum: 180 },
    shop_type_id: objectIdSchema,
  },
};

export const nearbyProductQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    distance: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 100000,
    },
    distance_unit: {
      type: "string",
      enum: ["km", "m"],
      default: "km",
    },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    sort_by: {
      type: "string",
      enum: ["distance", "price"],
      default: "distance",
    },
    sort_order: {
      type: "string",
      enum: ["asc", "desc"],
      default: "asc",
    },
    product_category_id: objectIdSchema,
    product_type: { type: "string", enum: ["common", "individual"] },
    in_stock: { type: "boolean" },
  },
};

export const productDetailParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_id"],
  properties: {
    product_id: objectIdSchema,
  },
};
