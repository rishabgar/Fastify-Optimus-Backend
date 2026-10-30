import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhoneNumber } from "./utility.js";

test("normalizePhoneNumber returns a normalized E.164 phone number", () => {
  assert.equal(normalizePhoneNumber(" +91 (98765) 43210 "), "+919876543210");
});

test("normalizePhoneNumber rejects missing and invalid phone numbers", () => {
  assert.equal(normalizePhoneNumber(), null);
  assert.equal(normalizePhoneNumber("9876543210"), null);
  assert.equal(normalizePhoneNumber("+0123456789"), null);
});
