import assert from "node:assert/strict";
import { test } from "node:test";
import { createCouponRedemptionService } from "./coupon-redemption.service.js";

const userId = "64b000000000000000000001";
const couponId = "64b000000000000000000002";

function coupon(overrides = {}) {
  return {
    _id: couponId,
    code: "SAVE20",
    type: "percentage",
    value: 20,
    min_order_value: 100,
    max_discount: 50,
    is_first_order: false,
    is_active: true,
    is_deleted: false,
    start_date: null,
    end_date: null,
    ...overrides,
  };
}

test("validation calculates percentage discount with a maximum cap", async () => {
  const service = createCouponRedemptionService({
    repository: {
      async findById() {
        return coupon();
      },
      async findUserCoupon() {
        return { status: "assigned" };
      },
    },
  });

  const result = await service.validateForCheckout(userId, couponId, 500);

  assert.equal(result.discount, 50);
  assert.equal(result.total_after_discount, 450);
});

test("validation checks order history for first-order coupons", async () => {
  const service = createCouponRedemptionService({
    repository: {
      async findById() {
        return coupon({ is_first_order: true });
      },
      async findUserCoupon() {
        return { status: "assigned" };
      },
    },
    firstOrderEligibility: {
      async isEligible(id) {
        assert.equal(id, userId);
        return false;
      },
    },
  });

  await assert.rejects(
    service.validateForCheckout(userId, couponId, 500),
    (error) => error.statusCode === 409,
  );
});

test("reservation uses an atomic assigned-to-reserved transition", async () => {
  let filter;
  let update;
  const service = createCouponRedemptionService({
    repository: {
      async transitionUserCoupon(receivedFilter, receivedUpdate) {
        filter = receivedFilter;
        update = receivedUpdate;
        return { status: "reserved" };
      },
    },
  });

  await service.reserve(userId, couponId);

  assert.deepEqual(filter, {
    user_id: userId,
    coupon_id: couponId,
    status: "assigned",
  });
  assert.equal(update.$set.status, "reserved");
  assert.ok(update.$set.reserved_at instanceof Date);
});
