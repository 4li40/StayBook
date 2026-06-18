import { describe, expect, it, vi } from "vitest";

vi.mock("@StayBook/auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
    },
  },
}));

vi.mock("@StayBook/db", () => ({
  db: {},
}));

vi.mock("@StayBook/env/server", () => ({
  env: {
    BETTER_AUTH_URL: "http://localhost:3000",
    CORS_ORIGIN: "http://localhost:3001",
  },
}));

import {
  GUEST_USERS,
  ROOM_AMENITY_MAP,
  ROOM_PHOTOS,
  ROOMS,
  SEED_RESERVATIONS,
  STAFF_USER,
  differenceInNights,
} from "./seed";

function rangesOverlap(
  first: { checkInOffsetDays: number; checkOutOffsetDays: number },
  second: { checkInOffsetDays: number; checkOutOffsetDays: number },
) {
  return (
    first.checkInOffsetDays < second.checkOutOffsetDays &&
    second.checkInOffsetDays < first.checkOutOffsetDays
  );
}

describe("seed plan", () => {
  it("defines deterministic reviewer users and at least ten active rooms", () => {
    const roomNames = new Set(ROOMS.map((room) => room.name));
    const guestEmails = new Set(GUEST_USERS.map((guest) => guest.email));

    expect(ROOMS.length).toBeGreaterThanOrEqual(10);
    expect(roomNames.size).toBe(ROOMS.length);
    expect(ROOMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Overlap Demo Queen" }),
        expect.objectContaining({ name: "Turnover Studio" }),
      ]),
    );
    expect(ROOMS.every((room) => room.maxGuests > 0 && room.nightlyPrice > 0)).toBe(true);

    expect(STAFF_USER).toMatchObject({
      email: "staff@staybook.test",
      password: "StayBook123!",
      role: "staff",
    });
    expect(GUEST_USERS.length).toBeGreaterThanOrEqual(3);
    expect(guestEmails.size).toBe(GUEST_USERS.length);
    expect(GUEST_USERS.every((guest) => guest.password === "StayBook123!")).toBe(true);
    expect(GUEST_USERS.every((guest) => guest.role === "guest")).toBe(true);
  });

  it("keeps photos and amenities aligned with every seeded room", () => {
    for (const room of ROOMS) {
      expect(ROOM_PHOTOS[room.name]?.length).toBeGreaterThanOrEqual(1);
      expect(ROOM_AMENITY_MAP[room.name]?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("covers active, upcoming, past, cancelled, overlap, and turnover scenarios", () => {
    const hasActive = SEED_RESERVATIONS.some(
      (reservation) =>
        reservation.status === "confirmed" &&
        reservation.checkInOffsetDays <= 0 &&
        reservation.checkOutOffsetDays > 0,
    );
    const hasUpcoming = SEED_RESERVATIONS.some(
      (reservation) =>
        reservation.status === "confirmed" && reservation.checkInOffsetDays > 0,
    );
    const hasPast = SEED_RESERVATIONS.some(
      (reservation) =>
        reservation.status === "confirmed" && reservation.checkOutOffsetDays <= 0,
    );
    const hasCancelled = SEED_RESERVATIONS.some(
      (reservation) => reservation.status === "cancelled",
    );
    const hasCancelledOverlap = SEED_RESERVATIONS.some(
      (cancelled) =>
        cancelled.status === "cancelled" &&
        SEED_RESERVATIONS.some(
          (confirmed) =>
            confirmed.status === "confirmed" &&
            confirmed.roomName === cancelled.roomName &&
            rangesOverlap(confirmed, cancelled),
        ),
    );
    const hasSameDayTurnover = SEED_RESERVATIONS.some((first) =>
      SEED_RESERVATIONS.some(
        (second) =>
          first.roomName === second.roomName &&
          first.status === "confirmed" &&
          second.status === "confirmed" &&
          first.checkOutOffsetDays === second.checkInOffsetDays,
      ),
    );

    expect(hasActive).toBe(true);
    expect(hasUpcoming).toBe(true);
    expect(hasPast).toBe(true);
    expect(hasCancelled).toBe(true);
    expect(hasCancelledOverlap).toBe(true);
    expect(hasSameDayTurnover).toBe(true);
  });

  it("does not define illegal overlapping confirmed reservations for one room", () => {
    const confirmedReservations = SEED_RESERVATIONS.filter(
      (reservation) => reservation.status === "confirmed",
    );

    for (const [index, first] of confirmedReservations.entries()) {
      for (const second of confirmedReservations.slice(index + 1)) {
        if (first.roomName !== second.roomName) {
          continue;
        }

        expect(rangesOverlap(first, second)).toBe(false);
      }
    }
  });

  it("only references seeded rooms and users, and always has positive stay lengths", () => {
    const roomNames = new Set(ROOMS.map((room) => room.name));
    const guestEmails = new Set(GUEST_USERS.map((guest) => guest.email));
    const userEmails = new Set([STAFF_USER.email, ...guestEmails]);

    for (const reservation of SEED_RESERVATIONS) {
      expect(roomNames.has(reservation.roomName)).toBe(true);
      expect(guestEmails.has(reservation.guestEmail)).toBe(true);

      if (reservation.cancelledByEmail) {
        expect(userEmails.has(reservation.cancelledByEmail)).toBe(true);
      }

      expect(reservation.checkOutOffsetDays).toBeGreaterThan(
        reservation.checkInOffsetDays,
      );
    }
  });

  it("keeps the seed price helper aligned with whole-night stays", () => {
    expect(differenceInNights("2027-01-10", "2027-01-12")).toBe(2);
    expect(differenceInNights("2027-01-12", "2027-01-13")).toBe(1);
  });
});
