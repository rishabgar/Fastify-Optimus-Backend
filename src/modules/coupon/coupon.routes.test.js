import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

const jwtSecret = "test-jwt-secret";
const userId = "64b000000000000000000001";
const couponId = "64b000000000000000000002";

function buildTestApp({ role, campaignService = {}, redemptionService = {} }) {
  return buildApp({
    connectDatabase: false,
    jwtSecret,
    couponCampaignService: campaignService,
    couponRedemptionService: redemptionService,
    authService: {
      async loginAdmin() {
        return { user_id: userId, role };
      },
    },
  });
}

async function tokenFor(app) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "person@example.com", password: "secret123" },
  });
  return response.json().data.token;
}

test("admin coupon APIs require an admin token", async (t) => {
  const app = buildTestApp({ role: "customer" });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "GET",
    url: "/admin/coupons",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 403);
});

test("admin can create a validated coupon campaign", async (t) => {
  let received;
  const app = buildTestApp({
    role: "admin",
    campaignService: {
      async create(input) {
        received = input;
        return { _id: couponId, ...input };
      },
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: "/admin/coupons",
    headers: { authorization: `Bearer ${token}` },
    payload: { code: "SAVE10", type: "percentage", value: 10 },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(received.code, "SAVE10");
});

test("coupon validation derives the user from authentication", async (t) => {
  let receivedUserId;
  const app = buildTestApp({
    role: "customer",
    redemptionService: {
      async validateForCheckout(actorId, id, subtotal) {
        receivedUserId = actorId;
        assert.equal(id, couponId);
        assert.equal(subtotal, 500);
        return { coupon_id: id, discount: 50 };
      },
    },
  });
  t.after(() => app.close());
  const token = await tokenFor(app);

  const response = await app.inject({
    method: "POST",
    url: `/coupons/${couponId}/validate`,
    headers: { authorization: `Bearer ${token}` },
    payload: { subtotal: 500, user_id: "64b000000000000000000009" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedUserId, userId);
});
