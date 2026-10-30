import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import {
  createFirebaseIdTokenVerifier,
  InvalidFirebaseIdTokenError,
} from "./id-token-verifier.js";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createToken(privateKey, payload) {
  const encodedHeader = encode({ alg: "RS256", kid: "key-1", typ: "JWT" });
  const encodedPayload = encode(payload);
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("RSA-SHA256", Buffer.from(content), privateKey);
  return `${content}.${signature.toString("base64url")}`;
}

test("Firebase verifier validates signature and required claims", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const projectId = "test-project";
  const currentTime = 2_000_000_000;
  const token = createToken(privateKey, {
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "firebase-user-1",
    iat: currentTime - 10,
    exp: currentTime + 3600,
    auth_time: currentTime - 20,
    phone_number: "+919876543210",
    firebase: { sign_in_provider: "phone" },
  });
  const verifyIdToken = createFirebaseIdTokenVerifier({
    projectId,
    now: () => currentTime,
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => "public, max-age=3600" },
      async json() {
        return {
          "key-1": publicKey.export({ type: "spki", format: "pem" }),
        };
      },
    }),
  });

  const payload = await verifyIdToken(token);
  assert.equal(payload.sub, "firebase-user-1");
  assert.equal(payload.phone_number, "+919876543210");
});

test("Firebase verifier rejects an invalid signature", async () => {
  const signingKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const verificationKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const projectId = "test-project";
  const currentTime = 2_000_000_000;
  const token = createToken(signingKeys.privateKey, {
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "firebase-user-1",
    iat: currentTime - 10,
    exp: currentTime + 3600,
    auth_time: currentTime - 20,
  });
  const verifyIdToken = createFirebaseIdTokenVerifier({
    projectId,
    now: () => currentTime,
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => "max-age=3600" },
      async json() {
        return {
          "key-1": verificationKeys.publicKey.export({
            type: "spki",
            format: "pem",
          }),
        };
      },
    }),
  });

  await assert.rejects(
    verifyIdToken(token),
    (error) => error instanceof InvalidFirebaseIdTokenError,
  );
});
