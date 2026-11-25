import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

test("POST /shop-types creates a shop type without authentication", async (t) => {
  let receivedInput;
  const app = buildApp({
    connectDatabase: false,
    jwtSecret: "test-jwt-secret",
    shopTypeService: {
      async create(input) {
        receivedInput = input;
        return { _id: "shop-type-id", ...input };
      },
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/shop-types",
    payload: {
      shop_type_name: "Pharmacy",
      shop_type_image: "https://example.com/pharmacy.png",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedInput, {
    shop_type_name: "Pharmacy",
    shop_type_image: "https://example.com/pharmacy.png",
  });
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Shop type created successfully",
    data: {
      _id: "shop-type-id",
      shop_type_name: "Pharmacy",
      shop_type_image: "https://example.com/pharmacy.png",
    },
  });
});

test("POST /shop-types validates required fields and rejects unknown fields", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    jwtSecret: "test-jwt-secret",
    shopTypeService: {},
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/shop-types",
    payload: {
      shop_type_name: "Pharmacy",
      is_active: false,
    },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(Object.keys(response.json()).sort(), [
    "data",
    "message",
    "status",
  ]);
  assert.equal(response.json().status, "fail");
  assert.equal(response.json().data, null);
});
