import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../../../app.js";

test("GET /users/me returns the authenticated user's profile", async (t) => {
  const userService = {
    async getProfile(userId) {
      assert.equal(userId, "user-1");
      return {
        user_id: userId,
        first_name: "Jane",
        user_type: "customer",
        user_phone_no: "+919999999999",
        saved_addresses: [
          {
            address: "1 Market Street",
            coordinates: [77.5946, 12.9716],
            is_default: true,
          },
        ],
      };
    },
  };
  const authService = {
    async loginAdmin() {
      return { user_id: "user-1", role: "customer" };
    },
  };
  const app = buildApp({ connectDatabase: false, userService, authService });
  t.after(() => app.close());

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "user@example.com", password: "secret123" },
  });
  const token = loginResponse.json().data.token;
  const response = await app.inject({
    method: "GET",
    url: "/users/me",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "Request successful",
    data: {
      user_id: "user-1",
      first_name: "Jane",
      user_type: "customer",
      user_phone_no: "+919999999999",
      saved_addresses: [
        {
          address: "1 Market Street",
          coordinates: [77.5946, 12.9716],
          is_default: true,
        },
      ],
    },
  });
});

test("GET /users/me requires authentication", async (t) => {
  const app = buildApp({ connectDatabase: false, userService: {} });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/users/me" });
  assert.equal(response.statusCode, 401);
});

test("DELETE /users/me soft deletes the authenticated user", async (t) => {
  const userService = {
    async softDelete(userId) {
      assert.equal(userId, "user-1");
      return { user_id: userId, is_deleted: true };
    },
  };
  const authService = {
    async loginAdmin() {
      return { user_id: "user-1", role: "customer" };
    },
  };
  const app = buildApp({ connectDatabase: false, userService, authService });
  t.after(() => app.close());

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/admin/login",
    payload: { user_email: "user@example.com", password: "secret123" },
  });
  const token = loginResponse.json().data.token;
  const response = await app.inject({
    method: "DELETE",
    url: "/users/me",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "success",
    message: "User deleted successfully",
    data: { user_id: "user-1", is_deleted: true },
  });
});

test("DELETE /users/me requires authentication", async (t) => {
  const app = buildApp({ connectDatabase: false, userService: {} });
  t.after(() => app.close());

  const response = await app.inject({ method: "DELETE", url: "/users/me" });
  assert.equal(response.statusCode, 401);
});
