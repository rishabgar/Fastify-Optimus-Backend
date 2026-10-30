import { userModel } from "./user.model.js";

export const userRepository = {
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
