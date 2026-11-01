import { requireCustomer, requireDeliveryPartner } from "../../shared/http/auth-guards.js";
import { createPaymentController } from "./payment.controller.js";

const params = { type: "object", additionalProperties: false, required: ["order_id"], properties: { order_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" } } };
export default async function paymentRoutes(app, { service }) {
  const controller = createPaymentController(service);
  app.get("/orders/:order_id/status", { onRequest: requireCustomer, schema: { params } }, controller.status);
  app.post("/orders/:order_id/link", { onRequest: requireCustomer, schema: { params } }, controller.createLink);
  app.post("/orders/:order_id/cash-collection", { onRequest: requireDeliveryPartner, schema: { params } }, controller.confirmCash);
  app.post("/cashfree/webhook", controller.webhook);
}
