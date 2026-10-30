const objectIdSchema = { type: "string", pattern: "^[0-9a-fA-F]{24}$" };

const coordinatesSchema = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: [
    { type: "number", minimum: -180, maximum: 180 },
    { type: "number", minimum: -90, maximum: 90 },
  ],
};

const locationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["coordinates"],
  properties: {
    type: { type: "string", const: "Point", default: "Point" },
    coordinates: coordinatesSchema,
  },
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

export const sellerRegistrationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "user_phone_no",
    "first_name",
    "shop_name",
    "shop_address",
    "operating_hours",
    "shop_type_id",
    "coordinates",
  ],
  properties: {
    user_email: {
      type: "string",
      minLength: 1,
      pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
    },
    user_phone_no: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" },
    first_name: { type: "string", minLength: 1 },
    last_name: { type: "string" },
    profile_image: { type: "string" },
    shop_name: { type: "string", minLength: 1, maxLength: 200 },
    shop_address: { type: "string", minLength: 1, maxLength: 1000 },
    shop_image: { type: "string", minLength: 1 },
    operating_hours: operatingHoursSchema,
    gst_number: { type: "string", minLength: 15, maxLength: 15 },
    shop_type_id: objectIdSchema,
    coordinates: coordinatesSchema,
  },
};

export const sellerRegistrationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["seller_id", "shop_id", "token"],
      properties: {
        seller_id: { type: "string" },
        shop_id: { type: "string" },
        token: { type: "string" },
      },
    },
  },
};
