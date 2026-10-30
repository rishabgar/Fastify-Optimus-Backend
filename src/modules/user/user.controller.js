import { success } from "../../shared/http/response.js";

export function createUserController(service) {
  return {
    async softDelete(request, reply) {
      const user = await service.softDelete(request.user.user_id);
      return success(reply, {
        message: "User deleted successfully",
        data: user,
      });
    },
  };
}
