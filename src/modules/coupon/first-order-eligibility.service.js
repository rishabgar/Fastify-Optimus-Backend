import mongoose from "mongoose";
import { QUALIFYING_FIRST_ORDER_STATUSES } from "./coupon.constants.js";

export const orderEligibilityRepository = {
  async hasQualifyingOrder(userId) {
    const count = await mongoose.connection.collection("orders").countDocuments(
      {
        user_id: new mongoose.Types.ObjectId(userId),
        status: { $in: QUALIFYING_FIRST_ORDER_STATUSES },
      },
      { limit: 1 },
    );
    return count > 0;
  },
};

export function createFirstOrderEligibilityService({
  repository = orderEligibilityRepository,
} = {}) {
  return {
    async isEligible(userId) {
      return !(await repository.hasQualifyingOrder(userId));
    },
  };
}
