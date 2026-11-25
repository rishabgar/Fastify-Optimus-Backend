import { userModel } from "./user.model.js";

export const userRepository = {
  findProfileById(userId) {
    return userModel
      .findOne({ _id: userId, is_deleted: false })
      .select(
        "_id first_name last_name user_email user_phone_no profile_image user_type user_location saved_addresses vehicle_type",
      )
      .lean();
  },

  softDeleteById(userId) {
    return userModel
      .findOneAndUpdate(
        { _id: userId, is_deleted: false },
        { $set: { is_deleted: true } },
        { returnDocument: "after", runValidators: true },
      )
      .select("_id is_deleted")
      .lean();
  },
};
