import { success } from "../../shared/http/response.js";

export function createCouponController({ campaignService, redemptionService }) {
  return {
    async create(request, reply) {
      const coupon = await campaignService.create(request.body);
      return success(reply, {
        statusCode: 201,
        message: "Coupon created successfully",
        data: coupon,
      });
    },

    async update(request, reply) {
      const coupon = await campaignService.update(
        request.params.coupon_id,
        request.body,
      );
      return success(reply, {
        message: "Coupon updated successfully",
        data: coupon,
      });
    },

    async remove(request, reply) {
      const coupon = await campaignService.remove(request.params.coupon_id);
      return success(reply, {
        message: "Coupon deleted successfully",
        data: coupon,
      });
    },

    async setActive(request, reply) {
      const coupon = await campaignService.setActive(
        request.params.coupon_id,
        request.body.is_active,
      );
      return success(reply, {
        message: `Coupon ${request.body.is_active ? "activated" : "deactivated"} successfully`,
        data: coupon,
      });
    },

    async listAdmin(request, reply) {
      const coupons = await campaignService.list(request.query);
      return success(reply, {
        message: "Coupons fetched successfully",
        data: coupons,
      });
    },

    async getById(request, reply) {
      const coupon = await campaignService.getById(request.params.coupon_id);
      return success(reply, {
        message: "Coupon fetched successfully",
        data: coupon,
      });
    },

    async listForUser(request, reply) {
      const coupons = await redemptionService.listForUser(
        request.user.user_id,
        request.query,
      );
      return success(reply, {
        message: "Assigned coupons fetched successfully",
        data: coupons,
      });
    },

  };
}
