const objectId = { type: "string", pattern: "^[0-9a-fA-F]{24}$" };
const coordinates = { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } };

export const placeOrderSchema = {
  type: "object", additionalProperties: false, required: ["address", "payment_method"],
  properties: {
    payment_method: { type: "string", enum: ["online", "cod"] },
    coupon_id: objectId,
    address: {
      type: "object", additionalProperties: false,
      properties: {
        saved_address_id: objectId,
        recipient_name: { type: "string", minLength: 1, maxLength: 200 },
        phone: { type: "string", minLength: 3, maxLength: 50 },
        address: { type: "string", minLength: 1, maxLength: 1000 },
        coordinates,
        save_address: { type: "boolean" },
      },
      anyOf: [
        { required: ["saved_address_id"] },
        { required: ["address", "coordinates", "recipient_name", "phone"] },
      ],
    },
  },
};

export const idParamsSchema = { type: "object", additionalProperties: false, required: ["order_id"], properties: { order_id: objectId } };
export const shopOrderParamsSchema = { type: "object", additionalProperties: false, required: ["order_id", "shop_order_id"], properties: { order_id: objectId, shop_order_id: objectId } };
export const rejectSchema = { type: "object", additionalProperties: false, properties: { reason: { type: "string", maxLength: 500 } } };
export const cancelSchema = { type: "object", additionalProperties: false, properties: { reason: { type: "string", maxLength: 500 } } };
export const otpSchema = { type: "object", additionalProperties: false, required: ["otp"], properties: { otp: { type: "string", pattern: "^[0-9]{6}$" } } };
export const deliveryEarningSchema = { type: "object", additionalProperties: false, required: ["earning_amount"], properties: { earning_amount: { type: "number", minimum: 0 } } };
