import { success } from "../../shared/http/response.js";

export function createOrderController(service) {
  return {
    place: async (request, reply) => success(reply, { statusCode: 201, message: "Order placed successfully", data: await service.place(request.user.user_id, request.body) }),
    preview: async (request, reply) => success(reply, { data: await service.preview(request.user.user_id) }),
    listMine: async (request, reply) => success(reply, { data: await service.listCustomer(request.user.user_id) }),
    listHistory: async (request, reply) => success(reply, { data: await service.listHistory(request.user.user_id) }),
    detail: async (request, reply) => success(reply, { data: await service.customerDetail(request.user.user_id, request.params.order_id) }),
    cancel: async (request, reply) => success(reply, { data: await service.cancel(request.user.user_id, request.params.order_id, request.body.reason) }),
    listSeller: async (request, reply) => success(reply, { data: await service.listSeller(request.user.user_id) }),
    sellerAccept: async (request, reply) => success(reply, { data: await service.sellerTransition(request.user.user_id, request.params, "accepted") }),
    sellerPack: async (request, reply) => success(reply, { data: await service.sellerTransition(request.user.user_id, request.params, "packed") }),
    sellerReject: async (request, reply) => success(reply, { data: await service.sellerTransition(request.user.user_id, request.params, "rejected", request.body.reason) }),
    availableTasks: async (request, reply) => success(reply, { data: await service.availableTasks() }),
    myTasks: async (request, reply) => success(reply, { data: await service.myTasks(request.user.user_id) }),
    sellerEarnings: async (request, reply) => success(reply, { data: await service.sellerEarnings(request.user.user_id) }),
    deliveryEarnings: async (request, reply) => success(reply, { data: await service.deliveryEarnings(request.user.user_id) }),
    acceptTask: async (request, reply) => success(reply, { data: await service.acceptTask(request.user.user_id, request.params.order_id) }),
    setDeliveryEarning: async (request, reply) => success(reply, { data: await service.setDeliveryEarning(request.params.order_id, request.body.earning_amount) }),
    verifyPickup: async (request, reply) => success(reply, { data: await service.verifyPickup(request.user.user_id, request.params, request.body.otp) }),
    verifyCustomerOtp: async (request, reply) => success(reply, { data: await service.verifyCustomerOtp(request.user.user_id, request.params.order_id, request.body.otp) }),
    completeDelivery: async (request, reply) => success(reply, { data: await service.completeDelivery(request.user.user_id, request.params.order_id) }),
  };
}
