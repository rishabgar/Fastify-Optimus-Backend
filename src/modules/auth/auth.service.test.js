import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidFirebaseIdTokenError } from "../../shared/firebase/id-token-verifier.js";
import { createAuthService } from "./auth.service.js";

function phoneToken(phoneNumber = "+91 (98765) 43210") {
  return async () => ({
    phone_number: phoneNumber,
    firebase: { sign_in_provider: "phone" },
  });
}

test("auth service hashes the password and does not return it", async () => {
  let createdAdmin;
  const repository = {
    async findByEmail() {
      return null;
    },
    async createAdmin(admin) {
      createdAdmin = admin;
      return { _id: "admin-1", ...admin };
    },
  };
  const service = createAuthService({
    repository,
    hashPassword: async (password) => `hashed:${password}`,
  });

  const result = await service.registerAdmin({
    user_email: "admin@example.com",
    first_name: "Jane",
    password: "secret123",
    user_type: "admin",
  });

  assert.equal(createdAdmin.password, "hashed:secret123");
  assert.equal(result.password, undefined);
  assert.deepEqual(result, {
    id: "admin-1",
    user_email: "admin@example.com",
    first_name: "Jane",
    last_name: undefined,
    user_type: "admin",
  });
});

test("auth service rejects an existing email before hashing", async () => {
  let hashCalled = false;
  const repository = {
    async findByEmail() {
      return { id: "existing-admin" };
    },
    async createAdmin() {
      assert.fail("duplicate admin must not be created");
    },
  };
  const service = createAuthService({
    repository,
    hashPassword: async () => {
      hashCalled = true;
    },
  });

  await assert.rejects(
    service.registerAdmin({
      user_email: "admin@example.com",
      first_name: "Jane",
      password: "secret123",
      user_type: "admin",
    }),
    (error) => error.statusCode === 409,
  );
  assert.equal(hashCalled, false);
});

test("auth service authenticates an admin", async () => {
  const repository = {
    async findAdminByEmail(email) {
      assert.equal(email, "admin@example.com");
      return {
        _id: "admin-1",
        password: "hashed-password",
        user_type: "admin",
      };
    },
  };
  const service = createAuthService({
    repository,
    comparePassword: async (password, hash) => {
      assert.equal(password, "secret123");
      assert.equal(hash, "hashed-password");
      return true;
    },
  });

  const result = await service.loginAdmin({
    user_email: "admin@example.com",
    password: "secret123",
  });

  assert.deepEqual(result, { user_id: "admin-1", role: "admin" });
});

test("auth service rejects invalid admin credentials", async () => {
  const repository = {
    async findAdminByEmail() {
      return null;
    },
  };
  const service = createAuthService({ repository });

  await assert.rejects(
    service.loginAdmin({
      user_email: "missing@example.com",
      password: "secret123",
    }),
    (error) =>
      error.statusCode === 401 && error.message === "Invalid email or password",
  );
});

test("auth service registers a seller and shop in one transaction", async () => {
  const session = {
    async withTransaction(work) {
      await work();
    },
    async endSession() {
      this.ended = true;
    },
  };
  let createdSeller;
  let createdShop;
  const repository = {
    async startSession() {
      return session;
    },
    async findByEmail(email, receivedSession) {
      assert.equal(email, "seller@example.com");
      assert.equal(receivedSession, session);
      return null;
    },
    async findByPhone(phone, receivedSession) {
      assert.equal(phone, "+919876543210");
      assert.equal(receivedSession, session);
      return null;
    },
    async findActiveShopType(shopTypeId, receivedSession) {
      assert.equal(shopTypeId, "64b000000000000000000003");
      assert.equal(receivedSession, session);
      return { _id: shopTypeId };
    },
    async createSeller(input, receivedSession) {
      assert.equal(receivedSession, session);
      createdSeller = { _id: "seller-1", user_location: {}, ...input };
      return createdSeller;
    },
    async createSellerShop(input, receivedSession) {
      assert.equal(receivedSession, session);
      createdShop = { _id: "shop-1", ...input };
      return createdShop;
    },
  };
  const service = createAuthService({ repository });

  const result = await service.registerSeller({
    user_email: "seller@example.com",
    user_phone_no: "+919876543210",
    first_name: "Jane",
    shop_name: "Jane's Store",
    shop_address: "123 Main Street",
    shop_type_id: "64b000000000000000000003",
    operating_hours: { open: "09:00", close: "18:00" },
    coordinates: [77.5, 12.9],
  });

  assert.equal(createdSeller.password, undefined);
  assert.equal(createdSeller.user_type, "seller");
  assert.equal(createdShop.seller_id, "seller-1");
  assert.deepEqual(result, { seller_id: "seller-1", shop_id: "shop-1" });
  assert.equal(session.ended, true);
});

test("auth service aborts seller signup when shop creation fails", async () => {
  const session = {
    async withTransaction(work) {
      try {
        await work();
      } catch (error) {
        this.aborted = true;
        throw error;
      }
    },
    async endSession() {
      this.ended = true;
    },
  };
  const repository = {
    async startSession() {
      return session;
    },
    async findByEmail() {
      return null;
    },
    async findByPhone() {
      return null;
    },
    async findActiveShopType() {
      return { _id: "shop-type-1" };
    },
    async createSeller(input) {
      return { _id: "seller-1", ...input };
    },
    async createSellerShop() {
      throw new Error("shop write failed");
    },
  };
  const service = createAuthService({ repository });

  await assert.rejects(
    service.registerSeller({
      user_phone_no: "+919876543210",
      first_name: "Jane",
      shop_type_id: "shop-type-1",
    }),
    /shop write failed/,
  );
  assert.equal(session.aborted, true);
  assert.equal(session.ended, true);
});

test("auth service creates development claims for sellers and customers", async () => {
  const repository = {
    async findByEmail(userEmail) {
      assert.equal(userEmail, "seller@example.com");
      return { _id: "seller-1", user_type: "seller" };
    },
  };
  const service = createAuthService({ repository });

  assert.deepEqual(
    await service.getDevelopmentTokenClaims("seller@example.com"),
    { user_id: "seller-1", role: "seller" },
  );
});

test("auth service rejects development tokens for unsupported roles", async () => {
  const repository = {
    async findByEmail() {
      return { _id: "admin-1", user_type: "admin" };
    },
  };
  const service = createAuthService({ repository });

  await assert.rejects(
    service.getDevelopmentTokenClaims("admin@example.com"),
    (error) => error.statusCode === 403,
  );
});

test("auth service registers only customer data without seller/shop writes", async () => {
  let createdCustomer;
  const repository = {
    async findByPhone(phone) {
      assert.equal(phone, "+919876543210");
      return null;
    },
    async findByEmail(email) {
      assert.equal(email, "jane@example.com");
      return null;
    },
    async createCustomer(customer) {
      createdCustomer = customer;
      return { _id: "customer-1", ...customer };
    },
    async createSeller() {
      assert.fail("customer signup must not create a seller");
    },
    async createSellerShop() {
      assert.fail("customer signup must not create a shop");
    },
  };
  const service = createAuthService({ repository });

  const result = await service.registerCustomer({
    user_phone_no: "+919876543210",
    user_email: "jane@example.com",
    first_name: "Jane",
    saved_addresses: [
      {
        address: "123 Main Street",
        is_default: true,
      },
    ],
    coordinates: [77.5946, 12.9716],
  });

  assert.deepEqual(createdCustomer, {
    user_phone_no: "+919876543210",
    user_email: "jane@example.com",
    first_name: "Jane",
    saved_addresses: [
      {
        address: "123 Main Street",
        coordinates: [77.5946, 12.9716],
        is_default: true,
      },
    ],
    user_type: "customer",
  });
  assert.deepEqual(result, {
    id: "customer-1",
    user_phone_no: "+919876543210",
    user_email: "jane@example.com",
    first_name: "Jane",
    last_name: undefined,
    profile_image: undefined,
    saved_addresses: [
      {
        address: "123 Main Street",
        coordinates: [77.5946, 12.9716],
        is_default: true,
      },
    ],
    user_type: "customer",
  });
});

test("auth service allows customer signup without email", async () => {
  let emailLookupCalled = false;
  const service = createAuthService({
    repository: {
      async findByPhone() {
        return null;
      },
      async findByEmail() {
        emailLookupCalled = true;
      },
      async createCustomer(customer) {
        return { _id: "customer-1", ...customer };
      },
    },
  });

  await service.registerCustomer({
    user_phone_no: "+919876543210",
    first_name: "Jane",
  });

  assert.equal(emailLookupCalled, false);
});

test("auth service maps customer phone and email conflicts", async () => {
  const duplicatePhoneService = createAuthService({
    repository: {
      async findByPhone() {
        return { user_type: "customer" };
      },
    },
  });
  const duplicateEmailService = createAuthService({
    repository: {
      async findByPhone() {
        return null;
      },
      async findByEmail() {
        return { user_type: "seller" };
      },
    },
  });

  await assert.rejects(
    duplicatePhoneService.registerCustomer({
      user_phone_no: "+919876543210",
      first_name: "Jane",
    }),
    (error) =>
      error.statusCode === 409 &&
      error.message === "Phone number already registered",
  );
  await assert.rejects(
    duplicateEmailService.registerCustomer({
      user_phone_no: "+919876543210",
      user_email: "jane@example.com",
      first_name: "Jane",
    }),
    (error) =>
      error.statusCode === 409 && error.message === "Email is already registered",
  );
});

test("auth service normalizes a verified Firebase phone", async () => {
  const service = createAuthService({ verifyIdToken: phoneToken() });

  assert.equal(
    await service.verifyDeliveryPartnerPhone("token"),
    "+919876543210",
  );
});

test("auth service rejects invalid Firebase tokens and phone claims", async () => {
  const invalidTokenService = createAuthService({
    verifyIdToken: async () => {
      throw new InvalidFirebaseIdTokenError();
    },
  });
  const missingPhoneService = createAuthService({
    verifyIdToken: phoneToken(null),
  });

  await assert.rejects(
    invalidTokenService.verifyDeliveryPartnerPhone("token"),
    (error) => error.statusCode === 401,
  );
  await assert.rejects(
    missingPhoneService.verifyDeliveryPartnerPhone("token"),
    (error) =>
      error.statusCode === 400 && error.details.field === "user_phone_no",
  );
});

test("auth service creates a delivery partner from the verified phone", async () => {
  let createdUser;
  const repository = {
    async findByPhone(phone) {
      assert.equal(phone, "+919876543210");
      return null;
    },
    async findByEmail(email) {
      assert.equal(email, "jane@example.com");
      return null;
    },
    async createDeliveryPartner(user) {
      createdUser = user;
      return { _id: "partner-1", ...user };
    },
  };
  const service = createAuthService({
    repository,
    verifyIdToken: phoneToken(),
  });

  const result = await service.registerDeliveryPartner({
    idToken: "token",
    first_name: "Jane",
    user_email: "jane@example.com",
    vehicle_type: "bike",
  });

  assert.deepEqual(createdUser, {
    first_name: "Jane",
    user_email: "jane@example.com",
    vehicle_type: "bike",
    user_phone_no: "+919876543210",
    user_type: "delivery_partner",
  });
  assert.equal(result.id, "partner-1");
  assert.equal(result.user_type, "delivery_partner");
});

test("auth service prevents duplicate delivery-partner accounts", async () => {
  const service = createAuthService({
    verifyIdToken: phoneToken(),
    repository: {
      async findByPhone() {
        return { user_type: "delivery_partner" };
      },
    },
  });

  await assert.rejects(
    service.registerDeliveryPartner({ idToken: "token", first_name: "Jane" }),
    (error) =>
      error.statusCode === 409 &&
      error.message === "Delivery partner already registered",
  );
});

test("auth service reports another duplicate unique field", async () => {
  const service = createAuthService({
    verifyIdToken: phoneToken(),
    repository: {
      async findByPhone() {
        return null;
      },
      async findByEmail() {
        return { user_type: "customer" };
      },
    },
  });

  await assert.rejects(
    service.registerDeliveryPartner({
      idToken: "token",
      first_name: "Jane",
      user_email: "jane@example.com",
    }),
    (error) =>
      error.statusCode === 409 && error.message === "User already registered",
  );
});
