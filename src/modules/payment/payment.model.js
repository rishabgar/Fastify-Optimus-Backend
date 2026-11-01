import { Schema, Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

const refundSchema = new Schema({
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, trim: true },
  shop_order_id: { type: Types.ObjectId, default: null },
  status: {
    type: String,
    enum: ["pending", "processed", "failed"],
    default: "pending",
  },
  gateway_refund_id: { type: String, trim: true },
  created_at: { type: Date, default: Date.now },
});

export const paymentModel = schemaFactory(
  "payment",
  {
    order_id: {
      type: Types.ObjectId,
      ref: "order",
      required: [true, "Order id is required"],
    },
    customer_id: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Customer id is required"],
    },
    method: { type: String, enum: ["online", "cod"], required: true },
    paid_via: {
      type: String,
      enum: ["cashfree", "delivery_partner_cash", null],
      default: null,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded", "partially_refunded"],
      default: "created",
      required: true,
    },
    gateway: {
      provider: { type: String, trim: true },
      gateway_order_id: { type: String, trim: true },
      gateway_payment_id: { type: String, trim: true },
      signature_verified: { type: Boolean, default: false },
    },
    confirmed_by: { type: Types.ObjectId, ref: "user", default: null },
    confirmed_via: {
      type: String,
      enum: ["delivery_partner", "gateway_webhook", null],
      default: null,
    },
    paid_at: Date,
    payment_link_expires_at: Date,
    provider_event_ids: { type: [String], default: [] },
    failure_reason: { type: String, trim: true },
    idempotency_key: { type: String, trim: true },
    refunds: { type: [refundSchema], default: [] },
  },
  {},
  (schema) => {
    schema.index(
      { order_id: 1, status: 1 },
      { name: "payment_order_status_idx" },
    );
    schema.index(
      { customer_id: 1, createdAt: -1 },
      { name: "payment_customer_recent_idx" },
    );
    schema.index(
      { order_id: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "paid" },
        name: "payment_one_paid_per_order_idx",
      },
    );
    schema.index(
      { "gateway.gateway_order_id": 1 },
      {
        unique: true,
        partialFilterExpression: {
          "gateway.gateway_order_id": { $type: "string" },
        },
        name: "payment_gateway_order_unique_idx",
      },
    );
    schema.index(
      { idempotency_key: 1 },
      {
        unique: true,
        partialFilterExpression: { idempotency_key: { $type: "string" } },
        name: "payment_idempotency_unique_idx",
      },
    );
  },
);

export default paymentModel;
