import healthRoutes from "./health.routes.js";

export default async function healthModule(app) {
  await app.register(healthRoutes, { prefix: "/health" });
}
