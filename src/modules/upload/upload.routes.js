import { requireAuthenticated } from "../../shared/http/auth-guards.js";
import { success } from "../../shared/http/response.js";

export default async function uploadRoutes(app, { service }) {
  app.post("/presigned-url", {
    onRequest: requireAuthenticated,
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["content_type"],
        properties: {
          content_type: {
            type: "string",
            enum: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
          },
        },
      },
    },
  }, async (request, reply) => success(reply, {
    data: await service.createPresignedUrl(request.user, request.body.content_type),
  }));
}
