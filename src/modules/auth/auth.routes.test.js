import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";
import { HttpError } from "../../shared/http/http-error.js";

const jwtSecret = "test-jwt-secret";

test("POST /auth/admin/signup registers a normalized admin", async (t) => {
  let receivedInput;
  const authService = {
    async registerAdmin(input) {
      receivedInput = input;
      return {
        id: "admin-1",
        user_email: input.user_email,
        first_name: input.first_name,
        last_name: input.last_name,
        user_type: input.user_type,
      };
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/signup",
    payload: {
      user_email: "  ADMIN@EXAMPLE.COM  ",
      first_name: "  Jane  ",
      last_name: "  Doe  ",
      password: "  secret123  ",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedInput, {
    user_email: "admin@example.com",
    first_name: "Jane",
    last_name: "Doe",
    password: "secret123",
    user_type: "admin",
  });
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Admin registered successfully",
    data: {
      id: "admin-1",
      user_email: "admin@example.com",
      first_name: "Jane",
      last_name: "Doe",
      user_type: "admin",
    },
  });
});

test("POST /auth/admin/signup rejects invalid input", async (t) => {
  const authService = {
    async registerAdmin() {
      assert.fail("service must not run for invalid input");
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/signup",
    payload: {
      user_email: "invalid",
      first_name: "",
      password: "123",
      user_type: "customer",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.deepEqual(Object.keys(body), ["status", "message", "data"]);
  assert.equal(body.status, "fail");
  assert.equal(typeof body.message, "string");
  assert.equal(body.data, null);
});

test("POST /auth/admin/signup reports duplicate email", async (t) => {
  const authService = {
    async registerAdmin() {
      throw new HttpError(409, "Email is already registered", {
        field: "user_email",
      });
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/signup",
    payload: {
      user_email: "admin@example.com",
      first_name: "Jane",
      password: "secret123",
    },
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    status: "fail",
    message: "Email is already registered",
    data: null,
  });
});

test("POST /auth/admin/login returns a JWT with admin claims", async (t) => {
  let receivedInput;
  const authService = {
    async loginAdmin(input) {
      receivedInput = input;
      return { user_id: "admin-1", role: "admin" };
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: {
      user_email: "  ADMIN@EXAMPLE.COM  ",
      password: " secret123 ",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedInput, {
    user_email: "admin@example.com",
    password: " secret123 ",
  });

  const body = response.json();
  assert.equal(body.status, "success");
  assert.equal(body.message, "Admin logged in successfully");
  assert.equal(body.data.admin_id, "admin-1");
  assert.equal(typeof body.data.token, "string");

  const payload = JSON.parse(
    Buffer.from(body.data.token.split(".")[1], "base64url").toString(),
  );
  assert.equal(payload.user_id, "admin-1");
  assert.equal(payload.role, "admin");
});

test("POST /auth/admin/login rejects invalid input", async (t) => {
  const authService = {
    async loginAdmin() {
      assert.fail("service must not run for invalid input");
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "invalid", password: "" },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.deepEqual(Object.keys(body), ["status", "message", "data"]);
  assert.equal(body.status, "fail");
  assert.equal(typeof body.message, "string");
  assert.equal(body.data, null);
});

test("POST /auth/dev/token creates a seller token in development", async (t) => {
  const authService = {
    async getDevelopmentTokenClaims(userEmail) {
      assert.equal(userEmail, "seller@example.com");
      return { user_id: "seller-1", role: "seller" };
    },
  };
  const app = buildApp({
    connectDatabase: false,
    authService,
    jwtSecret,
    isDevelopment: true,
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/dev/token",
    payload: { user_email: "  SELLER@EXAMPLE.COM  " },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.status, "success");
  assert.equal(body.data.user_id, "seller-1");
  assert.equal(body.data.role, "seller");
  assert.equal(typeof body.data.token, "string");

  const payload = JSON.parse(
    Buffer.from(body.data.token.split(".")[1], "base64url").toString(),
  );
  assert.equal(payload.user_id, "seller-1");
  assert.equal(payload.role, "seller");
});

test("POST /auth/dev/token is unavailable outside development", async (t) => {
  const app = buildApp({
    connectDatabase: false,
    authService: {},
    jwtSecret,
    isDevelopment: false,
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/dev/token",
    payload: { user_email: "seller@example.com" },
  });

  assert.equal(response.statusCode, 404);
});

test("POST /auth/seller/signup registers a seller and first shop", async (t) => {
  let receivedInput;
  const authService = {
    async registerSeller(input) {
      receivedInput = input;
      return {
        seller_id: "64b000000000000000000001",
        shop_id: "64b000000000000000000002",
      };
    },
  };
  const app = buildApp({ connectDatabase: false, authService });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/seller/signup",
    payload: {
      user_email: "  SELLER@EXAMPLE.COM  ",
      user_phone_no: "+919876543210",
      first_name: "  Jane  ",
      last_name: "  Doe  ",
      shop_name: "  Jane's Store  ",
      shop_address: "  123 Main Street  ",
      operating_hours: { open: "09:00", close: "18:00" },
      shop_type_id: "64b000000000000000000003",
      coordinates: [77.5946, 12.9716],
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(receivedInput.user_email, "seller@example.com");
  assert.equal(receivedInput.first_name, "Jane");
  assert.equal(receivedInput.shop_name, "Jane's Store");
  assert.equal(receivedInput.seller_id, undefined);
  const body = response.json();
  assert.deepEqual(Object.keys(body.data), ["seller_id", "shop_id", "token"]);
  assert.equal(body.data.seller_id, "64b000000000000000000001");
  assert.equal(body.data.shop_id, "64b000000000000000000002");
  const tokenPayload = JSON.parse(
    Buffer.from(body.data.token.split(".")[1], "base64url").toString(),
  );
  assert.equal(tokenPayload.user_id, "64b000000000000000000001");
  assert.equal(tokenPayload.role, "seller");
});

test("POST /auth/seller/signup rejects client supplied seller_id", async (t) => {
  const authService = {
    async registerSeller() {
      assert.fail("service must not run for invalid input");
    },
  };
  const app = buildApp({ connectDatabase: false, authService });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/seller/signup",
    payload: {
      user_phone_no: "+919876543210",
      first_name: "Jane",
      shop_name: "Jane's Store",
      shop_address: "123 Main Street",
      seller_id: "64b000000000000000000001",
      operating_hours: { open: "09:00", close: "18:00" },
      shop_type_id: "64b000000000000000000003",
      coordinates: [77.5946, 12.9716],
    },
  });

  assert.equal(response.statusCode, 400);
});

test("POST /auth/customer/signup registers a normalized customer", async (t) => {
  let receivedInput;
  const authService = {
    async registerCustomer(input) {
      receivedInput = input;
      const { coordinates, saved_addresses, ...customer } = input;
      return {
        id: "customer-1",
        ...customer,
        saved_addresses: saved_addresses?.map((savedAddress) => ({
          ...savedAddress,
          coordinates,
        })),
        user_type: "customer",
      };
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/customer/signup",
    payload: {
      user_phone_no: " +91 (98765) 43210 ",
      user_email: "  CUSTOMER@EXAMPLE.COM ",
      user_type: "seller",
      first_name: "  Jane ",
      last_name: " Doe ",
      profile_image: " https://example.com/customer.jpg ",
      saved_addresses: [
        {
          address: "  123 Main Street  ",
          is_default: true,
        },
      ],
      coordinates: [77.5946, 12.9716],
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedInput, {
    user_phone_no: "+919876543210",
    user_email: "customer@example.com",
    first_name: "Jane",
    last_name: "Doe",
    profile_image: "https://example.com/customer.jpg",
    saved_addresses: [
      {
        address: "123 Main Street",
        is_default: true,
      },
    ],
    coordinates: [77.5946, 12.9716],
  });
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Customer registered successfully",
    data: {
      user_id: "customer-1",
      first_name: "Jane",
      token: response.json().data.token,
    },
  });
  assert.equal(typeof response.json().data.token, "string");
  const tokenPayload = JSON.parse(
    Buffer.from(
      response.json().data.token.split(".")[1],
      "base64url",
    ).toString(),
  );
  assert.equal(tokenPayload.user_id, "customer-1");
  assert.equal(tokenPayload.role, "customer");
});

test("POST /auth/customer/signup accepts no email", async (t) => {
  const authService = {
    async registerCustomer(input) {
      return { id: "customer-1", ...input, user_type: "customer" };
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/customer/signup",
    payload: { user_phone_no: "+919876543210", first_name: "Jane" },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(Object.keys(response.json().data), [
    "user_id",
    "first_name",
    "token",
  ]);
});

test("POST /auth/customer/signup rejects invalid and controlled fields", async (t) => {
  const authService = {
    async registerCustomer() {
      assert.fail("service must not run for invalid input");
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const responses = await Promise.all([
    app.inject({
      method: "POST",
      url: "/auth/customer/signup",
      payload: { user_phone_no: "9876543210", first_name: "Jane" },
    }),
    app.inject({
      method: "POST",
      url: "/auth/customer/signup",
      payload: {
        user_phone_no: "+919876543210",
        first_name: "Jane",
        is_deleted: false,
      },
    }),
    app.inject({
      method: "POST",
      url: "/auth/customer/signup",
      payload: {
        user_phone_no: "+919876543210",
        first_name: "Jane",
        user_email: "invalid",
      },
    }),
  ]);

  assert.deepEqual(
    responses.map((response) => response.statusCode),
    [400, 400, 400],
  );
});

test("POST /auth/customer/signup requires coordinates for saved addresses", async (t) => {
  const authService = {
    async registerCustomer() {
      assert.fail("service must not run for invalid input");
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/customer/signup",
    payload: {
      user_phone_no: "+919876543210",
      first_name: "Jane",
      saved_addresses: [{ address: "123 Main Street" }],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(Object.keys(response.json()), ["status", "message", "data"]);
  assert.equal(response.json().status, "fail");
  assert.equal(response.json().data, null);
});

test("POST /auth/delivery-partner/verify-phone returns the verified phone", async (t) => {
  const authService = {
    async verifyDeliveryPartnerPhone(idToken) {
      assert.equal(idToken, "firebase-id-token");
      return "+919876543210";
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/delivery-partner/verify-phone",
    payload: { idToken: "firebase-id-token" },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Phone number verified successfully",
    data: { user_phone_no: "+919876543210", verified: true },
  });
});

test("POST /auth/delivery-partner/signup registers normalized input", async (t) => {
  let receivedInput;
  const authService = {
    async registerDeliveryPartner(input) {
      receivedInput = input;
      return {
        id: "partner-1",
        user_phone_no: "+919876543210",
        first_name: input.first_name,
        last_name: input.last_name,
        user_email: input.user_email,
        vehicle_type: input.vehicle_type,
        user_type: "delivery_partner",
      };
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/auth/delivery-partner/signup",
    payload: {
      idToken: "firebase-id-token",
      first_name: "  Jane  ",
      last_name: "  Doe  ",
      user_email: "  JANE@EXAMPLE.COM  ",
      vehicle_type: "bike",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(receivedInput, {
    idToken: "firebase-id-token",
    first_name: "Jane",
    last_name: "Doe",
    user_email: "jane@example.com",
    vehicle_type: "bike",
  });
  assert.deepEqual(response.json().data, {
    id: "partner-1",
    user_phone_no: "+919876543210",
    first_name: "Jane",
    last_name: "Doe",
    user_email: "jane@example.com",
    vehicle_type: "bike",
    user_type: "delivery_partner",
  });
});

test("delivery-partner auth routes reject missing required input", async (t) => {
  const authService = {
    async verifyDeliveryPartnerPhone() {
      assert.fail("service must not run for invalid input");
    },
    async registerDeliveryPartner() {
      assert.fail("service must not run for invalid input");
    },
  };
  const app = buildApp({ connectDatabase: false, authService, jwtSecret });
  t.after(() => app.close());

  const verifyResponse = await app.inject({
    method: "POST",
    url: "/auth/delivery-partner/verify-phone",
    payload: {},
  });
  const signupResponse = await app.inject({
    method: "POST",
    url: "/auth/delivery-partner/signup",
    payload: { idToken: "firebase-id-token" },
  });

  assert.equal(verifyResponse.statusCode, 400);
  assert.equal(signupResponse.statusCode, 400);
});
