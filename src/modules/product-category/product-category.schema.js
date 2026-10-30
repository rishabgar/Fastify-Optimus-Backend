const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const nullableString = {
  anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
};

const categoryProperties = {
  product_category_name: { type: "string", minLength: 1, maxLength: 150 },
  product_category_description: nullableString,
  product_category_image: nullableString,
  shop_type_ids: {
    type: "array",
    minItems: 1,
    uniqueItems: true,
    items: objectIdSchema,
  },
  sort_order: { type: "integer", minimum: 0 },
};

export const createCategorySchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_category_name", "shop_type_ids"],
  properties: categoryProperties,
};

export const updateCategorySchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...categoryProperties,
    is_active: { type: "boolean" },
  },
};

export const categoryParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["category_id"],
  properties: { category_id: objectIdSchema },
};

export const productCategoryParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["product_category_id"],
  properties: { product_category_id: objectIdSchema },
};

export const shopCategoryParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_id"],
  properties: { shop_id: objectIdSchema },
};

export const shopTypeCategoryParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_type_id"],
  properties: { shop_type_id: objectIdSchema },
};

export const adminCategoryListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    search: { type: "string", minLength: 1, maxLength: 150 },
    is_active: { type: "boolean" },
    is_deleted: { type: "boolean" },
    include_deleted: { type: "boolean", default: false },
    sort_by: {
      type: "string",
      enum: ["sort_order", "name", "created_at"],
      default: "sort_order",
    },
    sort_direction: {
      type: "string",
      enum: ["asc", "desc"],
      default: "asc",
    },
  },
};

export const publicCategoryListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 150 },
  },
};
