import { neonSql } from "@StayBook/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/http";
import { createBooking } from "./booking";

vi.mock("@StayBook/db", () => ({
  neonSql: {
    transaction: vi.fn(),
  },
}));

const mockedTransaction = vi.mocked(neonSql.transaction);

const ROOM_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const RESERVATION_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const GUEST_ID = "guest-user-1";

const input = {
  roomId: ROOM_ID,
  guestId: GUEST_ID,
  checkInDate: "2027-01-10",
  checkOutDate: "2027-01-12",
  guestCount: 2,
};

function roomRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    active: true,
    maxGuests: 2,
    nightlyPrice: 25000,
    ...overrides,
  };
}

function reservationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RESERVATION_ID,
    roomId: ROOM_ID,
    guestId: GUEST_ID,
    checkInDate: "2027-01-10",
    checkOutDate: "2027-01-12",
    totalPrice: 50000,
    status: "confirmed",
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdAt: "2026-06-18T10:00:00.000Z",
    updatedAt: "2026-06-18T10:00:00.000Z",
    ...overrides,
  };
}

function expectApiError(error: unknown, status: number, code: string) {
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBooking", () => {
  it("creates bookings inside a transaction and calculates price from the stored room price", async () => {
    mockedTransaction.mockImplementationOnce(async (callback) => {
      const fakeSql = (strings: TemplateStringsArray) => ({
        text: strings.join("?"),
      });
      const transactionCallback = callback as unknown as (
        sql: typeof fakeSql,
      ) => Array<{ text: string }>;
      const queries = transactionCallback(fakeSql);

      expect(queries).toHaveLength(2);
      expect(queries[1]?.text).toContain("room.nightly_price *");
      expect(queries[1]?.text).toContain("returning");

      return [[roomRow()], [reservationRow()]] as never;
    });

    const reservation = await createBooking(input);

    expect(reservation).toMatchObject({
      id: RESERVATION_ID,
      roomId: ROOM_ID,
      guestId: GUEST_ID,
      totalPrice: 50000,
      status: "confirmed",
    });
  });

  it("maps overlap exclusion violations to a conflict response", async () => {
    mockedTransaction.mockRejectedValueOnce(
      Object.assign(new Error("exclusion violation"), { code: "23P01" }),
    );

    await expect(createBooking(input)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Room is no longer available for those dates.",
    });
  });

  it("simulates concurrent booking attempts as one success and one conflict", async () => {
    mockedTransaction
      .mockResolvedValueOnce([[roomRow()], [reservationRow()]] as never)
      .mockRejectedValueOnce(
        Object.assign(new Error("exclusion violation"), { code: "23P01" }),
      );

    const results = await Promise.allSettled([
      createBooking(input),
      createBooking(input),
    ]);

    expect(results[0]).toMatchObject({
      status: "fulfilled",
      value: expect.objectContaining({ id: RESERVATION_ID }),
    });
    expect(results[1].status).toBe("rejected");
    if (results[1].status === "rejected") {
      expectApiError(results[1].reason, 409, "CONFLICT");
    }
  });

  it("returns not found when the room does not exist", async () => {
    mockedTransaction.mockResolvedValueOnce([[], []] as never);

    await expect(createBooking(input)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Room was not found.",
    });
  });

  it("rejects inactive rooms before reporting capacity problems", async () => {
    mockedTransaction.mockResolvedValueOnce([
      [roomRow({ active: false, maxGuests: 1 })],
      [],
    ] as never);

    await expect(createBooking(input)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Room is not active.",
    });
  });

  it("rejects rooms that cannot accommodate the requested guest count", async () => {
    mockedTransaction.mockResolvedValueOnce([
      [roomRow({ active: true, maxGuests: 1 })],
      [],
    ] as never);

    await expect(createBooking(input)).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
      message: "Room cannot accommodate the requested guest count.",
    });
  });
});
