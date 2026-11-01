import { HttpError } from "./http-error.js";

export async function requireAuthenticated(request) {
  await request.jwtVerify();
  if (!request.user?.user_id) {
    throw new HttpError(401, "Authentication is required");
  }
}

export async function requireAdmin(request) {
  await requireAuthenticated(request);
  if (request.user.role !== "admin") {
    throw new HttpError(403, "Admin access is required");
  }
}

export async function requireCustomer(request) {
  await requireAuthenticated(request);
  if (request.user.role !== "customer") {
    throw new HttpError(403, "Customer access is required");
  }
}

export async function requireSeller(request) {
  await requireAuthenticated(request);
  if (request.user.role !== "seller") {
    throw new HttpError(403, "Seller access is required");
  }
}

export async function requireDeliveryPartner(request) {
  await requireAuthenticated(request);
  if (request.user.role !== "delivery_partner") {
    throw new HttpError(403, "Delivery partner access is required");
  }
}
