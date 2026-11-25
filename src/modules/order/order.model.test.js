import assert from "node:assert/strict";
import test from "node:test";
import { orderModel } from "./order.model.js";

test("order model makes customer idempotency keys unique", () => {
  const index = orderModel.schema.indexes().find(
    ([fields]) => fields.customer_id === 1 && fields.idempotency_key === 1,
  );

  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.equal(index[1].partialFilterExpression.idempotency_key.$type, "string");
});
