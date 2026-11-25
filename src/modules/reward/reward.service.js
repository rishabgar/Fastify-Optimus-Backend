import { HttpError } from "../../shared/http/http-error.js";
import { runInTransaction } from "../../shared/database/transaction.js";
import { userModel } from "../user/user.model.js";
import rewardTransactionModel from "./reward-transaction.model.js";

function pointsForOrder(order) {
  return Math.floor(order.pricing.payable_amount);
}

export function createRewardService() {
  return {
    async awardForOrder(order, { session } = {}) {
      const amount = pointsForOrder(order);
      if (!amount) return null;
      const award = async (transactionSession) => {
        try {
          const [entry] = await rewardTransactionModel.create([{
            user_id: order.customer_id,
            order_id: order._id,
            type: "earned",
            amount,
          }], { session: transactionSession });
          const updated = await userModel.updateOne(
            { _id: order.customer_id },
            { $inc: { reward_tokens: amount } },
            { session: transactionSession },
          );
          if (updated.modifiedCount !== 1) throw new HttpError(404, "Customer not found");
          return entry;
        } catch (error) {
          if (error?.code === 11000) return null;
          throw error;
        }
      };
      return session ? award(session) : runInTransaction(award);
    },
  };
}
