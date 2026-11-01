import { couponRepository } from "./coupon.repository.js";

export function createCouponRedemptionService({
  repository = couponRepository,
  now = () => new Date(),
} = {}) {
  return {
    async listForUser(userId, query) {
      return repository.listForUser(userId, {
        status: query.status,
        now: now(),
      });
    },

  };
}
