import { HttpError } from "../../shared/http/http-error.js";
import { userRepository } from "./user.repository.js";

function toSavedAddress(address) {
  return {
    address: address.address,
    ...(address.recipient_name != null && {
      recipient_name: address.recipient_name,
    }),
    ...(address.phone != null && { phone: address.phone }),
    ...(Array.isArray(address.coordinates) && {
      coordinates: address.coordinates,
    }),
    ...(address.is_default != null && { is_default: address.is_default }),
  };
}

export function createUserService({ repository = userRepository } = {}) {
  return {
    async getProfile(userId) {
      const user = await repository.findProfileById(userId);
      if (!user) throw new HttpError(404, "User not found");

      return {
        user_id: String(user._id ?? user.id),
        first_name: user.first_name,
        user_type: user.user_type,
        ...(user.last_name != null && { last_name: user.last_name }),
        ...(user.user_email != null && { user_email: user.user_email }),
        ...(user.user_phone_no != null && {
          user_phone_no: user.user_phone_no,
        }),
        ...(user.profile_image != null && {
          profile_image: user.profile_image,
        }),
        ...(Array.isArray(user.user_location?.coordinates) && {
          user_location: {
            type: user.user_location.type ?? "Point",
            coordinates: user.user_location.coordinates,
          },
        }),
        ...(Array.isArray(user.saved_addresses) && {
          saved_addresses: user.saved_addresses.map(toSavedAddress),
        }),
        ...(user.vehicle_type != null && { vehicle_type: user.vehicle_type }),
      };
    },

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
