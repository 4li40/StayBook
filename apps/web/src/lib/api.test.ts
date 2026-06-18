import { describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  apiRequest,
  buildStaffReservationsQuery,
  buildStaffRoomsQuery,
  getErrorMessage,
} from "./api";

describe("staff API query builders", () => {
  it("builds staff reservation filters with pagination defaults", () => {
    expect(
      buildStaffReservationsQuery({
        roomId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        status: "confirmed",
        state: "upcoming",
        dateFrom: "2027-01-10",
        dateTo: "2027-01-12",
      }),
    ).toBe(
      "?page=1&pageSize=20&roomId=a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11&status=confirmed&state=upcoming&dateFrom=2027-01-10&dateTo=2027-01-12",
    );
  });

  it("builds staff room filters only for selected values", () => {
    expect(
      buildStaffRoomsQuery({
        status: "inactive",
        type: "suite",
        search: "garden view",
      }),
    ).toBe("?status=inactive&type=suite&search=garden+view");
  });
});

describe("apiRequest", () => {
  it("returns success envelope data and includes credentials", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ ok: boolean }>("/api/rooms")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/rooms"),
      expect.objectContaining({
        credentials: "include",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("throws API errors with issue details from error envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed.",
              issues: [{ path: "guestCount", message: "At least 1 guest" }],
            },
          }),
          { status: 400 },
        ),
      ),
    );

    await expect(apiRequest("/api/reservations")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      issues: [{ path: "guestCount", message: "At least 1 guest" }],
    });

    vi.unstubAllGlobals();
  });
});

describe("getErrorMessage", () => {
  it("includes validation issue messages for API client errors", () => {
    const error = new ApiClientError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed.",
      [{ path: "guestCount", message: "At least 1 guest" }],
    );

    expect(getErrorMessage(error)).toBe(
      "Request validation failed. At least 1 guest",
    );
  });

  it("falls back for unknown errors", () => {
    expect(getErrorMessage("bad")).toBe("Something went wrong. Try again.");
  });
});
