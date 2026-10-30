import assert from "node:assert/strict";
import { test } from "node:test";
import { userModel } from "./user.model.js";

test("user model applies required fields and defaults", async () => {
  const user = new userModel({
    first_name: "  Jane  ",
    user_type: "customer",
    user_phone_no: "9876543210",
  });

  await user.validate();
  assert.equal(user.first_name, "Jane");
  assert.equal(user.active_orders, 0);
  assert.equal(user.reward_tokens, 0);
  assert.equal(user.first_order_discount_used, false);
  assert.equal(user.is_deleted, false);
  assert.deepEqual(user.fcm_tokens, []);
  assert.equal(userModel.schema.options.timestamps, true);
  assert.equal(userModel.schema.options.versionKey, false);
  assert.equal(userModel.schema.path("createdAt").instance, "Date");
  assert.equal(userModel.schema.path("updatedAt").instance, "Date");
  assert.equal(userModel.schema.path("__v"), undefined);
});

test("authentication fields are optional at the model layer", async () => {
  const admin = new userModel({
    first_name: "Admin",
    user_type: "admin",
  });

  await admin.validate();
  assert.equal(userModel.schema.path("password").options.select, false);

  const user = new userModel({
    first_name: "Jane",
    user_type: "seller",
    password: "password123",
  });

  await user.validate();
});

test("user model defines the geospatial index", () => {
  const hasLocationIndex = userModel.schema
    .indexes()
    .some(([fields]) => fields.user_location === "2dsphere");

  assert.equal(hasLocationIndex, true);
});

test("user model defines a soft-delete index", () => {
  assert.equal(
    userModel.schema
      .indexes()
      .some(([fields]) => fields.is_deleted === 1),
    true,
  );
});

test("user model defines partial unique authentication indexes", () => {
  const indexes = userModel.schema.indexes();
  const emailIndex = indexes.find(([fields]) => fields.user_email === 1);
  const phoneIndex = indexes.find(([fields]) => fields.user_phone_no === 1);

  assert.deepEqual(emailIndex?.[1], {
    unique: true,
    partialFilterExpression: {
      user_email: { $type: "string" },
    },
  });
  assert.deepEqual(phoneIndex?.[1], {
    unique: true,
    partialFilterExpression: {
      user_phone_no: { $type: "string" },
    },
  });
});
