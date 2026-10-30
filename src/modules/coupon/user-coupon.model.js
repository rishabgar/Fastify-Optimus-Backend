import { Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

export const userCouponModel = schemaFactory(
  "user_coupon",
  {
    user_id: {
      type: Types.ObjectId,
      ref: "user",
      required: [true, "User id is required"],
      index: true,
    },
    coupon_id: {
      type: Types.ObjectId,
      ref: "coupon",
      required: [true, "Coupon id is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["assigned", "reserved", "used", "expired"],
      default: "assigned",
    },
    assigned_at: {
      type: Date,
      default: Date.now,
    },
    reserved_at: {
      type: Date,
      default: null,
    },
    used_at: {
      type: Date,
      default: null,
    },
    order_id: {
      type: Types.ObjectId,
      ref: "order",
      default: null,
    },
  },
  {},
  (schema) => {
    schema.index(
      { user_id: 1, coupon_id: 1 },
      { unique: true, name: "user_coupon_unique_idx" },
    );
    schema.index(
      { user_id: 1, status: 1 },
      { name: "user_coupon_status_idx" },
    );
    schema.index(
      { coupon_id: 1, status: 1 },
      { name: "coupon_assignment_status_idx" },
    );
  },
);

export default userCouponModel;
