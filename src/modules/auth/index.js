import fastifyJwt from "@fastify/jwt";
import { createFirebaseIdTokenVerifier } from "../../shared/firebase/id-token-verifier.js";
import authRoutes from "./auth.routes.js";
import { createAuthService } from "./auth.service.js";

export default async function authModule(app, options) {
  if (!options.jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  await app.register(fastifyJwt, { secret: options.jwtSecret });

  const verifyIdToken =
    options.verifyFirebaseIdToken ??
    createFirebaseIdTokenVerifier({ projectId: options.firebaseProjectId });
  const authService =
    options.authService ?? createAuthService({ verifyIdToken });

  await app.register(authRoutes, {
    authService,
    isDevelopment: options.isDevelopment,
  });
}
