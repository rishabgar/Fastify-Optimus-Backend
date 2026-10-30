import { schemaFactory } from "../../shared/database/schema-factory.js";

export const couponModel = schemaFactory(
  "coupon",
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Coupon type is required"],
    },
    value: {
      type: Number,
      required: [true, "Coupon value is required"],
      min: 0,
    },
    min_order_value: {
      type: Number,
      default: 0,
      min: 0,
    },
    max_discount: {
      type: Number,
      default: null,
      min: 0,
    },
    is_first_order: {
      type: Boolean,
      default: false,
    },
    assignment_limit: {
      type: Number,
      default: null,
      min: 1,
    },
    assigned_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    start_date: {
      type: Date,
      default: null,
    },
    end_date: {
      type: Date,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  {},
  (schema) => {
    schema.index({ code: 1 }, { unique: true, name: "coupon_code_unique_idx" });
    schema.index(
      { is_active: 1, is_deleted: 1, start_date: 1, end_date: 1 },
      { name: "coupon_availability_idx" },
    );
  },
);

export default couponModel;
