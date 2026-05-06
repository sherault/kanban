import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { KB_REFRESH_TOKEN_COOKIE } from "@kanban/shared";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export function getRefreshCookie(c: Context) {
  return getCookie(c, KB_REFRESH_TOKEN_COOKIE);
}

export function setRefreshCookie(c: Context, refreshToken: string) {
  setCookie(c, KB_REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearRefreshCookie(c: Context) {
  deleteCookie(c, KB_REFRESH_TOKEN_COOKIE, { path: "/" });
}
