import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import couponModel from "./coupon.model.js";
import userCouponModel from "./user-coupon.model.js";

test("coupon model normalizes codes and applies campaign defaults", async () => {
  const coupon = new couponModel({
    code: "  welcome10  ",
    type: "percentage",
    value: 10,
  });

  await coupon.validate();

  assert.equal(coupon.code, "WELCOME10");
  assert.equal(coupon.min_order_value, 0);
  assert.equal(coupon.assignment_limit, null);
  assert.equal(coupon.assigned_count, 0);
  assert.equal(coupon.is_active, true);
  assert.equal(coupon.is_deleted, false);
});

test("coupon and user coupon models define required unique indexes", () => {
  const couponIndex = couponModel.schema
    .indexes()
    .find(([fields]) => fields.code === 1);
  const assignmentIndex = userCouponModel.schema
    .indexes()
    .find(
      ([fields]) => fields.user_id === 1 && fields.coupon_id === 1,
    );

  assert.equal(couponIndex[1].unique, true);
  assert.equal(assignmentIndex[1].unique, true);
});

test("user coupon applies assignment lifecycle defaults", async () => {
  const assignment = new userCouponModel({
    user_id: new Types.ObjectId(),
    coupon_id: new Types.ObjectId(),
  });

  await assignment.validate();

  assert.equal(assignment.status, "assigned");
  assert.ok(assignment.assigned_at instanceof Date);
  assert.equal(assignment.reserved_at, null);
  assert.equal(assignment.used_at, null);
});
