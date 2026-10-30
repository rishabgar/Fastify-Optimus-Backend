import { HttpError } from "../../shared/http/http-error.js";

const MAX_NOTE_LENGTH = 500;

export async function validateAddShopFavouriteBody(request) {
  if (request.body === undefined) return;

  if (
    request.body === null ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  ) {
    throw new HttpError(400, "Request body must be an object");
  }

  if (Object.keys(request.body).some((key) => key !== "note")) {
    throw new HttpError(400, "Only note may be provided");
  }

  const { note } = request.body;
  if (
    note !== undefined &&
    note !== null &&
    (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)
  ) {
    throw new HttpError(400, "note must be null or a string up to 500 characters");
  }
}
