import { requireAdmin, requireCustomer, requireDeliveryPartner, requireSeller } from "../../shared/http/auth-guards.js";
import { createOrderController } from "./order.controller.js";
import { cancelSchema, deliveryEarningSchema, idParamsSchema, otpSchema, placeOrderSchema, rejectSchema, shopOrderParamsSchema } from "./order.schema.js";

export default async function orderRoutes(app, { service }) {
  const controller = createOrderController(service);
  app.post("/", { onRequest: requireCustomer, schema: { body: placeOrderSchema } }, controller.place);
  app.get("/checkout-preview", { onRequest: requireCustomer }, controller.preview);
  app.get("/mine", { onRequest: requireCustomer }, controller.listMine);
  app.get("/history", { onRequest: requireCustomer }, controller.listHistory);
  app.get("/:order_id", { onRequest: requireCustomer, schema: { params: idParamsSchema } }, controller.detail);
  app.patch("/:order_id/cancel", { onRequest: requireCustomer, schema: { params: idParamsSchema, body: cancelSchema } }, controller.cancel);
  app.get("/seller", { onRequest: requireSeller }, controller.listSeller);
  app.get("/seller/earnings", { onRequest: requireSeller }, controller.sellerEarnings);
  app.patch("/:order_id/shop-orders/:shop_order_id/accept", { onRequest: requireSeller, schema: { params: shopOrderParamsSchema } }, controller.sellerAccept);
  app.patch("/:order_id/shop-orders/:shop_order_id/pack", { onRequest: requireSeller, schema: { params: shopOrderParamsSchema } }, controller.sellerPack);
  app.patch("/:order_id/shop-orders/:shop_order_id/reject", { onRequest: requireSeller, schema: { params: shopOrderParamsSchema, body: rejectSchema } }, controller.sellerReject);
  app.get("/delivery/tasks", { onRequest: requireDeliveryPartner }, controller.availableTasks);
  app.get("/delivery/my-tasks", { onRequest: requireDeliveryPartner }, controller.myTasks);
  app.get("/delivery/earnings", { onRequest: requireDeliveryPartner }, controller.deliveryEarnings);
  app.patch("/:order_id/delivery/earning", { onRequest: requireAdmin, schema: { params: idParamsSchema, body: deliveryEarningSchema } }, controller.setDeliveryEarning);
  app.patch("/:order_id/delivery/accept", { onRequest: requireDeliveryPartner, schema: { params: idParamsSchema } }, controller.acceptTask);
  app.patch("/:order_id/shop-orders/:shop_order_id/pickup", { onRequest: requireDeliveryPartner, schema: { params: shopOrderParamsSchema, body: otpSchema } }, controller.verifyPickup);
  app.patch("/:order_id/delivery/customer-otp", { onRequest: requireDeliveryPartner, schema: { params: idParamsSchema, body: otpSchema } }, controller.verifyCustomerOtp);
  app.patch("/:order_id/delivery/complete", { onRequest: requireDeliveryPartner, schema: { params: idParamsSchema } }, controller.completeDelivery);
}
