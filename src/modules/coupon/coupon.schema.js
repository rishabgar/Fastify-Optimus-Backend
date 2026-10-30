const objectIdSchema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
};

const nullableMoney = {
  anyOf: [{ type: "number", minimum: 0 }, { type: "null" }],
};

const nullablePositiveInteger = {
  anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
};

const nullableDate = {
  anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
};

const campaignProperties = {
  code: { type: "string", minLength: 1, maxLength: 100 },
  type: { type: "string", enum: ["percentage", "fixed"] },
  value: { type: "number", minimum: 0 },
  min_order_value: { type: "number", minimum: 0 },
  max_discount: nullableMoney,
  is_first_order: { type: "boolean" },
  assignment_limit: nullablePositiveInteger,
  start_date: nullableDate,
  end_date: nullableDate,
  is_active: { type: "boolean" },
};

export const createCouponSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "type", "value"],
  properties: campaignProperties,
};

export const updateCouponSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: campaignProperties,
};

export const couponParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["coupon_id"],
  properties: { coupon_id: objectIdSchema },
};

export const couponStatusSchema = {
  type: "object",
  additionalProperties: false,
  required: ["is_active"],
  properties: { is_active: { type: "boolean" } },
};

export const adminCouponListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    search: { type: "string", minLength: 1, maxLength: 100 },
    type: { type: "string", enum: ["percentage", "fixed"] },
    is_active: { type: "boolean" },
    is_deleted: { type: "boolean" },
    include_deleted: { type: "boolean", default: false },
    sort_by: {
      type: "string",
      enum: ["created_at", "code", "start_date", "end_date"],
      default: "created_at",
    },
    sort_direction: {
      type: "string",
      enum: ["asc", "desc"],
      default: "desc",
    },
  },
};

export const userCouponListSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["assigned", "reserved", "used", "expired"],
    },
  },
};

export const validateCouponSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subtotal"],
  properties: { subtotal: { type: "number", minimum: 0 } },
};
