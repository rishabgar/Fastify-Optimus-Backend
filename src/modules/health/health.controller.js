import { success } from "../../shared/http/response.js";
import { getHealthStatus } from "./health.service.js";

export async function getHealth(_request, reply) {
  return success(reply, {
    message: "Service is healthy",
    data: getHealthStatus(),
  });
}
