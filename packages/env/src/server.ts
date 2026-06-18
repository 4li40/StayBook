import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const optionalBooleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
    AUTH_COOKIE_SECURE: optionalBooleanString,
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
