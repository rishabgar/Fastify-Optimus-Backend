import assert from "node:assert/strict";
import { test } from "node:test";
import { createCouponCampaignService } from "./coupon-campaign.service.js";

const couponId = "64b000000000000000000002";

test("campaign creation normalizes coupon codes", async () => {
  let created;
  const service = createCouponCampaignService({
    repository: {
      async findByCode(code) {
        assert.equal(code, "SAVE10");
        return null;
      },
      async create(input) {
        created = input;
        return input;
      },
    },
  });

  await service.create({ code: " save10 ", type: "percentage", value: 10 });

  assert.equal(created.code, "SAVE10");
});

test("campaign rejects invalid date ranges", async () => {
  const service = createCouponCampaignService({ repository: {} });

  await assert.rejects(
    service.create({
      code: "SAVE10",
      type: "fixed",
      value: 10,
      start_date: "2027-02-01T00:00:00.000Z",
      end_date: "2027-01-01T00:00:00.000Z",
    }),
    (error) => error.statusCode === 400 && error.details.field === "end_date",
  );
});

test("campaign update cannot reduce limit below assigned count", async () => {
  const service = createCouponCampaignService({
    repository: {
      async findById() {
        return {
          _id: couponId,
          code: "SAVE10",
          type: "fixed",
          value: 10,
          assigned_count: 5,
        };
      },
    },
  });

  await assert.rejects(
    service.update(couponId, { assignment_limit: 4 }),
    (error) => error.statusCode === 400 || error.statusCode === 409,
  );
});
