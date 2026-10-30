const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const imageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1 },
    alt: { type: "string", minLength: 1 },
    is_main: { type: "boolean" },
  },
};

const sellerVariantFields = {
  price: { type: "number", minimum: 0 },
  mrp: { type: "number", minimum: 0 },
  discount_percent: { type: "number", minimum: 0, maximum: 100 },
  product_quantity: { type: "number", minimum: 0 },
  available_quantity: { type: "number", minimum: 0 },
  reserved_quantity: { type: "number", minimum: 0 },
  is_active: { type: "boolean" },
};

const commonVariantSchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_variant_id", "price"],
  properties: {
    product_variant_id: objectIdSchema,
    ...sellerVariantFields,
  },
};

const individualVariantSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "label",
    "quantity_value",
    "quantity_unit",
    "price",
  ],
  properties: {
    label: { type: "string", minLength: 1 },
    quantity_value: { type: "number", minimum: 0 },
    quantity_unit: { type: "string", enum: ["mg", "g", "kg", "ml", "ltr", "pcs"] },
    ...sellerVariantFields,
  },
};

const commonProductSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_id", "product_type", "product_id", "variants"],
  properties: {
    shop_id: objectIdSchema,
    product_type: { const: "common" },
    product_id: objectIdSchema,
    product_name_override: { type: "string", minLength: 1 },
    product_description_override: { type: "string", minLength: 1 },
    product_images_override: {
      type: "array",
      minItems: 1,
      items: imageSchema,
    },
    variants: {
      type: "array",
      minItems: 1,
      items: commonVariantSchema,
    },
  },
};

const individualProductSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "shop_id",
    "product_type",
    "product_name",
    "brand_name",
    "product_category_id",
    "variants",
  ],
  properties: {
    shop_id: objectIdSchema,
    product_type: { const: "individual" },
    product_name: { type: "string", minLength: 1 },
    brand_name: { type: "string", minLength: 1 },
    product_description: { type: "string", minLength: 1 },
    product_category_id: objectIdSchema,
    product_images: {
      type: "array",
      minItems: 1,
      items: imageSchema,
    },
    variants: {
      type: "array",
      minItems: 1,
      items: individualVariantSchema,
    },
  },
};

export const createSellerProductSchema = {
  oneOf: [commonProductSchema, individualProductSchema],
};

const nullableText = {
  anyOf: [
    { type: "string", minLength: 1 },
    { type: "null" },
  ],
};

const updateVariantSchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_variant_id"],
  minProperties: 2,
  properties: {
    product_variant_id: objectIdSchema,
    label: { type: "string", minLength: 1 },
    quantity_value: { type: "number", minimum: 0 },
    quantity_unit: {
      type: "string",
      enum: ["mg", "g", "kg", "ml", "ltr", "pcs"],
    },
    price: { type: "number", minimum: 0 },
    mrp: { type: "number", minimum: 0 },
    discount_percent: { type: "number", minimum: 0, maximum: 100 },
    product_quantity: { type: "number", minimum: 0 },
    available_quantity: { type: "number", minimum: 0 },
    is_active: { type: "boolean" },
  },
};

export const updateSellerProductSchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_id"],
  minProperties: 2,
  properties: {
    product_id: objectIdSchema,
    product_name_override: nullableText,
    product_description_override: nullableText,
    product_images_override: { type: "array", items: imageSchema },
    product_name: { type: "string", minLength: 1 },
    brand_name: { type: "string", minLength: 1 },
    product_description: nullableText,
    product_category_id: objectIdSchema,
    product_images: { type: "array", items: imageSchema },
    variants: {
      type: "array",
      minItems: 1,
      items: updateVariantSchema,
    },
    is_active: { type: "boolean" },
  },
};

export const sellerProductParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_id"],
  properties: {
    product_id: objectIdSchema,
  },
};
