import { createDb } from "@StayBook/db";
import * as schema from "@StayBook/db/schema/auth";
import { env } from "@StayBook/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";

export function createAuth() {
  const { db } = createDb();

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
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
