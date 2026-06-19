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

function parseCommaSeparatedUUIDs(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCommaSeparatedStrings(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const roomsQuerySchema = z
  .object({
    checkInDate: z.string().optional(),
    checkOutDate: z.string().optional(),
    guests: z.coerce.number().int().min(1).max(20).default(1),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(9),
    priceMin: z.coerce.number().int().min(0).optional(),
    priceMax: z.coerce.number().int().min(0).optional(),
    types: z.string().optional(),
    amenityIds: z.string().optional(),
    onlyAvailable: z.coerce.boolean().default(false),
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

const bookedDatesQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM format.")
      .refine((value) => {
        const month = Number(value.slice(5, 7));
        return month >= 1 && month <= 12;
      }, "Month must be between 01 and 12."),
  })
  .strict();

type BookedDateRow = {
  checkInDate: string;
  checkOutDate: string;
};

export const roomsRouter = Router();

type RoomFilterOptionsRow = {
  types: string[];
  amenities: { id: string; name: string }[];
  minPrice: number;
  maxPrice: number;
};

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

    const selectedTypes = parseCommaSeparatedStrings(query.types);
    const selectedAmenityIds = parseCommaSeparatedUUIDs(query.amenityIds);
    const offset = (query.page - 1) * query.pageSize;

    const typeCondition =
      selectedTypes.length > 0
        ? sql`and room.type in (${sql.join(selectedTypes.map((type) => sql`${type}`), sql`, `)})`
        : sql``;

    const priceMinCondition =
      query.priceMin != null
        ? sql`and room.nightly_price >= ${query.priceMin}`
        : sql``;

    const priceMaxCondition =
      query.priceMax != null
        ? sql`and room.nightly_price <= ${query.priceMax}`
        : sql``;

    const amenityCondition =
      selectedAmenityIds.length > 0
        ? sql`and (
          select count(distinct amenity.id)
          from room_amenities room_amenity
          join amenities amenity on amenity.id = room_amenity.amenity_id
          where room_amenity.room_id = room.id
            and amenity.id in (${sql.join(selectedAmenityIds.map((id) => sql`${id}::uuid`), sql`, `)})
        ) = ${selectedAmenityIds.length}`
        : sql``;

    const availabilityCondition = query.onlyAvailable
      ? sql`and not ${bookedColumn}`
      : sql``;

    const countResult = await db.execute<{ total: string }>(sql`
      select count(*)::text as total
      from rooms room
      where room.active = true
        and room.max_guests >= ${query.guests}
        ${typeCondition}
        ${priceMinCondition}
        ${priceMaxCondition}
        ${amenityCondition}
        ${availabilityCondition}
    `);

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
        ${typeCondition}
        ${priceMinCondition}
        ${priceMaxCondition}
        ${amenityCondition}
        ${availabilityCondition}
      group by room.id, primary_photo.url
      order by ${bookedColumn} asc, room.nightly_price asc, room.name asc
      limit ${query.pageSize}
      offset ${offset}
    `);

    const optionsResult = await db.execute<RoomFilterOptionsRow>(sql`
      select
        coalesce(min(room.nightly_price), 0) as "minPrice",
        coalesce(max(room.nightly_price), 0) as "maxPrice",
        coalesce(
          json_agg(distinct room.type) filter (where room.type is not null),
          '[]'::json
        ) as types,
        coalesce(
          json_agg(
            distinct jsonb_build_object('id', amenity.id, 'name', amenity.name)
          ) filter (where amenity.id is not null),
          '[]'::json
        ) as amenities
      from rooms room
      left join room_amenities room_amenity
        on room_amenity.room_id = room.id
      left join amenities amenity
        on amenity.id = room_amenity.amenity_id
      where room.active = true
        and room.max_guests >= ${query.guests}
    `);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const optionsRow = optionsResult.rows[0];
    const rooms = result.rows.map((room) => ({
      ...room,
      booked: Boolean(room.booked),
      amenities: Array.isArray(room.amenities) ? room.amenities : [],
    }));

    sendData(res, {
      rooms,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
      options: {
        types: Array.isArray(optionsRow?.types) ? optionsRow.types : [],
        amenities: Array.isArray(optionsRow?.amenities)
          ? optionsRow.amenities
          : [],
        priceBounds: {
          min: optionsRow?.minPrice ?? 0,
          max: optionsRow?.maxPrice ?? 0,
        },
      },
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

roomsRouter.get(
  "/:roomId/booked-dates",
  asyncHandler(async (req, res) => {
    const params = roomParamsSchema.parse(req.params);
    const query = bookedDatesQuerySchema.parse(req.query);

    const [yearStr, monthStr] = query.month.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const room = await db.execute<{ id: string }>(sql`
      select id from rooms where id = ${params.roomId}::uuid and active = true limit 1
    `);
    if (room.rows.length === 0) {
      throw new ApiError(404, "NOT_FOUND", "Room was not found.");
    }

    const result = await db.execute<BookedDateRow>(sql`
      select
        check_in_date::text as "checkInDate",
        check_out_date::text as "checkOutDate"
      from reservations
      where room_id = ${params.roomId}::uuid
        and status = 'confirmed'
        and daterange(check_in_date, check_out_date, '[)')
          && daterange(${monthStart}::date, (${monthEnd}::date + 1)::date, '[)')
      order by check_in_date asc
    `);

    sendData(res, {
      bookedDates: result.rows,
    });
  }),
);
