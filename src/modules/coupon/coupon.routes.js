import {
  requireAdmin,
  requireCustomer,
} from "../../shared/http/auth-guards.js";
import { createCouponController } from "./coupon.controller.js";
import {
  adminCouponListSchema,
  couponParamsSchema,
  couponStatusSchema,
  createCouponSchema,
  updateCouponSchema,
  userCouponListSchema,
} from "./coupon.schema.js";

export default async function couponRoutes(app, services) {
  const controller = createCouponController(services);
  const adminOnly = { onRequest: requireAdmin };
  const customerOnly = { onRequest: requireCustomer };

  app.post(
    "/admin/coupons",
    { ...adminOnly, schema: { body: createCouponSchema } },
    controller.create,
  );
  app.get(
    "/admin/coupons",
    { ...adminOnly, schema: { querystring: adminCouponListSchema } },
    controller.listAdmin,
  );
  app.get(
    "/admin/coupons/:coupon_id",
    { ...adminOnly, schema: { params: couponParamsSchema } },
    controller.getById,
  );
  app.patch(
    "/admin/coupons/:coupon_id",
    {
      ...adminOnly,
      schema: { params: couponParamsSchema, body: updateCouponSchema },
    },
    controller.update,
  );
  app.patch(
    "/admin/coupons/:coupon_id/status",
    {
      ...adminOnly,
      schema: { params: couponParamsSchema, body: couponStatusSchema },
    },
    controller.setActive,
  );
  app.delete(
    "/admin/coupons/:coupon_id",
    { ...adminOnly, schema: { params: couponParamsSchema } },
    controller.remove,
  );
  app.get(
    "/coupons",
    { ...customerOnly, schema: { querystring: userCouponListSchema } },
    controller.listForUser,
  );
}
