const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const itemIdentityProperties = {
  seller_product_id: objectIdSchema,
  shop_id: objectIdSchema,
  product_category_id: objectIdSchema,
  variant_id: objectIdSchema,
};

export const addCartItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["seller_product_id", "variant_id"],
  properties: {
    seller_product_id: objectIdSchema,
    variant_id: objectIdSchema,
    quantity: { type: "integer", minimum: 1, default: 1 },
  },
};

export const updateCartItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["seller_product_id", "variant_id", "quantity"],
  properties: {
    seller_product_id: objectIdSchema,
    variant_id: objectIdSchema,
    quantity: { type: "integer", minimum: 1 },
  },
};

export const removeCartItemParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["seller_product_id", "shop_id", "product_category_id"],
  properties: {
    seller_product_id: objectIdSchema,
    shop_id: objectIdSchema,
    product_category_id: objectIdSchema,
  },
};

export const cartUserParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_id"],
  properties: { user_id: objectIdSchema },
};

export const cartUserQuerySchema = cartUserParamsSchema;

const cartDataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "user_id", "items"],
  properties: {
    id: { type: "string" },
    user_id: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "seller_product_id",
          "shop_id",
          "product_category_id",
          "variant_id",
          "quantity",
        ],
        properties: {
          ...itemIdentityProperties,
          quantity: { type: "integer" },
        },
      },
    },
  },
};

export const cartResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: cartDataSchema,
  },
};

export const addCartItemResponseSchema = {
  ...cartResponseSchema,
  properties: {
    ...cartResponseSchema.properties,
    data: { type: "null" },
  },
};

export const updateCartItemResponseSchema = addCartItemResponseSchema;

const cartProductSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "seller_product_id",
    "variant_id",
    "variant_sku",
    "variant_label",
    "product_name",
    "product_price",
    "product_availability",
    "available_quantity",
    "quantity",
  ],
  properties: {
    seller_product_id: objectIdSchema,
    variant_id: objectIdSchema,
    variant_sku: { type: "string" },
    variant_label: { type: "string" },
    product_name: { type: "string" },
    product_price: { type: "number" },
    product_image: { type: "string" },
    product_availability: { type: "boolean" },
    available_quantity: { type: "number", minimum: 0 },
    quantity: { type: "integer", minimum: 1 },
  },
};

export const getCartResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["shop_id", "items"],
        properties: {
          shop_id: objectIdSchema,
          items: { type: "array", items: cartProductSchema },
        },
      },
    },
  },
};

export const removeCartItemResponseSchema = {
  ...cartResponseSchema,
  properties: {
    ...cartResponseSchema.properties,
    data: {
      anyOf: [cartDataSchema, { type: "null" }],
    },
  },
};
