import { createDb } from "@StayBook/db";
import * as schema from "@StayBook/db/schema/auth";
import { env } from "@StayBook/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";

function getCookieSettings() {
  const authUrl = new URL(env.BETTER_AUTH_URL);
  const sameSite =
    env.AUTH_COOKIE_SAME_SITE ?? (env.NODE_ENV === "production" ? "none" : "lax");
  const secure =
    env.AUTH_COOKIE_SECURE ?? (sameSite === "none" || authUrl.protocol === "https:");

  if (sameSite === "none" && !secure) {
    throw new Error("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is none.");
  }

  return { sameSite, secure };
}

export function createAuth() {
  const { db } = createDb();
  const cookieSettings = getCookieSettings();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          input: false,
          defaultValue: "guest",
          validator: {
            input: z.enum(["guest", "staff"]),
            output: z.enum(["guest", "staff"]),
          },
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "memory",
      customRules: {
        "/sign-in/email": {
          window: 15 * 60,
          max: 8,
        },
        "/sign-up/email": {
          window: 15 * 60,
          max: 8,
        },
      },
    },
    advanced: {
      useSecureCookies: cookieSettings.secure,
      defaultCookieAttributes: {
        sameSite: cookieSettings.sameSite,
        secure: cookieSettings.secure,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
