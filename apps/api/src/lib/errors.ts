import { HTTPException } from "hono/http-exception";

export const unauthorized = (message = "Unauthorized"): HTTPException =>
  new HTTPException(401, { message });

export const forbidden = (message = "Forbidden"): HTTPException =>
  new HTTPException(403, { message });

export const notFound = (message = "Not found"): HTTPException =>
  new HTTPException(404, { message });

export const conflict = (message = "Conflict"): HTTPException =>
  new HTTPException(409, { message });

export const unprocessable = (message: string): HTTPException =>
  new HTTPException(422, { message });
