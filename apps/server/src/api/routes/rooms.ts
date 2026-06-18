import { db } from "@StayBook/db";
import { sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { differenceInNights, stayDateRangeSchema } from "../dates";
import { ApiError, asyncHandler, sendData } from "../http";
import { overlappingReservationExistsSql } from "../../services/booking";

type AmenitySummary = {
  id: string;
  name: string;
};

type PhotoRow = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

type RoomListRow = {
  id: string;
  name: string;
  type: string;
  description: string;
  maxGuests: number;
  nightlyPrice: number;
  primaryPhotoUrl: string | null;
  amenities: AmenitySummary[];
  booked: boolean;
};

type RoomDetailRow = {
  id: string;
  name: string;
  type: string;
  description: string;
  maxGuests: number;
  nightlyPrice: number;
  photos: PhotoRow[];
  amenities: AmenitySummary[];
};

type AvailabilityRow = {
  id: string;
  active: boolean;
  maxGuests: number;
  nightlyPrice: number;
  hasOverlappingReservation: boolean;
};

const roomsQuerySchema = z
  .object({
    checkInDate: z.string().optional(),
    checkOutDate: z.string().optional(),
    guests: z.coerce.number().int().min(1).max(20).default(1),
  })
  .superRefine((value, ctx) => {
    if (!value.checkInDate && !value.checkOutDate) {
      return;
    }

    if (!value.checkInDate) {
      ctx.addIssue({
        code: "custom",
        path: ["checkInDate"],
        message: "checkInDate is required when checkOutDate is provided.",
      });
      return;
    }

    if (!value.checkOutDate) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOutDate"],
        message: "checkOutDate is required when checkInDate is provided.",
      });
      return;
    }

    const result = stayDateRangeSchema.safeParse({
      checkInDate: value.checkInDate,
      checkOutDate: value.checkOutDate,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });

const roomParamsSchema = z.object({
  roomId: z.string().uuid(),
});

const availabilityQuerySchema = stayDateRangeSchema.extend({
  guests: z.coerce.number().int().min(1).max(20).default(1),
});

export const roomsRouter = Router();

roomsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = roomsQuerySchema.parse(req.query);
    const hasDates = Boolean(query.checkInDate && query.checkOutDate);
    const bookedColumn = hasDates
      ? overlappingReservationExistsSql(
          sql`room.id`,
          query.checkInDate!,
          query.checkOutDate!,
        )
      : sql`false`;
    const availabilityClause = hasDates ? sql`and not ${bookedColumn}` : sql``;

    const result = await db.execute<RoomListRow>(sql`
      select
        room.id,
        room.name,
        room.type,
        room.description,
        room.max_guests as "maxGuests",
        room.nightly_price as "nightlyPrice",
        primary_photo.url as "primaryPhotoUrl",
        coalesce(
          json_agg(
            distinct jsonb_build_object('id', amenity.id, 'name', amenity.name)
          ) filter (where amenity.id is not null),
          '[]'::json
        ) as amenities,
        ${bookedColumn} as booked
      from rooms room
      left join room_photos primary_photo
        on primary_photo.room_id = room.id
        and primary_photo.is_primary = true
      left join room_amenities room_amenity
        on room_amenity.room_id = room.id
      left join amenities amenity
        on amenity.id = room_amenity.amenity_id
      where room.active = true
        and room.max_guests >= ${query.guests}
        ${availabilityClause}
      group by room.id, primary_photo.url
      order by room.nightly_price asc, room.name asc
    `);

    sendData(res, {
      rooms: result.rows.map((room) => ({
        ...room,
        booked: Boolean(room.booked),
        amenities: Array.isArray(room.amenities) ? room.amenities : [],
      })),
    });
  }),
);

roomsRouter.get(
  "/:roomId",
  asyncHandler(async (req, res) => {
    const params = roomParamsSchema.parse(req.params);

    const result = await db.execute<RoomDetailRow>(sql`
      select
        room.id,
        room.name,
        room.type,
        room.description,
        room.max_guests as "maxGuests",
        room.nightly_price as "nightlyPrice",
        coalesce(
          json_agg(
            distinct jsonb_build_object(
              'id', photo.id,
              'url', photo.url,
              'altText', photo.alt_text,
              'isPrimary', photo.is_primary,
              'sortOrder', photo.sort_order
            )
          ) filter (where photo.id is not null),
          '[]'::json
        ) as photos,
        coalesce(
          json_agg(
            distinct jsonb_build_object('id', amenity.id, 'name', amenity.name)
          ) filter (where amenity.id is not null),
          '[]'::json
        ) as amenities
      from rooms room
      left join room_photos photo
        on photo.room_id = room.id
      left join room_amenities room_amenity
        on room_amenity.room_id = room.id
      left join amenities amenity
        on amenity.id = room_amenity.amenity_id
      where room.id = ${params.roomId}::uuid
        and room.active = true
      group by room.id
      limit 1
    `);

    const room = result.rows[0];
    if (!room) {
      throw new ApiError(404, "NOT_FOUND", "Room was not found.");
    }

    sendData(res, {
      ...room,
      photos: Array.isArray(room.photos) ? room.photos.sort((a, b) => a.sortOrder - b.sortOrder) : [],
      amenities: Array.isArray(room.amenities) ? room.amenities : [],
    });
  }),
);

roomsRouter.get(
  "/:roomId/availability",
  asyncHandler(async (req, res) => {
    const params = roomParamsSchema.parse(req.params);
    const query = availabilityQuerySchema.parse(req.query);
    const nights = differenceInNights(query.checkInDate, query.checkOutDate);

    const result = await db.execute<AvailabilityRow>(sql`
      select
        room.id,
        room.active,
        room.max_guests as "maxGuests",
        room.nightly_price as "nightlyPrice",
        ${overlappingReservationExistsSql(
          sql`room.id`,
          query.checkInDate,
          query.checkOutDate,
        )} as "hasOverlappingReservation"
      from rooms room
      where room.id = ${params.roomId}::uuid
      limit 1
    `);

    const room = result.rows[0];
    if (!room) {
      throw new ApiError(404, "NOT_FOUND", "Room was not found.");
    }

    const available =
      room.active &&
      room.maxGuests >= query.guests &&
      !room.hasOverlappingReservation;

    sendData(res, {
      roomId: room.id,
      available,
      nights,
      estimatedTotalPrice: (room.nightlyPrice * nights).toFixed(2),
      reasons: {
        inactive: !room.active,
        insufficientCapacity: room.maxGuests < query.guests,
        overlappingReservation: room.hasOverlappingReservation,
      },
    });
  }),
);
