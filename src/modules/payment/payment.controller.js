import { success } from "../../shared/http/response.js";

export function createPaymentController(service) {
  return {
    status: async (request, reply) => success(reply, { data: await service.status(request.user.user_id, request.params.order_id) }),
    createLink: async (request, reply) => success(reply, { message: "Payment link created", data: await service.createOnlineLink(request.user.user_id, request.params.order_id) }),
    confirmCash: async (request, reply) => success(reply, { message: "Payment collected", data: await service.confirmCash(request.user.user_id, request.params.order_id) }),
    webhook: async (request, reply) => success(reply, { message: "Webhook processed", data: await service.handleCashfreeWebhook(request.body, request.headers) }),
  };
}
