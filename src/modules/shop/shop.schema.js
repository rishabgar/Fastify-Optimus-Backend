const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const operatingHoursSchema = {
  type: "object",
  additionalProperties: false,
  required: ["open", "close"],
  properties: {
    open: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    close: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
  },
};

const locationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["coordinates"],
  properties: {
    type: { type: "string", const: "Point", default: "Point" },
    coordinates: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: [
        { type: "number", minimum: -180, maximum: 180 },
        { type: "number", minimum: -90, maximum: 90 },
      ],
    },
  },
};

const editableProperties = {
  shop_name: { type: "string", minLength: 1, maxLength: 200 },
  shop_address: { type: "string", minLength: 1, maxLength: 1000 },
  shop_image: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
  operating_hours: operatingHoursSchema,
  gst_number: {
    anyOf: [
      { type: "string", minLength: 15, maxLength: 15 },
      { type: "null" },
    ],
  },
  shop_type_id: objectIdSchema,
  seller_location: locationSchema,
};

export const createShopSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "shop_name",
    "shop_address",
    "operating_hours",
    "shop_type_id",
    "seller_location",
  ],
  properties: editableProperties,
};

export const updateShopSchema = {
  type: "object",
  additionalProperties: false,
  propertyNames: {
    enum: [
      "shop_name",
      "shop_address",
      "shop_image",
      "operating_hours",
      "gst_number",
      "shop_type_id",
      "seller_location",
      "is_closed",
    ],
  },
  minProperties: 1,
  properties: {
    ...editableProperties,
    is_closed: { type: "boolean" },
  },
};

export const shopParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shop_id"],
  properties: { shop_id: objectIdSchema },
};

const paginationProperties = {
  page: { type: "integer", minimum: 1, default: 1 },
  limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
};

export const sellerShopListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...paginationProperties,
    search: { type: "string", minLength: 1, maxLength: 200 },
    is_active: { type: "boolean" },
    is_closed: { type: "boolean" },
    shop_type_id: objectIdSchema,
    sort_by: {
      type: "string",
      enum: ["created_at", "updated_at", "name"],
      default: "created_at",
    },
    sort_direction: {
      type: "string",
      enum: ["asc", "desc"],
      default: "desc",
    },
  },
};

export const customerShopListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...paginationProperties,
    search: { type: "string", minLength: 1, maxLength: 200 },
    shop_type_id: objectIdSchema,
    is_closed: { type: "boolean" },
    longitude: { type: "number", minimum: -180, maximum: 180 },
    latitude: { type: "number", minimum: -90, maximum: 90 },
    radius: { type: "number", exclusiveMinimum: 0, maximum: 100 },
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

export const nearbyShopListSchema = {
  type: "object",
  propertyNames: {
    enum: [
      "search",
      "shop_type_id",
      "longitude",
      "latitude",
      "distance",
    ],
  },
  required: ["longitude", "latitude"],
  properties: {
    search: { type: "string", minLength: 1, maxLength: 200 },
    shop_type_id: objectIdSchema,
    longitude: { type: "number", minimum: -180, maximum: 180 },
    latitude: { type: "number", minimum: -90, maximum: 90 },
    distance: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 100000,
      default: 1000,
    },
  },
};

export const developmentUpdateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...editableProperties,
    is_closed: { type: "boolean" },
    is_active: { type: "boolean" },
  },
};
