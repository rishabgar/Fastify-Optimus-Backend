import { fail } from "./response.js";

function getStatusCode(error) {
  const statusCode = Number(error.statusCode);
  return statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
}

function getClientMessage(error, statusCode) {
  if (statusCode >= 500) return "Internal server error";
  if (statusCode === 401 && error.code?.startsWith("FST_JWT_")) {
    return "Unauthorized user";
  }
  return error.message;
}

export function registerErrorHandlers(app) {
  app.setErrorHandler((error, request, reply) => {
    const statusCode = getStatusCode(error);

    if (statusCode >= 500) {
      request.log.error({ err: error }, "Unhandled request error");

      if (process.env.environment === "development") {
        console.error("Unhandled request error:", error);
      }
    }

    return fail(reply, {
      statusCode,
      message: getClientMessage(error, statusCode),
    });
  });

  app.setNotFoundHandler((request, reply) =>
    fail(reply, {
      statusCode: 404,
      message: "Route not found",
    }),
  );
}
