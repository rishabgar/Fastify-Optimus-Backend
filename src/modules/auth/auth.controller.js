import { success } from "../../shared/http/response.js";

export function createAuthController(authService) {
  return {
    async registerAdmin(request, reply) {
      const admin = await authService.registerAdmin(request.body);

      return success(reply, {
        statusCode: 201,
        message: "Admin registered successfully",
        data: admin,
      });
    },

    async loginAdmin(request, reply) {
      const admin = await authService.loginAdmin(request.body);
      const token = await reply.jwtSign(admin);

      return success(reply, {
        message: "Admin logged in successfully",
        data: {
          admin_id: admin.user_id,
          token,
        },
      });
    },

    async registerSeller(request, reply) {
      const registration = await authService.registerSeller(request.body);
      const token = await reply.jwtSign({
        user_id: registration.seller_id,
        role: "seller",
      });

      return success(reply, {
        statusCode: 201,
        message: "Seller and shop registered successfully",
        data: {
          seller_id: registration.seller_id,
          shop_id: registration.shop_id,
          token,
        },
      });
    },

    async registerCustomer(request, reply) {
      const customer = await authService.registerCustomer(request.body);
      const token = await reply.jwtSign({
        user_id: customer.id,
        role: "customer",
      });

      return success(reply, {
        statusCode: 201,
        message: "Customer registered successfully",
        data: {
          user_id: customer.id,
          first_name: customer.first_name,
          token,
        },
      });
    },

    async createDevelopmentToken(request, reply) {
      const user = await authService.getDevelopmentTokenClaims(
        request.body.user_email,
      );
      const token = await reply.jwtSign(user);

      return success(reply, {
        message: "Development token created successfully",
        data: {
          user_id: user.user_id,
          role: user.role,
          token,
        },
      });
    },

    async verifyDeliveryPartnerPhone(request, reply) {
      const userPhoneNo = await authService.verifyDeliveryPartnerPhone(
        request.body.idToken,
      );

      return success(reply, {
        message: "Phone number verified successfully",
        data: {
          user_phone_no: userPhoneNo,
          verified: true,
        },
      });
    },

    async registerDeliveryPartner(request, reply) {
      const deliveryPartner = await authService.registerDeliveryPartner(
        request.body,
      );

      return success(reply, {
        statusCode: 201,
        message: "Delivery partner registered successfully",
        data: deliveryPartner,
      });
    },
  };
}
