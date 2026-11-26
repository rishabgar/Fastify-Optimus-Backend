import { HttpError } from "../../shared/http/http-error.js";

const objectPathPattern = /^individual\/([0-9a-f]{24})\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|jpeg|jpg|webp)$/;

export function resolveSellerProductImages(images, sellerId) {
  return images.map(({ object_path: path, ...image }) => {
    if (path === undefined) return image;
    const match = objectPathPattern.exec(path);
    if (!match || match[1] !== String(sellerId)) {
      throw new HttpError(400, "Invalid or unauthorized image object path");
    }
    const base = process.env.PUBLIC_IMAGE_BASE_URL;
    if (!base) throw new Error("PUBLIC_IMAGE_BASE_URL is required");
    const url = new URL(base);
    if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
      throw new Error("PUBLIC_IMAGE_BASE_URL is invalid");
    }
    return { ...image, url: `${url.href.replace(/\/+$/, "")}/${path}` };
  });
}
