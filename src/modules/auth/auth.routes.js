import { createAuthController } from "./auth.controller.js";
import {
  adminLoginResponseSchema,
  adminLoginSchema,
  adminRegistrationResponseSchema,
  adminRegistrationSchema,
  customerRegistrationResponseSchema,
  customerRegistrationSchema,
  developmentTokenResponseSchema,
  developmentTokenSchema,
  deliveryPartnerRegistrationResponseSchema,
  deliveryPartnerRegistrationSchema,
  verifyDeliveryPartnerPhoneResponseSchema,
  verifyDeliveryPartnerPhoneSchema,
} from "./auth.schema.js";
import {
  sellerRegistrationResponseSchema,
  sellerRegistrationSchema,
} from "./seller-signup.schema.js";
import { HttpError } from "../../shared/http/http-error.js";
import { normalizePhoneNumber } from "../../shared/utils/utility.js";

async function normalizeAdminRegistration(request) {
  if (!request.body || typeof request.body !== "object") {
    return;
  }

  for (const field of [
    "user_email",
    "first_name",
    "last_name",
    "password",
    "user_type",
  ]) {
    if (typeof request.body[field] === "string") {
      request.body[field] = request.body[field].trim();
    }
  }

  if (typeof request.body.user_email === "string") {
    request.body.user_email = request.body.user_email.toLowerCase();
  }

  if (typeof request.body.user_type === "string") {
    request.body.user_type = request.body.user_type.toLowerCase();
  }
}

async function normalizeAdminLogin(request) {
  if (typeof request.body?.user_email === "string") {
    request.body.user_email = request.body.user_email.trim().toLowerCase();
  }
}

async function normalizeSellerRegistration(request) {
  const body = request.body;

  if (Object.hasOwn(body ?? {}, "seller_id")) {
    throw new HttpError(400, "seller_id must not be provided");
  }

  for (const field of [
    "user_email",
    "user_phone_no",
    "first_name",
    "last_name",
    "profile_image",
  ]) {
    if (typeof body?.[field] === "string") {
      body[field] = body[field].trim();
    }
  }

  if (typeof body?.user_email === "string") {
    body.user_email = body.user_email.toLowerCase();
  }

  for (const field of ["shop_name", "shop_address", "shop_image", "gst_number"]) {
    if (typeof body?.[field] === "string") {
      body[field] = body[field].trim();
    }
  }
}

async function normalizeDeliveryPartnerRegistration(request) {
  if (!request.body || typeof request.body !== "object") {
    return;
  }

  for (const field of [
    "first_name",
    "last_name",
    "user_email",
    "profile_image",
  ]) {
    if (typeof request.body[field] === "string") {
      request.body[field] = request.body[field].trim();
    }
  }

  if (typeof request.body.user_email === "string") {
    request.body.user_email = request.body.user_email.toLowerCase();
  }
}

async function normalizeCustomerRegistration(request) {
  const body = request.body;

  if (!body || typeof body !== "object") {
    return;
  }

  const allowedFields = new Set([
    "user_phone_no",
    "user_email",
    "first_name",
    "last_name",
    "profile_image",
    "user_location",
    "saved_addresses",
    "coordinates",
    "user_type",
  ]);
  const unsupportedField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unsupportedField) {
    throw new HttpError(400, `${unsupportedField} must not be provided`);
  }

  delete body.user_type;

  for (const field of [
    "user_phone_no",
    "user_email",
    "first_name",
    "last_name",
    "profile_image",
  ]) {
    if (typeof body[field] === "string") {
      body[field] = body[field].trim();
    }
  }

  if (typeof body.user_email === "string") {
    body.user_email = body.user_email.toLowerCase();
  }

  if (typeof body.user_phone_no === "string") {
    body.user_phone_no =
      normalizePhoneNumber(body.user_phone_no) ?? body.user_phone_no;
  }

  if (Array.isArray(body.saved_addresses)) {
    if (body.saved_addresses.length > 0 && !Array.isArray(body.coordinates)) {
      throw new HttpError(
        400,
        "coordinates are required when saved_addresses are provided",
      );
    }

    for (const savedAddress of body.saved_addresses) {
      if (typeof savedAddress?.address === "string") {
        savedAddress.address = savedAddress.address.trim();
      }
    }
  }


  if (
    Array.isArray(body.coordinates) &&
    (!Array.isArray(body.saved_addresses) || body.saved_addresses.length === 0)
  ) {
    throw new HttpError(
      400,
      "saved_addresses are required when coordinates are provided",
    );
  }
}

export default async function authRoutes(app, { authService, isDevelopment }) {
  const controller = createAuthController(authService);

  app.post(
    "/admin/signup",
    {
      preValidation: normalizeAdminRegistration,
      schema: {
        body: adminRegistrationSchema,
        response: {
          201: adminRegistrationResponseSchema,
        },
      },
    },
    controller.registerAdmin,
  );

  app.post(
    "/admin/login",
    {
      preValidation: normalizeAdminLogin,
      schema: {
        body: adminLoginSchema,
        response: {
          200: adminLoginResponseSchema,
        },
      },
    },
    controller.loginAdmin,
  );

  app.post(
    "/seller/signup",
    {
      preValidation: normalizeSellerRegistration,
      schema: {
        body: sellerRegistrationSchema,
        response: {
          201: sellerRegistrationResponseSchema,
        },
      },
    },
    controller.registerSeller,
  );

  app.post(
    "/customer/signup",
    {
      preValidation: normalizeCustomerRegistration,
      schema: {
        body: customerRegistrationSchema,
        response: { 201: customerRegistrationResponseSchema },
      },
    },
    controller.registerCustomer,
  );

  if (isDevelopment) {
    app.post(
      "/dev/token",
      {
        preValidation: normalizeAdminLogin,
        schema: {
          body: developmentTokenSchema,
          response: {
            200: developmentTokenResponseSchema,
          },
        },
      },
      controller.createDevelopmentToken,
    );
  }

  app.post(
    "/delivery-partner/verify-phone",
    {
      schema: {
        body: verifyDeliveryPartnerPhoneSchema,
        response: { 200: verifyDeliveryPartnerPhoneResponseSchema },
      },
    },
    controller.verifyDeliveryPartnerPhone,
  );

  app.post(
    "/delivery-partner/signup",
    {
      preValidation: normalizeDeliveryPartnerRegistration,
      schema: {
        body: deliveryPartnerRegistrationSchema,
        response: { 201: deliveryPartnerRegistrationResponseSchema },
      },
    },
    controller.registerDeliveryPartner,
  );
}
