import fastifyJwt from "@fastify/jwt";
import paymentModel from "./payment.model.js";
import paymentRoutes from "./payment.routes.js";
import { createPaymentService } from "./payment.service.js";

export { paymentModel } from "./payment.model.js";
export { createPaymentService } from "./payment.service.js";

export default async function paymentModule(app, options) {
  if (!options.jwtSecret) throw new Error("JWT_SECRET is required");
  await app.register(fastifyJwt, { secret: options.jwtSecret });
  app.decorate("paymentModel", paymentModel);
  await app.register(paymentRoutes, { service: options.paymentService ?? createPaymentService({ cashfreeClient: options.cashfreeClient }) });
}
