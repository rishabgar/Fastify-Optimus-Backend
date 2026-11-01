import { Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

export const rewardTransactionModel = schemaFactory(
  "reward_transaction",
  {
    user_id: { type: Types.ObjectId, ref: "user", required: true },
    order_id: { type: Types.ObjectId, ref: "order", required: true },
    type: { type: String, enum: ["earned", "redeemed", "refunded"], required: true },
    amount: { type: Number, required: true, min: 1 },
  },
  {},
  (schema) => {
    schema.index(
      { order_id: 1, type: 1 },
      { unique: true, name: "reward_order_type_unique_idx" },
    );
    schema.index({ user_id: 1, createdAt: -1 }, { name: "reward_user_recent_idx" });
  },
);

export default rewardTransactionModel;
