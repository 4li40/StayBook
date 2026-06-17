import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { requireGuest, requireStaff } from "./auth";
import { ApiError } from "./http";

function createRequestWithRole(role: "guest" | "staff") {
  return {
    authSession: {
      user: {
        role,
      },
    },
  } as Request;
}

function expectForbidden(error: unknown, message: string) {
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 403,
    code: "FORBIDDEN",
    message,
  });
}

describe("requireGuest", () => {
  it("allows guest accounts", () => {
    const next = vi.fn();

    requireGuest(createRequestWithRole("guest"), {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects staff accounts", () => {
    const next = vi.fn();

    requireGuest(createRequestWithRole("staff"), {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expectForbidden(next.mock.calls[0]?.[0], "A guest account is required.");
  });
});

describe("requireStaff", () => {
  it("allows staff accounts", () => {
    const next = vi.fn();

    requireStaff(createRequestWithRole("staff"), {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects guest accounts", () => {
    const next = vi.fn();

    requireStaff(createRequestWithRole("guest"), {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expectForbidden(next.mock.calls[0]?.[0], "A staff account is required.");
  });
});
