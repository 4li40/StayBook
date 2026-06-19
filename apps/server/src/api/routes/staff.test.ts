import { db } from "@StayBook/db";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../http";
import { staffRouter } from "./staff";

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
}));

const app = express();
app.use(express.json());
app.use("/api/staff", staffRouter);
app.use(errorHandler);

const mockedExecute = vi.mocked(db.execute);

const ROOM_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const INACTIVE_ROOM_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const RESERVATION_ID = "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const STAFF_ID = "staff-user-1";

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

function authenticateAs(role: "guest" | "staff") {
  authState.session = {
    user: {
      id: role === "staff" ? STAFF_ID : "guest-user-1",
      role,
      name: role === "staff" ? "Staff User" : "Guest User",
      email: `${role}@staybook.test`,
    },
  };
}

function staffRoomRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    name: "Deluxe Suite",
    type: "suite",
    description: "A nice room",
    maxGuests: 2,
    nightlyPrice: 25000,
    active: true,
    primaryPhotoUrl: null,
    photos: [],
    amenities: [],
    ...overrides,
  };
}

function staffReservationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RESERVATION_ID,
    roomId: ROOM_ID,
    guestId: "guest-user-1",
    checkInDate: "2099-01-10",
    checkOutDate: "2099-01-12",
    totalPrice: 50000,
    status: "confirmed",
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdAt: "2026-06-18T10:00:00.000Z",
    updatedAt: "2026-06-18T10:00:00.000Z",
    roomName: "Deluxe Suite",
    roomType: "suite",
    roomMaxGuests: 2,
    roomNightlyPrice: 25000,
    roomPrimaryPhotoUrl: null,
    guestName: "Guest User",
    guestEmail: "guest@staybook.test",
    ...overrides,
  };
}

const validRoomPhoto = {
  url: "https://example.com/rooms/garden-loft.jpg",
  altText: "Garden loft exterior",
  isPrimary: true,
};

const validRoomBody = {
  name: "Garden Loft",
  type: "loft",
  description: "A quiet loft beside the garden.",
  maxGuests: 2,
  nightlyPrice: 30000,
  amenityIds: [],
  photos: [validRoomPhoto],
};

beforeEach(() => {
  authState.session = null;
  vi.clearAllMocks();
});

describe("staff authorization", () => {
  it("returns 401 for unauthenticated staff API access", async () => {
    const roomsRes = await request(app).get("/api/staff/rooms");
    const reservationsRes = await request(app).get("/api/staff/reservations");

    expect(roomsRes.status).toBe(401);
    expect(reservationsRes.status).toBe(401);
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("returns 403 for guests across the staff API group", async () => {
    authenticateAs("guest");

    const responses = await Promise.all([
      request(app).get("/api/staff/amenities"),
      request(app).get("/api/staff/rooms"),
      request(app).post("/api/staff/rooms").send(validRoomBody),
      request(app).patch(`/api/staff/rooms/${ROOM_ID}`).send(validRoomBody),
      request(app).post(`/api/staff/rooms/${ROOM_ID}/deactivate`).send({}),
      request(app).post(`/api/staff/rooms/${ROOM_ID}/reactivate`).send({}),
      request(app).delete(`/api/staff/rooms/${ROOM_ID}`),
      request(app).get("/api/staff/reservations"),
      request(app).post(`/api/staff/reservations/${RESERVATION_ID}/cancel`).send({}),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({
        code: "FORBIDDEN",
        message: "A staff account is required.",
      });
    }
    expect(mockedExecute).not.toHaveBeenCalled();
  });
});

describe("staff room management", () => {
  it("lists active and inactive rooms for staff", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(
        mockResult([{ total: "2", active: "1", inactive: "1" }]),
      )
      .mockResolvedValueOnce(mockResult([
        staffRoomRow(),
        staffRoomRow({
          id: INACTIVE_ROOM_ID,
          name: "Archived Studio",
          active: false,
        }),
      ]));

    const res = await request(app).get("/api/staff/rooms?page=1&pageSize=1");

    expect(res.status).toBe(200);
    expect(res.body.data.rooms).toEqual([
      expect.objectContaining({ id: ROOM_ID, active: true }),
      expect.objectContaining({ id: INACTIVE_ROOM_ID, active: false }),
    ]);
    expect(res.body.data.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      pageCount: 2,
    });
    expect(res.body.data.summary).toEqual({
      total: 2,
      active: 1,
      inactive: 1,
    });

    const listSql = normalizeSql(mockedExecute.mock.calls[1]?.[0]);
    expect(listSql).toContain("limit");
    expect(listSql).toContain("offset");
  });

  it("rejects invalid room pagination", async () => {
    authenticateAs("staff");

    const res = await request(app).get("/api/staff/rooms?page=0&pageSize=101");

    expect(res.status).toBe(400);
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("validates required room fields, invalid prices, and unexpected fields", async () => {
    authenticateAs("staff");

    const missingRequired = await request(app).post("/api/staff/rooms").send({
      name: "Incomplete Room",
    });
    const invalidPrice = await request(app).post("/api/staff/rooms").send({
      ...validRoomBody,
      nightlyPrice: 0,
    });
    const unexpectedField = await request(app).post("/api/staff/rooms").send({
      ...validRoomBody,
      id: ROOM_ID,
    });
    const missingPhotos = await request(app)
      .post("/api/staff/rooms")
      .send({ ...validRoomBody, photos: [] });
    const omittedPhotos = await request(app)
      .post("/api/staff/rooms")
      .send({ ...validRoomBody, photos: undefined });

    expect(missingRequired.status).toBe(400);
    expect(invalidPrice.status).toBe(400);
    expect(invalidPrice.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "nightlyPrice" })]),
    );
    expect(unexpectedField.status).toBe(400);
    expect(missingPhotos.status).toBe(400);
    expect(missingPhotos.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "photos", message: "Add at least one photo." }),
      ]),
    );
    expect(omittedPhotos.status).toBe(400);
    expect(omittedPhotos.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "photos" })]),
    );
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("rejects rooms with more than 12 photos", async () => {
    authenticateAs("staff");

    const tooManyPhotos = Array.from({ length: 13 }, (_, index) => ({
      url: `https://example.com/rooms/garden-loft-${index}.jpg`,
      isPrimary: index === 0,
    }));

    const res = await request(app)
      .post("/api/staff/rooms")
      .send({ ...validRoomBody, photos: tooManyPhotos });

    expect(res.status).toBe(400);
    expect(res.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "photos",
          message: "A room can have at most 12 photos.",
        }),
      ]),
    );
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("rejects room updates that drop every photo", async () => {
    authenticateAs("staff");

    const res = await request(app)
      .patch(`/api/staff/rooms/${ROOM_ID}`)
      .send({ ...validRoomBody, photos: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "photos", message: "Add at least one photo." }),
      ]),
    );
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("creates rooms with server-managed active status and relations", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(mockResult([{ id: ROOM_ID }]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([staffRoomRow(validRoomBody)]));

    const res = await request(app).post("/api/staff/rooms").send(validRoomBody);

    expect(res.status).toBe(201);
    expect(res.body.data.room).toMatchObject({
      id: ROOM_ID,
      name: validRoomBody.name,
      active: true,
      nightlyPrice: validRoomBody.nightlyPrice,
    });
  });

  it("edits rooms and replaces room relations", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(mockResult([{ id: ROOM_ID }]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(mockResult([]))
      .mockResolvedValueOnce(
        mockResult([
          staffRoomRow({
            name: "Updated Loft",
            nightlyPrice: 35000,
          }),
        ]),
      );

    const res = await request(app)
      .patch(`/api/staff/rooms/${ROOM_ID}`)
      .send({
        ...validRoomBody,
        name: "Updated Loft",
        nightlyPrice: 35000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.room).toMatchObject({
      id: ROOM_ID,
      name: "Updated Loft",
      nightlyPrice: 35000,
    });
  });

  it("deactivates and reactivates rooms without deleting them", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(mockResult([{ id: ROOM_ID }]))
      .mockResolvedValueOnce(mockResult([staffRoomRow({ active: false })]))
      .mockResolvedValueOnce(mockResult([{ id: ROOM_ID }]))
      .mockResolvedValueOnce(mockResult([staffRoomRow({ active: true })]));

    const deactivateRes = await request(app).post(
      `/api/staff/rooms/${ROOM_ID}/deactivate`,
    );
    const reactivateRes = await request(app).post(
      `/api/staff/rooms/${ROOM_ID}/reactivate`,
    );

    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.room.active).toBe(false);
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.room.active).toBe(true);
  });

  it("deletes an inactive room with no reservation history", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(mockResult([{ id: INACTIVE_ROOM_ID, active: false }]))
      .mockResolvedValueOnce(mockResult([{ id: INACTIVE_ROOM_ID }]));

    const res = await request(app).delete(`/api/staff/rooms/${INACTIVE_ROOM_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.roomId).toBe(INACTIVE_ROOM_ID);
  });

  it("rejects deleting an active room", async () => {
    authenticateAs("staff");
    mockedExecute.mockResolvedValueOnce(
      mockResult([{ id: ROOM_ID, active: true }]),
    );

    const res = await request(app).delete(`/api/staff/rooms/${ROOM_ID}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "ROOM_ACTIVE",
    });
    expect(mockedExecute).toHaveBeenCalledTimes(1);
  });

  it("rejects deleting a room with reservation history", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(
        mockResult([{ id: INACTIVE_ROOM_ID, active: false }]),
      )
      .mockResolvedValueOnce(mockResult([]));

    const res = await request(app).delete(`/api/staff/rooms/${INACTIVE_ROOM_ID}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "ROOM_HAS_RESERVATIONS",
    });
  });

  it("returns 404 when deleting a missing room", async () => {
    authenticateAs("staff");
    mockedExecute.mockResolvedValueOnce(mockResult([]));

    const res = await request(app).delete(`/api/staff/rooms/${INACTIVE_ROOM_ID}`);

    expect(res.status).toBe(404);
  });
});

describe("staff reservation management", () => {
  it("filters reservations by room, date range, status, and derived state", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(mockResult([{ total: "3" }]))
      .mockResolvedValueOnce(mockResult([staffReservationRow()]));

    const res = await request(app).get(
      `/api/staff/reservations?roomId=${ROOM_ID}&status=confirmed&state=upcoming&dateFrom=2099-01-01&dateTo=2099-02-01&page=2&pageSize=1`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toEqual({
      page: 2,
      pageSize: 1,
      total: 3,
      pageCount: 3,
    });
    expect(res.body.data.reservations[0]).toMatchObject({
      id: RESERVATION_ID,
      state: "upcoming",
      guest: {
        email: "guest@staybook.test",
      },
    });

    const sqlText = normalizeSql(mockedExecute.mock.calls[0]?.[0]);
    expect(sqlText).toContain("reservation.room_id =");
    expect(sqlText).toContain("reservation.status =");
    expect(sqlText).toContain("reservation.check_in_date >");
    expect(sqlText).toContain("daterange(reservation.check_in_date, reservation.check_out_date, '[)')");
  });

  it("rejects invalid staff reservation filters", async () => {
    authenticateAs("staff");

    const invalidPagination = await request(app).get(
      "/api/staff/reservations?pageSize=0",
    );
    const invalidDateRange = await request(app).get(
      "/api/staff/reservations?dateFrom=2099-02-01&dateTo=2099-01-01",
    );
    const conflictingState = await request(app).get(
      "/api/staff/reservations?status=confirmed&state=cancelled",
    );

    expect(invalidPagination.status).toBe(400);
    expect(invalidDateRange.status).toBe(400);
    expect(conflictingState.status).toBe(400);
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("allows staff to manually cancel a confirmed reservation", async () => {
    authenticateAs("staff");
    mockedExecute
      .mockResolvedValueOnce(
        mockResult([
          {
            id: RESERVATION_ID,
            status: "confirmed",
          },
        ]),
      )
      .mockResolvedValueOnce(mockResult([{ id: RESERVATION_ID }]))
      .mockResolvedValueOnce(
        mockResult([
          staffReservationRow({
            status: "cancelled",
            state: "cancelled",
            cancelledByUserId: STAFF_ID,
            cancellationReason: "Maintenance",
          }),
        ]),
      );

    const res = await request(app)
      .post(`/api/staff/reservations/${RESERVATION_ID}/cancel`)
      .send({ cancellationReason: "Maintenance" });

    expect(res.status).toBe(200);
    expect(res.body.data.reservation).toMatchObject({
      id: RESERVATION_ID,
      status: "cancelled",
      state: "cancelled",
      cancelledByUserId: STAFF_ID,
      cancellationReason: "Maintenance",
    });
  });
});
