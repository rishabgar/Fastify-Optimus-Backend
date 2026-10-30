import { HttpError } from "../../shared/http/http-error.js";
import { couponRepository } from "./coupon.repository.js";

function unavailableError(coupon) {
  if (!coupon) return new HttpError(404, "Coupon not found");
  if (coupon.is_deleted) return new HttpError(404, "Coupon not found");
  if (!coupon.is_active) return new HttpError(409, "Coupon is inactive");

  const now = new Date();
  if (coupon.start_date && new Date(coupon.start_date) > now) {
    return new HttpError(409, "Coupon campaign has not started");
  }
  if (coupon.end_date && new Date(coupon.end_date) < now) {
    return new HttpError(409, "Coupon campaign has expired");
  }
  return new HttpError(409, "Coupon assignment limit has been reached");
}

export function createCouponAssignmentService({
  repository = couponRepository,
  now = () => new Date(),
} = {}) {
  return {
    async assignEligibleCouponToUser(userId, couponId) {
      const existing = await repository.findUserCoupon(userId, couponId);
      if (existing) return existing;

      const session = await repository.startSession();
      let assignment;

      try {
        await session.withTransaction(async () => {
          const insideTransaction = await repository.findUserCoupon(
            userId,
            couponId,
            session,
          );
          if (insideTransaction) {
            assignment = insideTransaction;
            return;
          }

          const coupon = await repository.incrementAssignmentIfAvailable(
            couponId,
            now(),
            session,
          );
          if (!coupon) {
            const unavailableCoupon = await repository.findById(couponId, {
              includeDeleted: true,
              session,
            });
            throw unavailableError(unavailableCoupon);
          }

          assignment = await repository.createUserCoupon(
            { user_id: userId, coupon_id: couponId },
            session,
          );
        });
        return assignment;
      } catch (error) {
        if (error?.code === 11000) {
          const racedAssignment = await repository.findUserCoupon(
            userId,
            couponId,
          );
          if (racedAssignment) return racedAssignment;
        }
        throw error;
      } finally {
        await session.endSession();
      }
    },
  };
}
