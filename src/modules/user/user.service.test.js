import assert from "node:assert/strict";
import { test } from "node:test";
import { createUserService } from "./user.service.js";

test("user service soft deletes a user", async () => {
  const repository = {
    async softDeleteById(userId) {
      assert.equal(userId, "user-1");
      return { _id: userId, is_deleted: true };
    },
  };
  const service = createUserService({ repository });

  assert.deepEqual(await service.softDelete("user-1"), {
    user_id: "user-1",
    is_deleted: true,
  });
});

test("user service reports an already deleted or missing user", async () => {
  const service = createUserService({
    repository: { async softDeleteById() { return null; } },
  });

  await assert.rejects(
    service.softDelete("user-1"),
    (error) => error.statusCode === 404 && error.message === "User not found",
  );
});
