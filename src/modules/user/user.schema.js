const coordinatesSchema = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: { type: "number" },
};

const savedAddressSchema = {
  type: "object",
  additionalProperties: false,
  required: ["address"],
  properties: {
    recipient_name: { type: "string" },
    phone: { type: "string" },
    address: { type: "string" },
    coordinates: coordinatesSchema,
    is_default: { type: "boolean" },
  },
};

export const getUserProfileResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user_id", "first_name", "user_type"],
      properties: {
        user_id: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        user_email: { type: "string" },
        user_phone_no: { type: "string" },
        profile_image: { type: "string" },
        user_type: {
          type: "string",
          enum: ["customer", "seller", "admin", "delivery_partner"],
        },
        user_location: {
          type: "object",
          additionalProperties: false,
          required: ["type", "coordinates"],
          properties: {
            type: { type: "string", const: "Point" },
            coordinates: coordinatesSchema,
          },
        },
        saved_addresses: { type: "array", items: savedAddressSchema },
        vehicle_type: {
          type: "string",
          enum: ["bike", "scooter", "car", "bicycle", "other"],
        },
      },
    },
  },
};

export const softDeleteUserResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user_id", "is_deleted"],
      properties: {
        user_id: { type: "string" },
        is_deleted: { type: "boolean", const: true },
      },
    },
  },
};
