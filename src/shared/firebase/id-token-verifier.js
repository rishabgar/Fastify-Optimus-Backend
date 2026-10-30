import { verify } from "node:crypto";

const CERTIFICATES_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

export class InvalidFirebaseIdTokenError extends Error {
  constructor() {
    super("Invalid Firebase ID token");
    this.name = "InvalidFirebaseIdTokenError";
  }
}

function decodeJson(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new InvalidFirebaseIdTokenError();
  }
}

function getMaxAge(cacheControl) {
  const match = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i);
  return match ? Number(match[1]) * 1000 : 300_000;
}

function validateClaims(payload, projectId, now) {
  if (
    typeof payload.exp !== "number" ||
    payload.exp <= now ||
    typeof payload.iat !== "number" ||
    payload.iat > now ||
    typeof payload.auth_time !== "number" ||
    payload.auth_time > now ||
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 128
  ) {
    throw new InvalidFirebaseIdTokenError();
  }
}

export function createFirebaseIdTokenVerifier({
  projectId,
  fetchImpl = globalThis.fetch,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  let certificateCache;
  let certificateCacheExpiresAt = 0;

  async function getCertificates(forceRefresh = false) {
    if (
      !forceRefresh &&
      certificateCache &&
      Date.now() < certificateCacheExpiresAt
    ) {
      return certificateCache;
    }

    const response = await fetchImpl(CERTIFICATES_URL);
    if (!response.ok) {
      throw new Error("Unable to retrieve Firebase signing certificates");
    }

    certificateCache = await response.json();
    certificateCacheExpiresAt =
      Date.now() + getMaxAge(response.headers.get("cache-control"));
    return certificateCache;
  }

  return async function verifyIdToken(idToken) {
    if (!projectId) {
      throw new Error("FIREBASE_PROJECT_ID is required");
    }

    if (typeof idToken !== "string") {
      throw new InvalidFirebaseIdTokenError();
    }

    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new InvalidFirebaseIdTokenError();
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeJson(encodedHeader);
    const payload = decodeJson(encodedPayload);

    if (header.alg !== "RS256" || typeof header.kid !== "string") {
      throw new InvalidFirebaseIdTokenError();
    }

    let certificates = await getCertificates();
    let certificate = certificates[header.kid];

    if (!certificate) {
      certificates = await getCertificates(true);
      certificate = certificates[header.kid];
    }

    if (
      !certificate ||
      !verify(
        "RSA-SHA256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        certificate,
        Buffer.from(encodedSignature, "base64url"),
      )
    ) {
      throw new InvalidFirebaseIdTokenError();
    }

    validateClaims(payload, projectId, now());
    return payload;
  };
}
