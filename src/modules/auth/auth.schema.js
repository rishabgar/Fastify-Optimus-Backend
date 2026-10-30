export const adminRegistrationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_email", "first_name", "password"],
  properties: {
    user_email: {
      type: "string",
      minLength: 1,
      pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
    },
    first_name: {
      type: "string",
      minLength: 1,
    },
    last_name: {
      type: "string",
    },
    password: {
      type: "string",
      minLength: 6,
    },
    user_type: {
      type: "string",
      enum: ["admin"],
      default: "admin",
    },
  },
};

export const adminRegistrationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["id", "user_email", "first_name", "user_type"],
      properties: {
        id: { type: "string" },
        user_email: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        user_type: { type: "string", const: "admin" },
      },
    },
  },
};

export const adminLoginSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_email", "password"],
  properties: {
    user_email: {
      type: "string",
      minLength: 1,
      pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
    },
    password: {
      type: "string",
      minLength: 1,
    },
  },
};

export const adminLoginResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["admin_id", "token"],
      properties: {
        admin_id: { type: "string" },
        token: { type: "string" },
      },
    },
  },
};

export const developmentTokenSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_email"],
  properties: {
    user_email: {
      type: "string",
      minLength: 1,
      pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
    },
  },
};

export const developmentTokenResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user_id", "role", "token"],
      properties: {
        user_id: { type: "string" },
        role: { type: "string", enum: ["seller", "customer"] },
        token: { type: "string" },
      },
    },
  },
};

const customerLocationSchema = {
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

const coordinatesSchema = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: [
    { type: "number", minimum: -180, maximum: 180 },
    { type: "number", minimum: -90, maximum: 90 },
  ],
};

const customerSavedAddressInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["address"],
  properties: {
    address: { type: "string", minLength: 1 },
    is_default: { type: "boolean", default: false },
  },
};

export const customerRegistrationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["user_phone_no", "first_name"],
  properties: {
    user_phone_no: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" },
    user_email: {
      type: "string",
      minLength: 1,
      pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
    },
    first_name: { type: "string", minLength: 1 },
    last_name: { type: "string" },
    profile_image: { type: "string" },
    user_location: customerLocationSchema,
    saved_addresses: {
      type: "array",
      maxItems: 1,
      items: customerSavedAddressInputSchema,
    },
    coordinates: coordinatesSchema,
  },
};

export const customerRegistrationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user_id", "first_name", "token"],
      properties: {
        user_id: { type: "string" },
        first_name: { type: "string" },
        token: { type: "string" },
      },
    },
  },
};

export const verifyDeliveryPartnerPhoneSchema = {
  type: "object",
  additionalProperties: false,
  required: ["idToken"],
  properties: {
    idToken: { type: "string", minLength: 1 },
  },
};

export const verifyDeliveryPartnerPhoneResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["user_phone_no", "verified"],
      properties: {
        user_phone_no: { type: "string" },
        verified: { type: "boolean", const: true },
      },
    },
  },
};

export const deliveryPartnerRegistrationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["idToken", "first_name"],
  properties: {
    idToken: { type: "string", minLength: 1 },
    first_name: { type: "string", minLength: 1 },
    last_name: { type: "string" },
    user_email: {
      type: "string",
      minLength: 1,
      pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$",
    },
    profile_image: { type: "string" },
    vehicle_type: {
      type: ["string", "null"],
      enum: ["bike", "scooter", "car", "bicycle", "other", null],
    },
  },
};

export const deliveryPartnerRegistrationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "data"],
  properties: {
    status: { type: "string", const: "success" },
    message: { type: "string" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["id", "user_phone_no", "first_name", "user_type"],
      properties: {
        id: { type: "string" },
        user_phone_no: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        user_email: { type: "string" },
        profile_image: { type: "string" },
        vehicle_type: { type: ["string", "null"] },
        user_type: { type: "string", const: "delivery_partner" },
      },
    },
  },
};
