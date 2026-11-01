import { Types } from "mongoose";
import { schemaFactory } from "../../shared/database/schema-factory.js";

export const deliveryEarningModel = schemaFactory(
  "delivery_earning",
  {
    delivery_partner_id: { type: Types.ObjectId, ref: "user", required: true },
    order_id: { type: Types.ObjectId, ref: "order", required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  {},
  (schema) => {
    schema.index({ order_id: 1 }, { unique: true, name: "delivery_earning_order_unique_idx" });
    schema.index({ delivery_partner_id: 1, createdAt: -1 }, { name: "delivery_earning_partner_recent_idx" });
  },
);

export default deliveryEarningModel;
