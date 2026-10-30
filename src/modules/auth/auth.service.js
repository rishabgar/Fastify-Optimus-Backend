import bcrypt from "bcryptjs";
import { InvalidFirebaseIdTokenError } from "../../shared/firebase/id-token-verifier.js";
import { HttpError } from "../../shared/http/http-error.js";
import {
  conflictError,
  duplicatePhoneError,
  invalidCredentialsError,
  userAlreadyRegisteredError,
} from "../../shared/http/response.js";
import { normalizePhoneNumber } from "../../shared/utils/utility.js";
import { authRepository } from "./auth.repository.js";

const PASSWORD_SALT_ROUNDS = 12;

function toAdminResponse(user) {
  return {
    id: user.id ?? user._id.toString(),
    user_email: user.user_email,
    first_name: user.first_name,
    last_name: user.last_name,
    user_type: user.user_type,
  };
}

function toDeliveryPartnerResponse(user) {
  return {
    id: user.id ?? user._id.toString(),
    user_phone_no: user.user_phone_no,
    first_name: user.first_name,
    last_name: user.last_name,
    user_email: user.user_email,
    profile_image: user.profile_image,
    vehicle_type: user.vehicle_type,
    user_type: user.user_type,
  };
}

function toCustomerResponse(user) {
  const response = {
    id: String(user.id ?? user._id),
    user_phone_no: user.user_phone_no,
    user_email: user.user_email,
    first_name: user.first_name,
    last_name: user.last_name,
    profile_image: user.profile_image,
    saved_addresses: user.saved_addresses,
    user_type: user.user_type,
  };

  if (Array.isArray(user.user_location?.coordinates)) {
    response.user_location = {
      type: user.user_location.type ?? "Point",
      coordinates: user.user_location.coordinates,
    };
  }

  return response;
}

export function createAuthService({
  repository = authRepository,
  hashPassword = (password) => bcrypt.hash(password, PASSWORD_SALT_ROUNDS),
  comparePassword = (password, hash) => bcrypt.compare(password, hash),
  verifyIdToken,
} = {}) {
  async function getVerifiedDeliveryPartnerPhone(idToken) {
    if (typeof verifyIdToken !== "function") {
      throw new Error("A Firebase ID token verifier is required");
    }

    let decodedToken;

    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (error) {
      if (error instanceof InvalidFirebaseIdTokenError) {
        throw new HttpError(401, "Invalid Firebase ID token");
      }

      throw error;
    }

    if (decodedToken.firebase?.sign_in_provider !== "phone") {
      throw new HttpError(401, "Phone authentication is required");
    }

    const userPhoneNo = normalizePhoneNumber(decodedToken.phone_number);

    if (!userPhoneNo) {
      throw new HttpError(400, "A valid phone number is required", {
        field: "user_phone_no",
      });
    }

    return userPhoneNo;
  }

  return {
    async registerAdmin(input) {
      const existingUser = await repository.findByEmail(input.user_email);
      console.info("Existing user found:", existingUser);

      if (existingUser) {
        throw conflictError();
      }

      const password = await hashPassword(input.password);

      try {
        const user = await repository.createAdmin({
          ...input,
          password,
          user_type: "admin",
        });
        console.log("user00", user);

        return toAdminResponse(user);
      } catch (error) {
        console.error({
          code: error.code,
          keyPattern: error.keyPattern,
          keyValue: error.keyValue,
        });
        if (error?.code === 11000) {
          throw conflictError();
        }

        throw error;
      }
    },

    async loginAdmin({ user_email, password }) {
      const admin = await repository.findAdminByEmail(user_email);

      if (!admin || !(await comparePassword(password, admin.password))) {
        throw invalidCredentialsError();
      }

      return {
        user_id: admin.id ?? admin._id.toString(),
        role: admin.user_type,
      };
    },

    async registerSeller(input) {
      const {
        user_email,
        user_phone_no,
        first_name,
        last_name,
        profile_image,
        shop_name,
        shop_address,
        shop_image,
        operating_hours,
        gst_number,
        shop_type_id,
        coordinates,
      } = input;
      const seller = {
        user_email,
        user_phone_no,
        first_name,
        last_name,
        profile_image,
      };
      const shop = {
        shop_name,
        shop_address,
        shop_image,
        operating_hours,
        gst_number,
        shop_type_id,
        seller_location: { type: "Point", coordinates },
      };
      const session = await repository.startSession();
      let result;

      try {
        await session.withTransaction(async () => {
          if (
            seller.user_email &&
            (await repository.findByEmail(seller.user_email, session))
          ) {
            throw conflictError();
          }

          if (
            seller.user_phone_no &&
            (await repository.findByPhone(seller.user_phone_no, session))
          ) {
            throw duplicatePhoneError();
          }

          if (
            !(await repository.findActiveShopType(shop.shop_type_id, session))
          ) {
            throw new HttpError(400, "Active shop type not found");
          }

          const createdSeller = await repository.createSeller(
            {
              ...seller,
              user_type: "seller",
            },
            session,
          );
          const createdShop = await repository.createSellerShop(
            {
              ...shop,
              seller_id: createdSeller._id ?? createdSeller.id,
            },
            session,
          );

          result = {
            seller_id: String(createdSeller.id ?? createdSeller._id),
            shop_id: String(createdShop.id ?? createdShop._id),
          };
        });

        return result;
      } catch (error) {
        if (error?.code === 11000) {
          if (error.keyPattern?.user_phone_no || error.keyValue?.user_phone_no) {
            throw duplicatePhoneError();
          }
          throw conflictError();
        }
        throw error;
      } finally {
        await session.endSession();
      }
    },

    async registerCustomer(input) {
      const existingPhone = await repository.findByPhone(input.user_phone_no);

      if (existingPhone) {
        throw duplicatePhoneError(existingPhone);
      }

      if (
        input.user_email &&
        (await repository.findByEmail(input.user_email))
      ) {
        throw conflictError();
      }

      try {
        const {
          user_phone_no,
          user_email,
          first_name,
          last_name,
          profile_image,
          user_location,
          saved_addresses,
          coordinates,
        } = input;
        const customerSavedAddresses = saved_addresses?.map((savedAddress) => ({
          ...savedAddress,
          coordinates,
        }));
        const customer = await repository.createCustomer({
          user_phone_no,
          ...(user_email !== undefined && { user_email }),
          first_name,
          ...(last_name !== undefined && { last_name }),
          ...(profile_image !== undefined && { profile_image }),
          ...(user_location !== undefined && { user_location }),
          ...(customerSavedAddresses !== undefined && {
            saved_addresses: customerSavedAddresses,
          }),
          user_type: "customer",
        });

        return toCustomerResponse(customer);
      } catch (error) {
        if (error?.code === 11000) {
          if (
            error.keyPattern?.user_phone_no ||
            error.keyValue?.user_phone_no
          ) {
            throw duplicatePhoneError();
          }

          if (error.keyPattern?.user_email || error.keyValue?.user_email) {
            throw conflictError();
          }
        }

        throw error;
      }
    },

    async getDevelopmentTokenClaims(userEmail) {
      const user = await repository.findByEmail(userEmail);

      if (!user) {
        throw new HttpError(404, "User not found");
      }

      if (!["seller", "customer"].includes(user.user_type)) {
        throw new HttpError(
          403,
          "Development tokens are only available for sellers and customers",
        );
      }

      return {
        user_id: user.id ?? user._id.toString(),
        role: user.user_type,
      };
    },

    async verifyDeliveryPartnerPhone(idToken) {
      return getVerifiedDeliveryPartnerPhone(idToken);
    },

    async registerDeliveryPartner(input) {
      const userPhoneNo = await getVerifiedDeliveryPartnerPhone(input.idToken);
      const existingPhone = await repository.findByPhone(userPhoneNo);

      if (existingPhone) {
        throw duplicatePhoneError(existingPhone);
      }

      if (
        input.user_email &&
        (await repository.findByEmail(input.user_email))
      ) {
        throw userAlreadyRegisteredError();
      }

      const { idToken, ...profile } = input;

      try {
        const user = await repository.createDeliveryPartner({
          ...profile,
          user_phone_no: userPhoneNo,
          user_type: "delivery_partner",
        });

        return toDeliveryPartnerResponse(user);
      } catch (error) {
        if (error?.code === 11000) {
          if (
            error.keyPattern?.user_phone_no ||
            error.keyValue?.user_phone_no
          ) {
            throw duplicatePhoneError();
          }

          throw userAlreadyRegisteredError(
            Object.keys(error.keyPattern ?? error.keyValue ?? {})[0],
          );
        }

        throw error;
      }
    },
  };
}
