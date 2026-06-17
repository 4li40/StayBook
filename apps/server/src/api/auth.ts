import { auth } from "@StayBook/auth";
import type { NextFunction, Request, Response } from "express";

import { ApiError } from "./http";

type AuthSession = typeof auth.$Infer.Session;

declare global {
  namespace Express {
    interface Request {
      authSession?: AuthSession;
    }
  }
}

function toWebHeaders(req: Request) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    }
  }

  return headers;
}

export async function requireSession(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const session = await auth.api.getSession({
    headers: toWebHeaders(req),
  });

  if (!session) {
    next(new ApiError(401, "UNAUTHORIZED", "Authentication is required."));
    return;
  }

  req.authSession = session;
  next();
}

export function requireGuest(req: Request, _res: Response, next: NextFunction) {
  const role = req.authSession?.user.role;

  if (role !== "guest") {
    next(new ApiError(403, "FORBIDDEN", "A guest account is required."));
    return;
  }

  next();
}

export function requireStaff(req: Request, _res: Response, next: NextFunction) {
  const role = req.authSession?.user.role;

  if (role !== "staff") {
    next(new ApiError(403, "FORBIDDEN", "A staff account is required."));
    return;
  }

  next();
}

export function getAuthenticatedUser(req: Request) {
  if (!req.authSession) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  }

  return req.authSession.user;
}
