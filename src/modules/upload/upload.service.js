import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HttpError } from "../../shared/http/http-error.js";

const extensions = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};
const roles = new Set(["admin", "seller", "customer", "delivery_partner"]);

export function createUploadService({ config = process.env, sign = getSignedUrl, uuid = randomUUID } = {}) {
  return {
    async createPresignedUrl(actor, contentType) {
      if (!roles.has(actor.role)) throw new HttpError(403, "Upload access is required");
      if (!/^[0-9a-fA-F]{24}$/.test(actor.user_id)) {
        throw new HttpError(401, "Invalid authentication credentials");
      }
      if (!Object.hasOwn(extensions, contentType)) throw new HttpError(400, "Invalid image content type");
      const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = config;
      if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
        throw new Error("R2 upload configuration is incomplete");
      }
      const key = `${actor.role === "admin" ? "common" : "individual"}/${actor.user_id}/${uuid()}.${extensions[contentType]}`;
      const client = new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      });
      const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType });
      const url = await sign(client, command, { expiresIn: 60, signableHeaders: new Set(["content-type"]) });
      return { object_path: key, upload_url: url };
    },
  };
}
