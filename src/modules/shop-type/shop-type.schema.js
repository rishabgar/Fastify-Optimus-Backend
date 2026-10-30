const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const editableProperties = {
  shop_type_name: { type: "string", minLength: 1, maxLength: 150 },
  shop_type_image: { type: "string", minLength: 1, maxLength: 2048 },
};

export const createShopTypeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_type_name", "shop_type_image"],
  properties: editableProperties,
};

export const updateShopTypeSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...editableProperties,
    is_active: { type: "boolean" },
  },
};

export const shopTypeParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_type_id"],
  properties: { shop_type_id: objectIdSchema },
};

export const shopTypeDetailQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: { include_deleted: { type: "boolean", default: false } },
};

export const adminShopTypeListSchema = {
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
      enum: ["name", "created_at"],
      default: "name",
    },
    sort_direction: {
      type: "string",
      enum: ["asc", "desc"],
      default: "asc",
    },
  },
};

export const publicShopTypeListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 150 },
  },
};
