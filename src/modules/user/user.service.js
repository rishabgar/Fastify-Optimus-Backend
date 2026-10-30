import { HttpError } from "../../shared/http/http-error.js";
import { userRepository } from "./user.repository.js";

export function createUserService({ repository = userRepository } = {}) {
  return {
    async softDelete(userId) {
      const user = await repository.softDeleteById(userId);
      if (!user) throw new HttpError(404, "User not found");

      return {
        user_id: String(user._id ?? user.id),
        is_deleted: true,
      };
    },
  };
}
