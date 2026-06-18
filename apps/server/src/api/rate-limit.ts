import type { Request, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";

import type { ApiErrorCode } from "./http";

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  message: string;
  skip?: (req: Request) => boolean;
};

function createRateLimit({
  windowMs,
  limit,
  message,
  skip,
}: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS" || Boolean(skip?.(req)),
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED" satisfies ApiErrorCode,
          message,
        },
      });
    },
  });
}

export const authCredentialRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000, //return back to 8 after testing
  message: "Too many login or registration attempts. Please wait and try again.",
});

export const authEndpointRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: "Too many authentication requests. Please wait and try again.",
});

export const readEndpointRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: "Too many requests. Please wait and try again.",
  skip: (req) => req.method !== "GET" || req.path.startsWith("/auth"),
});

export { createRateLimit };
