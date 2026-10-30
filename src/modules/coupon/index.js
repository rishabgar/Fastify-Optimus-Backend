import fastifyJwt from "@fastify/jwt";
import { createCouponAssignmentService } from "./coupon-assignment.service.js";
import { createCouponCampaignService } from "./coupon-campaign.service.js";
import couponModel from "./coupon.model.js";
import { createCouponRedemptionService } from "./coupon-redemption.service.js";
import couponRoutes from "./coupon.routes.js";
import userCouponModel from "./user-coupon.model.js";

export { couponModel } from "./coupon.model.js";
export { userCouponModel } from "./user-coupon.model.js";
export { createCouponAssignmentService } from "./coupon-assignment.service.js";
export { createCouponRedemptionService } from "./coupon-redemption.service.js";

export default async function couponModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");

  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("couponModel", couponModel);
  app.decorate("userCouponModel", userCouponModel);

  const campaignService =
    options.couponCampaignService ?? createCouponCampaignService();
  const redemptionService =
    options.couponRedemptionService ?? createCouponRedemptionService();
  const assignmentService =
    options.couponAssignmentService ?? createCouponAssignmentService();

  app.decorate("couponAssignmentService", assignmentService);
  app.decorate("couponRedemptionService", redemptionService);
  await app.register(couponRoutes, { campaignService, redemptionService });
}
