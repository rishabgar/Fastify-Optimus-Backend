import { Schema, Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

export const SHOP_ORDER_STATUSES = [
  "processing",
  "accepted",
  "rejected",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export const ORDER_STATUSES = [
  "processing",
  "accepted",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export const PAYMENT_METHODS = ["online", "cod"];
export const ORDER_PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const pointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(coordinates) {
          return (
            Array.isArray(coordinates) &&
            coordinates.length === 2 &&
            coordinates.every(Number.isFinite) &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90
          );
        },
        message:
          "Coordinates must be [longitude, latitude] within valid ranges",
      },
    },
  },
  { _id: false },
);

const otpSchema = new Schema(
  {
    code: { type: String, trim: true },
    generated_at: Date,
    verified_at: Date,
    attempts: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const timelineSchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Types.ObjectId, ref: "user" },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const orderItemSchema = new Schema({
  seller_product_id: {
    type: Types.ObjectId,
    ref: "seller_product",
    required: true,
  },
  variant_id: { type: Types.ObjectId, required: true },
  product_type: {
    type: String,
    enum: ["common", "individual"],
    required: true,
  },
  product_id: { type: Types.ObjectId, ref: "product", default: null },
  product_variant_id: { type: Types.ObjectId, default: null },
  product_category_id: { type: Types.ObjectId, ref: "product_category" },
  product_name: { type: String, required: true, trim: true },
  brand_name: { type: String, trim: true },
  variant_label: { type: String, required: true, trim: true },
  quantity_value: Number,
  quantity_unit: String,
  image_url: { type: String, trim: true },
  seller_sku: { type: String, trim: true },
  unit_price: { type: Number, required: true, min: 0 },
  mrp: { type: Number, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  line_total: { type: Number, required: true, min: 0 },
});

const shopOrderSchema = new Schema({
  shop_id: { type: Types.ObjectId, ref: "shop", required: true },
  seller_id: { type: Types.ObjectId, ref: "user", required: true },
  status: {
    type: String,
    enum: SHOP_ORDER_STATUSES,
    default: "processing",
    required: true,
  },
  shop_snapshot: {
    shop_name: { type: String, required: true, trim: true },
    shop_address: { type: String, required: true, trim: true },
    contact_phone: { type: String, trim: true },
    location: { type: pointSchema, required: true },
  },
  items: {
    type: [orderItemSchema],
    validate: {
      validator(items) {
        return Array.isArray(items) && items.length > 0;
      },
      message: "Shop order must contain at least one item",
    },
  },
  items_total: { type: Number, required: true, min: 0 },
  commission_pct: { type: Number, required: true, min: 0, max: 100 },
  commission_amount: { type: Number, required: true, min: 0 },
  seller_earning: { type: Number, required: true, min: 0 },
  rejection_reason: {
    type: String,
    trim: true,
    maxlength: 500,
    validate: {
      validator(value) {
        return !value || this.status === "rejected";
      },
      message: "Rejection reason is allowed only for rejected shop orders",
    },
  },
  pickup_otp: { type: otpSchema, default: undefined },
  settlement: {
    status: {
      type: String,
      enum: ["pending", "eligible", "settled"],
      default: "pending",
    },
    settled_at: Date,
  },
  timeline: { type: [timelineSchema], default: [] },
});

export const orderModel = schemaFactory(
  "order",
  {
    order_number: { type: String, required: true, trim: true },
    customer_id: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "Customer id is required"],
    },
    customer_snapshot: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    delivery_address: {
      saved_address_id: { type: Types.ObjectId, default: null },
      recipient_name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      location: { type: pointSchema, required: true },
    },
    shop_orders: {
      type: [shopOrderSchema],
      validate: [
        {
          validator(shopOrders) {
            return Array.isArray(shopOrders) && shopOrders.length > 0;
          },
          message: "Order must contain at least one shop order",
        },
        {
          validator(shopOrders) {
            if (!Array.isArray(shopOrders)) return true;
            const shopIds = shopOrders.map((shopOrder) =>
              shopOrder.shop_id?.toString(),
            );
            return new Set(shopIds).size === shopIds.length;
          },
          message: "Order can contain only one shop order per shop",
        },
      ],
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "processing",
      required: true,
    },
    pricing: {
      items_total_original: { type: Number, required: true, min: 0 },
      items_total: { type: Number, required: true, min: 0 },
      delivery_fee: { type: Number, default: 0, min: 0 },
      coupon_discount: { type: Number, default: 0, min: 0 },
      platform_coupon_cost: { type: Number, default: 0, min: 0 },
      payable_amount: { type: Number, required: true, min: 0 },
    },
    coupon: {
      coupon_id: { type: Types.ObjectId, ref: "coupon", default: null },
      code: { type: String, trim: true },
      type: { type: String, enum: ["percentage", "fixed", null], default: null },
      value: Number,
      discount_at_placement: { type: Number, min: 0 },
      first_order_flag_set: { type: Boolean, default: false },
    },
    payment_method: { type: String, enum: PAYMENT_METHODS, required: true },
    payment_status: {
      type: String,
      enum: ORDER_PAYMENT_STATUSES,
      default: "pending",
      required: true,
    },
    payment_enabled_at: Date,
    paid_at: Date,
    payment_id: { type: Types.ObjectId, ref: "payment" },
    delivery: {
      partner_id: { type: Types.ObjectId, ref: "user", default: null },
      partner_snapshot: {
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
        vehicle_type: String,
      },
      assigned_at: Date,
      earning_amount: { type: Number, min: 0 },
      earning_awarded_at: Date,
      customer_otp: { type: otpSchema, default: undefined },
      delivered_at: Date,
    },
    reward_awarded_at: { type: Date, default: null },
    cancellation: {
      cancelled_by: { type: Types.ObjectId, ref: "user" },
      reason: { type: String, trim: true },
      cancelled_at: Date,
    },
  },
  {},
  (schema) => {
    schema.index(
      { order_number: 1 },
      { unique: true, name: "order_number_unique_idx" },
    );
    schema.index(
      { customer_id: 1, createdAt: -1 },
      { name: "order_customer_recent_idx" },
    );
    schema.index(
      { "shop_orders.shop_id": 1, "shop_orders.status": 1, createdAt: -1 },
      { name: "order_shop_status_idx" },
    );
    schema.index(
      { "shop_orders.seller_id": 1, createdAt: -1 },
      { name: "order_seller_recent_idx" },
    );
    schema.index(
      { "delivery.partner_id": 1, status: 1 },
      { name: "order_partner_status_idx" },
    );
    schema.index(
      { status: 1, "delivery.partner_id": 1, createdAt: 1 },
      { name: "order_unassigned_queue_idx" },
    );
    schema.index(
      { customer_id: 1, "coupon.coupon_id": 1, status: 1 },
      { name: "order_customer_coupon_idx" },
    );
    schema.pre("validate", function validateDeliveredOrder(next) {
      if (this.status === "delivered" && this.payment_status !== "paid") {
        next(new Error("Order can be delivered only after successful payment"));
        return;
      }
      if (this.status === "delivered" && !this.delivery?.customer_otp?.verified_at) {
        next(new Error("Order can be delivered only after customer OTP verification"));
        return;
      }
      next();
    });
  },
);

export default orderModel;
