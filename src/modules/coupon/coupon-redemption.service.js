import { HttpError } from "../../shared/http/http-error.js";
import { couponRepository } from "./coupon.repository.js";
import { createFirstOrderEligibilityService } from "./first-order-eligibility.service.js";

function invalidCoupon(message = "Coupon is not available") {
  return new HttpError(409, message, { field: "coupon_id" });
}

function assertAvailable(coupon, currentTime) {
  if (!coupon || coupon.is_deleted) throw new HttpError(404, "Coupon not found");
  if (!coupon.is_active) throw invalidCoupon("Coupon is inactive");
  if (coupon.start_date && new Date(coupon.start_date) > currentTime) {
    throw invalidCoupon("Coupon campaign has not started");
  }
  if (coupon.end_date && new Date(coupon.end_date) < currentTime) {
    throw invalidCoupon("Coupon campaign has expired");
  }
}

export function createCouponRedemptionService({
  repository = couponRepository,
  firstOrderEligibility = createFirstOrderEligibilityService(),
  now = () => new Date(),
} = {}) {
  return {
    async validateForCheckout(userId, couponId, subtotal) {
      const [coupon, assignment] = await Promise.all([
        repository.findById(couponId),
        repository.findUserCoupon(userId, couponId),
      ]);
      assertAvailable(coupon, now());
      if (!assignment) throw new HttpError(404, "Coupon is not assigned to user");
      if (assignment.status !== "assigned") {
        throw invalidCoupon(`Coupon is ${assignment.status}`);
      }
      if (
        coupon.is_first_order &&
        !(await firstOrderEligibility.isEligible(userId))
      ) {
        throw invalidCoupon("Coupon is valid only for the first order");
      }
      if (subtotal < coupon.min_order_value) {
        throw invalidCoupon(
          `Minimum order value is ${coupon.min_order_value}`,
        );
      }

      let discount =
        coupon.type === "percentage"
          ? (subtotal * coupon.value) / 100
          : coupon.value;
      if (coupon.type === "percentage" && coupon.max_discount != null) {
        discount = Math.min(discount, coupon.max_discount);
      }
      discount = Math.min(discount, subtotal);

      return {
        coupon_id: coupon._id.toString(),
        code: coupon.code,
        discount,
        subtotal,
        total_after_discount: subtotal - discount,
      };
    },

    async listForUser(userId, query) {
      return repository.listForUser(userId, {
        status: query.status,
        now: now(),
      });
    },

    async reserve(userId, couponId) {
      const assignment = await repository.transitionUserCoupon(
        { user_id: userId, coupon_id: couponId, status: "assigned" },
        { $set: { status: "reserved", reserved_at: now() } },
      );
      if (!assignment) throw invalidCoupon("Coupon cannot be reserved");
      return assignment;
    },

    async consume(userId, couponId, orderId, session) {
      const assignment = await repository.transitionUserCoupon(
        { user_id: userId, coupon_id: couponId, status: "reserved" },
        {
          $set: {
            status: "used",
            used_at: now(),
            order_id: orderId,
          },
        },
        session,
      );
      if (!assignment) {
        const existing = await repository.findUserCoupon(
          userId,
          couponId,
          session,
        );
        if (
          existing?.status === "used" &&
          existing.order_id?.toString() === orderId.toString()
        ) {
          return existing;
        }
        throw invalidCoupon("Coupon cannot be consumed");
      }
      return assignment;
    },

    async release(userId, couponId, session) {
      const assignment = await repository.transitionUserCoupon(
        { user_id: userId, coupon_id: couponId, status: "reserved" },
        {
          $set: { status: "assigned", reserved_at: null, order_id: null },
        },
        session,
      );
      if (!assignment) throw invalidCoupon("Coupon is not reserved");
      return assignment;
    },
  };
}
