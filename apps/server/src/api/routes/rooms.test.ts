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

function getSqlString(sqlObj: unknown): string {
  const chunks = (sqlObj as { queryChunks: unknown[] }).queryChunks;
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string") return chunk;
      if (chunk && typeof chunk === "object" && "value" in chunk) {
        return String((chunk as { value: unknown }).value);
      }
      return "";
    })
    .join("");
}

const ACTIVE_ROOM_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MISSING_ROOM_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(getSqlString(sqlArg)).toContain("room.active = true");
  });
});
