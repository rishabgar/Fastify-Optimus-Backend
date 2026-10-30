import assert from "node:assert/strict";
import { test } from "node:test";
import { createCouponAssignmentService } from "./coupon-assignment.service.js";

const userId = "64b000000000000000000001";
const couponId = "64b000000000000000000002";

test("assignment is idempotent when the user already has the coupon", async () => {
  const existing = { _id: "assignment", user_id: userId, coupon_id: couponId };
  const service = createCouponAssignmentService({
    repository: {
      async findUserCoupon() {
        return existing;
      },
      async startSession() {
        assert.fail("a transaction must not start for an existing assignment");
      },
    },
  });

  assert.equal(
    await service.assignEligibleCouponToUser(userId, couponId),
    existing,
  );
});

test("assignment increments and creates inside one transaction", async () => {
  const calls = [];
  let lookupCount = 0;
  const session = {
    async withTransaction(work) {
      calls.push("transaction:start");
      await work();
      calls.push("transaction:commit");
    },
    async endSession() {
      calls.push("session:end");
    },
  };
  const service = createCouponAssignmentService({
    repository: {
      async findUserCoupon() {
        lookupCount += 1;
        return null;
      },
      async startSession() {
        return session;
      },
      async incrementAssignmentIfAvailable(id, date, receivedSession) {
        assert.equal(id, couponId);
        assert.ok(date instanceof Date);
        assert.equal(receivedSession, session);
        calls.push("coupon:increment");
        return { _id: id };
      },
      async createUserCoupon(input, receivedSession) {
        assert.equal(receivedSession, session);
        calls.push("assignment:create");
        return { _id: "assignment", ...input };
      },
    },
  });

  const result = await service.assignEligibleCouponToUser(userId, couponId);

  assert.equal(lookupCount, 2);
  assert.equal(result._id, "assignment");
  assert.deepEqual(calls, [
    "transaction:start",
    "coupon:increment",
    "assignment:create",
    "transaction:commit",
    "session:end",
  ]);
});

test("assignment limit failure aborts without creating user coupon", async () => {
  let created = false;
  const session = {
    async withTransaction(work) {
      await work();
    },
    async endSession() {},
  };
  const service = createCouponAssignmentService({
    repository: {
      async findUserCoupon() {
        return null;
      },
      async startSession() {
        return session;
      },
      async incrementAssignmentIfAvailable() {
        return null;
      },
      async findById() {
        return { assignment_limit: 1, assigned_count: 1, is_active: true };
      },
      async createUserCoupon() {
        created = true;
      },
    },
  });

  await assert.rejects(
    service.assignEligibleCouponToUser(userId, couponId),
    (error) => error.statusCode === 409,
  );
  assert.equal(created, false);
});
