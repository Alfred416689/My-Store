import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const adminCookieName = "s2g-admin-session";
export const adminSessionLifetimeSeconds = 60 * 60 * 8;

type AdminConfiguration = {
  email: string;
  password: string;
  sessionSecret: string;
};

function getAdminConfiguration(): AdminConfiguration | null {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!email || !password || !sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    return null;
  }

  return { email, password, sessionSecret };
}

function matchesSecret(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
}

function signSession(expiresAt: number, configuration: AdminConfiguration) {
  return createHmac("sha256", configuration.sessionSecret)
    .update(`${expiresAt}:${configuration.email.toLowerCase()}`)
    .digest("hex");
}

export function isAdminConfigurationReady() {
  return getAdminConfiguration() !== null;
}

export function verifyAdminCredentials(email: string, password: string) {
  const configuration = getAdminConfiguration();
  if (!configuration) return null;

  const emailMatches = matchesSecret(email.trim().toLowerCase(), configuration.email.toLowerCase());
  const passwordMatches = matchesSecret(password, configuration.password);
  return emailMatches && passwordMatches ? configuration : null;
}

export function createAdminSession(configuration: AdminConfiguration) {
  const expiresAt = Math.floor(Date.now() / 1000) + adminSessionLifetimeSeconds;
  return `${expiresAt}.${signSession(expiresAt, configuration)}`;
}

export async function getAdminSession() {
  const configuration = getAdminConfiguration();
  if (!configuration) return null;

  const token = (await cookies()).get(adminCookieName)?.value;
  if (!token) return null;

  const [expiresAtText, signature, ...extra] = token.split(".");
  if (
    extra.length > 0 ||
    !/^\d+$/.test(expiresAtText) ||
    !/^[a-f\d]{64}$/i.test(signature)
  ) {
    return null;
  }

  const expiresAt = Number(expiresAtText);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + adminSessionLifetimeSeconds
  ) {
    return null;
  }

  return matchesSecret(signature, signSession(expiresAt, configuration))
    ? { email: configuration.email }
    : null;
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: adminSessionLifetimeSeconds,
  };
}
