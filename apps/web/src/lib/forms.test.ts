import { describe, expect, it } from "vitest";

import { ApiClientError } from "./api";
import { collectFieldErrors } from "./forms";

describe("collectFieldErrors", () => {
  it("maps server issue paths to visible form fields", () => {
    const error = new ApiClientError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed.",
      [
        { path: "checkInDate", message: "Use a real calendar date." },
        { path: "guestCount", message: "At least 1 guest" },
        { path: "ignored", message: "Ignore me" },
      ],
    );

    expect(
      collectFieldErrors(
        error,
        ["checkInDate", "checkOutDate", "guests", "form"] as const,
        { guestCount: "guests" },
      ),
    ).toEqual({
      checkInDate: "Use a real calendar date.",
      guests: "At least 1 guest",
    });
  });

  it("keeps the first message for each field", () => {
    const error = new ApiClientError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed.",
      [
        { path: "checkOutDate", message: "Required" },
        { path: "checkOutDate", message: "Must be after check-in" },
      ],
    );

    expect(
      collectFieldErrors(error, ["checkOutDate"] as const),
    ).toEqual({
      checkOutDate: "Required",
    });
  });

  it("ignores non-API errors", () => {
    expect(collectFieldErrors(new Error("boom"), ["email"] as const)).toEqual({});
  });
});
