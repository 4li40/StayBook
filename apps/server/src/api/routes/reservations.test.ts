import { db, neonSql } from "@StayBook/db";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../http";
import { reservationsRouter } from "./reservations";

const authState = vi.hoisted(() => ({
  session: null as unknown,
}));

vi.mock("@StayBook/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => authState.session),
    },
  },
}));

vi.mock("@StayBook/db", () => ({
  db: {
    execute: vi.fn(),
  },
  neonSql: {
    transaction: vi.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use("/api/reservations", reservationsRouter);
app.use(errorHandler);

const mockedExecute = vi.mocked(db.execute);
const mockedTransaction = vi.mocked(neonSql.transaction);

const ROOM_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const RESERVATION_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const GUEST_ID = "guest-user-1";
const STAFF_ID = "staff-user-1";

let dateNowSpy: ReturnType<typeof vi.spyOn> | undefined;

function mockResult(rows: Record<string, unknown>[]) {
  return { rows } as never;
}

function authenticateAs(role: "guest" | "staff") {
  const id = role === "guest" ? GUEST_ID : STAFF_ID;
  authState.session = {
    user: {
      id,
      role,
      name: role === "guest" ? "Guest User" : "Staff User",
      email: `${role}@staybook.test`,
    },
  };
}

function setNow(value: string) {
  dateNowSpy?.mockRestore();
  dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.parse(value));
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

function reservationListRow(overrides: Record<string, unknown> = {}) {
  return {
    ...reservationRow(),
    roomName: "Deluxe Suite",
    roomType: "suite",
    roomMaxGuests: 2,
    roomNightlyPrice: 25000,
    roomPrimaryPhotoUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  dateNowSpy?.mockRestore();
  dateNowSpy = undefined;
  authState.session = null;
  vi.clearAllMocks();
});

describe("guest reservation authorization", () => {
  it("returns 401 for unauthenticated guest reservation access", async () => {
    const listRes = await request(app).get("/api/reservations/me");
    const createRes = await request(app).post("/api/reservations").send({});

    expect(listRes.status).toBe(401);
    expect(createRes.status).toBe(401);
    expect(mockedExecute).not.toHaveBeenCalled();
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("returns 403 when staff accounts call guest-only booking APIs", async () => {
    authenticateAs("staff");

    const res = await request(app).post("/api/reservations").send({
      roomId: ROOM_ID,
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-12",
      guestCount: 2,
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({
      code: "FORBIDDEN",
      message: "A guest account is required.",
    });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/reservations", () => {
  it("creates a reservation for an authenticated guest", async () => {
    authenticateAs("guest");
    mockedTransaction.mockResolvedValueOnce([
      [
        {
          id: ROOM_ID,
          active: true,
          maxGuests: 2,
          nightlyPrice: 25000,
        },
      ],
      [reservationRow()],
    ] as never);
    mockedExecute.mockResolvedValueOnce(mockResult([reservationListRow()]));

    const res = await request(app).post("/api/reservations").send({
      roomId: ROOM_ID,
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-12",
      guestCount: 2,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.reservation).toMatchObject({
      id: RESERVATION_ID,
      roomId: ROOM_ID,
      guestId: GUEST_ID,
      totalPrice: 50000,
      status: "confirmed",
      state: "upcoming",
      room: expect.objectContaining({
        id: ROOM_ID,
        name: "Deluxe Suite",
        type: "suite",
        maxGuests: 2,
        nightlyPrice: 25000,
        primaryPhotoUrl: null,
      }),
    });
  });

  it("returns a clear conflict response for booking overlap failures", async () => {
    authenticateAs("guest");
    mockedTransaction.mockRejectedValueOnce(
      Object.assign(new Error("exclusion violation"), { code: "23P01" }),
    );

    const res = await request(app).post("/api/reservations").send({
      roomId: ROOM_ID,
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-12",
      guestCount: 2,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: "CONFLICT",
      message: "Room is no longer available for those dates.",
    });
  });

  it("rejects malformed dates, invalid guest counts, and missing fields", async () => {
    authenticateAs("guest");

    const malformedDates = await request(app).post("/api/reservations").send({
      roomId: ROOM_ID,
      checkInDate: "2027-02-30",
      checkOutDate: "2027-03-02",
      guestCount: 2,
    });
    const invalidGuests = await request(app).post("/api/reservations").send({
      roomId: ROOM_ID,
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-12",
      guestCount: 0,
    });
    const missingFields = await request(app).post("/api/reservations").send({
      roomId: ROOM_ID,
    });

    expect(malformedDates.status).toBe(400);
    expect(malformedDates.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "checkInDate" }),
      ]),
    );
    expect(invalidGuests.status).toBe(400);
    expect(invalidGuests.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "guestCount" })]),
    );
    expect(missingFields.status).toBe(400);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it("strips unexpected client fields before creating a booking", async () => {
    authenticateAs("guest");
    mockedTransaction.mockResolvedValueOnce([
      [
        {
          id: ROOM_ID,
          active: true,
          maxGuests: 2,
          nightlyPrice: 25000,
        },
      ],
      [reservationRow({ totalPrice: 50000 })],
    ] as never);
    mockedExecute.mockResolvedValueOnce(
      mockResult([reservationListRow({ totalPrice: 50000 })]),
    );

    const res = await request(app).post("/api/reservations").send({
      roomId: ROOM_ID,
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-12",
      guestCount: 2,
      totalPrice: 1,
      status: "cancelled",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.reservation.totalPrice).toBe(50000);
    expect(res.body.data.reservation.status).toBe("confirmed");
  });
});

describe("GET /api/reservations/me", () => {
  it("returns paginated reservations with metadata", async () => {
    authenticateAs("guest");
    mockedExecute
      .mockResolvedValueOnce(mockResult([{ total: "2" }]))
      .mockResolvedValueOnce(mockResult([reservationListRow()]));

    const res = await request(app).get(
      "/api/reservations/me?page=2&pageSize=1&state=upcoming",
    );

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toEqual({
      page: 2,
      pageSize: 1,
      total: 2,
      pageCount: 2,
    });
    expect(res.body.data.reservations).toEqual([
      expect.objectContaining({
        id: RESERVATION_ID,
        room: expect.objectContaining({
          id: ROOM_ID,
          name: "Deluxe Suite",
        }),
      }),
    ]);
  });

  it("rejects invalid pagination values and unexpected query parameters", async () => {
    authenticateAs("guest");

    const invalidPage = await request(app).get("/api/reservations/me?page=0");
    const unexpected = await request(app).get(
      "/api/reservations/me?page=1&sort=createdAt",
    );

    expect(invalidPage.status).toBe(400);
    expect(unexpected.status).toBe(400);
    expect(mockedExecute).not.toHaveBeenCalled();
  });
});

describe("POST /api/reservations/:reservationId/cancel", () => {
  it("allows guest cancellation more than 24 hours before check-in", async () => {
    authenticateAs("guest");
    setNow("2027-01-08T23:00:00.000Z");
    mockedExecute
      .mockResolvedValueOnce(
        mockResult([
          {
            id: RESERVATION_ID,
            checkInDate: "2027-01-10",
            status: "confirmed",
          },
        ]),
      )
      .mockResolvedValueOnce(
        mockResult([
          reservationRow({
            status: "cancelled",
            cancelledByUserId: GUEST_ID,
            cancellationReason: "Plans changed",
          }),
        ]),
      );

    const res = await request(app)
      .post(`/api/reservations/${RESERVATION_ID}/cancel`)
      .send({ cancellationReason: "Plans changed" });

    expect(res.status).toBe(200);
    expect(res.body.data.reservation).toMatchObject({
      id: RESERVATION_ID,
      status: "cancelled",
      cancelledByUserId: GUEST_ID,
      cancellationReason: "Plans changed",
    });
  });

  it("rejects cancellation exactly at the 24-hour cutoff", async () => {
    authenticateAs("guest");
    setNow("2027-01-09T00:00:00.000Z");
    mockedExecute.mockResolvedValueOnce(
      mockResult([
        {
          id: RESERVATION_ID,
          checkInDate: "2027-01-10",
          status: "confirmed",
        },
      ]),
    );

    const res = await request(app)
      .post(`/api/reservations/${RESERVATION_ID}/cancel`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      "Reservation cannot be cancelled within 24 hours of check-in.",
    );
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });

  it("rejects cancellation inside the 24-hour cutoff", async () => {
    authenticateAs("guest");
    setNow("2027-01-09T01:00:00.000Z");
    mockedExecute.mockResolvedValueOnce(
      mockResult([
        {
          id: RESERVATION_ID,
          checkInDate: "2027-01-10",
          status: "confirmed",
        },
      ]),
    );

    const res = await request(app)
      .post(`/api/reservations/${RESERVATION_ID}/cancel`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });
});
