import { db } from "@StayBook/db";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { errorHandler } from "../http";
import { roomsRouter } from "./rooms";

vi.mock("@StayBook/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use("/api/rooms", roomsRouter);
app.use(errorHandler);

const mockedExecute = vi.mocked(db.execute);

function mockResult(rows: Record<string, unknown>[]) {
  return { rows } as never;
}

function getSqlString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  if ("queryChunks" in value && Array.isArray(value.queryChunks)) {
    return value.queryChunks.map(getSqlString).join("");
  }

  if ("value" in value) {
    const chunkValue = value.value;
    return Array.isArray(chunkValue)
      ? chunkValue.map(String).join("")
      : String(chunkValue);
  }

  return "";
}

function normalizeSql(sqlObj: unknown): string {
  return getSqlString(sqlObj).replace(/\s+/g, " ").trim();
}

const ACTIVE_ROOM_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MISSING_ROOM_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const AMENITY_ID = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

function roomListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVE_ROOM_ID,
    name: "Deluxe Suite",
    type: "suite",
    description: "A nice room",
    maxGuests: 2,
    nightlyPrice: 29999,
    primaryPhotoUrl: null,
    amenities: [{ id: AMENITY_ID, name: "Wi-Fi" }],
    booked: false,
    ...overrides,
  };
}

function availabilityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVE_ROOM_ID,
    active: true,
    maxGuests: 2,
    nightlyPrice: 25000,
    hasOverlappingReservation: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/rooms", () => {
  it("returns available active rooms for a valid date and guest search", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([roomListRow()]));

    const res = await request(app).get(
      "/api/rooms?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=2",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.rooms).toEqual([
      expect.objectContaining({
        id: ACTIVE_ROOM_ID,
        booked: false,
        maxGuests: 2,
      }),
    ]);
  });

  it("marks overlapping confirmed reservations as booked in date-based searches", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([roomListRow()]));

    await request(app).get(
      "/api/rooms?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=2",
    );

    const sqlText = normalizeSql(mockedExecute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("room.active = true");
    expect(sqlText).toContain("room.max_guests >=");
    expect(sqlText).toContain("exists");
    expect(sqlText).toContain("reservation.status = 'confirmed'");
    expect(sqlText).toContain("daterange(reservation.check_in_date, reservation.check_out_date, '[)')");
    expect(sqlText).not.toContain("and not exists");
  });

  it("does not add an overlap filter when dates are omitted", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([roomListRow()]));

    await request(app).get("/api/rooms?guests=1");

    const sqlText = normalizeSql(mockedExecute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("false as booked");
    expect(sqlText).not.toContain("and not exists");
  });

  it("rejects malformed or impossible search dates", async () => {
    const res = await request(app).get(
      "/api/rooms?checkInDate=2027-02-30&checkOutDate=2027-03-02&guests=2",
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(res.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "checkInDate",
          message: "Use a real calendar date.",
        }),
      ]),
    );
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("rejects partial date ranges and invalid guest counts", async () => {
    const missingCheckout = await request(app).get(
      "/api/rooms?checkInDate=2027-01-10&guests=2",
    );
    const invalidGuests = await request(app).get(
      "/api/rooms?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=0",
    );

    expect(missingCheckout.status).toBe(400);
    expect(missingCheckout.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "checkOutDate",
          message: "checkOutDate is required when checkInDate is provided.",
        }),
      ]),
    );
    expect(invalidGuests.status).toBe(400);
    expect(mockedExecute).not.toHaveBeenCalled();
  });
});

describe("GET /api/rooms/:roomId", () => {
  it("returns 200 for an active room", async () => {
    mockedExecute.mockResolvedValueOnce(
      mockResult([
        {
          id: ACTIVE_ROOM_ID,
          name: "Deluxe Suite",
          type: "suite",
          description: "A nice room",
          maxGuests: 2,
          nightlyPrice: 29999,
          photos: [],
          amenities: [],
        },
      ]),
    );

    const res = await request(app).get(`/api/rooms/${ACTIVE_ROOM_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: ACTIVE_ROOM_ID,
      name: "Deluxe Suite",
      nightlyPrice: 29999,
    });
  });

  it("returns 404 for a missing room", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([]));

    const res = await request(app).get(`/api/rooms/${MISSING_ROOM_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Room was not found.",
    });
  });

  it("filters inactive rooms in the detail query", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([]));

    await request(app).get(`/api/rooms/${MISSING_ROOM_ID}`);

    const sqlArg = mockedExecute.mock.calls[0]?.[0];
    expect(normalizeSql(sqlArg)).toContain("room.active = true");
  });
});

describe("GET /api/rooms/:roomId/availability", () => {
  it("returns available with nights and estimate for a valid stay", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([availabilityRow()]));

    const res = await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=2`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      roomId: ACTIVE_ROOM_ID,
      available: true,
      nights: 2,
      estimatedTotalPrice: "50000.00",
      reasons: {
        inactive: false,
        insufficientCapacity: false,
        overlappingReservation: false,
      },
    });
  });

  it("marks inactive rooms as unavailable", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([availabilityRow({ active: false })]));

    const res = await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=2`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
    expect(res.body.data.reasons.inactive).toBe(true);
  });

  it("marks rooms below requested capacity as unavailable", async () => {
    mockedExecute.mockResolvedValueOnce(mockResult([availabilityRow({ maxGuests: 2 })]));

    const res = await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=3`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
    expect(res.body.data.reasons.insufficientCapacity).toBe(true);
  });

  it("marks overlapping confirmed reservations as unavailable", async () => {
    mockedExecute.mockResolvedValueOnce(
      mockResult([availabilityRow({ hasOverlappingReservation: true })]),
    );

    const res = await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=2`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
    expect(res.body.data.reasons.overlappingReservation).toBe(true);
  });

  it("allows same-day checkout/check-in when the half-open overlap check is clear", async () => {
    mockedExecute.mockResolvedValueOnce(
      mockResult([availabilityRow({ hasOverlappingReservation: false })]),
    );

    const res = await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-12&checkOutDate=2027-01-14&guests=2`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);

    const sqlText = normalizeSql(mockedExecute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("reservation.status = 'confirmed'");
    expect(sqlText).toContain("daterange(reservation.check_in_date, reservation.check_out_date, '[)')");
  });

  it("treats cancelled reservations as non-blocking because only confirmed rows are checked", async () => {
    mockedExecute.mockResolvedValueOnce(
      mockResult([availabilityRow({ hasOverlappingReservation: false })]),
    );

    await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=2`,
    );

    const sqlText = normalizeSql(mockedExecute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("reservation.status = 'confirmed'");
    expect(sqlText).not.toContain("reservation.status = 'cancelled'");
  });

  it("rejects invalid availability dates and guest counts", async () => {
    const invalidDates = await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-12&checkOutDate=2027-01-12&guests=2`,
    );
    const invalidGuests = await request(app).get(
      `/api/rooms/${ACTIVE_ROOM_ID}/availability?checkInDate=2027-01-10&checkOutDate=2027-01-12&guests=25`,
    );

    expect(invalidDates.status).toBe(400);
    expect(invalidGuests.status).toBe(400);
  });
});
