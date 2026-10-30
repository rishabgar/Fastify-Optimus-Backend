import assert from "node:assert/strict";
import { test } from "node:test";
import { fail, success } from "./response.js";

function createReply() {
  return {
    statusCode: null,
    payload: null,
    code(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("success sends the standard success response", () => {
  const reply = createReply();

  success(reply, { message: "Created", data: { id: 1 }, statusCode: 201 });

  assert.equal(reply.statusCode, 201);
  assert.deepEqual(reply.payload, {
    status: "success",
    message: "Created",
    data: { id: 1 },
  });
});

test("fail sends the standard failure response", () => {
  const reply = createReply();

  fail(reply, {
    message: "Invalid request",
    statusCode: 422,
  });

  assert.equal(reply.statusCode, 422);
  assert.deepEqual(reply.payload, {
    status: "fail",
    message: "Invalid request",
    data: null,
  });
});
