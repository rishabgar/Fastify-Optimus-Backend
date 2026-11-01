import rewardTransactionModel from "./reward-transaction.model.js";
import { createRewardService } from "./reward.service.js";

export { rewardTransactionModel } from "./reward-transaction.model.js";
export { createRewardService } from "./reward.service.js";

export default async function rewardModule(app) {
  app.decorate("rewardTransactionModel", rewardTransactionModel);
  app.decorate("rewardService", createRewardService());
}
