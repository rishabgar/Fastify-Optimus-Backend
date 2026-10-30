import { HttpError } from "./http-error.js";

export function conflictError() {
  return new HttpError(409, "Email is already registered", {
    field: "user_email",
  });
}

export function invalidCredentialsError() {
  return new HttpError(401, "Invalid email or password");
}

export function duplicatePhoneError(existingUser) {
  const message =
    existingUser?.user_type === "delivery_partner"
      ? "Delivery partner already registered"
      : "Phone number already registered";

  return new HttpError(409, message, { field: "user_phone_no" });
}

export function userAlreadyRegisteredError(field = "user_email") {
  return new HttpError(409, "User already registered", { field });
}

export function success(
  reply,
  { message = "Request successful", data = null, statusCode = 200 } = {},
) {
  return reply.code(statusCode).send({
    status: "success",
    message,
    data,
  });
}

export function fail(
  reply,
  { message = "Request failed", statusCode = 500 } = {},
) {
  return reply.code(statusCode).send({
    status: "fail",
    message,
    data: null,
  });
}
