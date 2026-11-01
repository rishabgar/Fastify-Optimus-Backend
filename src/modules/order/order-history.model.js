/*
 * Archive of finished orders; each document preserves the original order _id.
 * WRITE RULE: use the native driver in one transaction to preserve _id and timestamps:
 * await OrderHistory.collection.replaceOne(
 *   { _id: order._id },
 *   { ...order.toObject(), archived_at: new Date(), archive_reason: order.status },
 *   { upsert: true, session },
 * );
 * const res = await Order.deleteOne(
 *   { _id: order._id, status: { $in: ARCHIVABLE_STATUSES } },
 *   { session },
 * );
 * if (res.deletedCount !== 1) throw new Error("Archive aborted");
 * Archive only fully finished orders: delivered, or cancelled after all shops
 * reject / the customer cancels. A single shop rejection is not archivable.
 */
import mongoose from "mongoose";
import { orderModel } from "./order.model.js";

export const ARCHIVABLE_STATUSES = ["delivered", "cancelled"];

const historySchema = orderModel.schema.clone();

historySchema.clearIndexes();
historySchema.add({
  archived_at: {
    type: Date,
    required: true,
    default: Date.now,
  },
  archive_reason: {
    type: String,
    enum: ARCHIVABLE_STATUSES,
    required: [true, "Archive reason is required"],
  },
});

historySchema.index(
  { order_number: 1 },
  { unique: true, name: "order_history_number_unique_idx" },
);
historySchema.index(
  { customer_id: 1, createdAt: -1 },
  { name: "order_history_customer_recent_idx" },
);
historySchema.index(
  { "shop_orders.shop_id": 1, createdAt: -1 },
  { name: "order_history_shop_recent_idx" },
);
historySchema.index(
  { "shop_orders.seller_id": 1, createdAt: -1 },
  { name: "order_history_seller_recent_idx" },
);
historySchema.index(
  { "delivery.partner_id": 1, "delivery.delivered_at": -1 },
  { name: "order_history_partner_delivered_idx" },
);
historySchema.index(
  { "shop_orders.shop_id": 1, "shop_orders.settlement.status": 1 },
  { name: "order_history_settlement_idx" },
);
historySchema.index(
  { status: 1, createdAt: -1 },
  { name: "order_history_status_idx" },
);
historySchema.index(
  { archived_at: 1 },
  { name: "order_history_archived_at_idx" },
);

export const orderHistoryModel =
  mongoose.models.order_history || mongoose.model("order_history", historySchema);

export default orderHistoryModel;
