import { db } from "@StayBook/db";
import { sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { requireSession, requireStaff } from "../auth";
import {
  ApiError,
  asyncHandler,
  getDatabaseErrorCode,
  sendData,
} from "../http";
import { staffReservationsRouter } from "./staff.reservations";

type AmenitySummary = {
  id: string;
  name: string;
};

type PhotoSummary = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

type StaffRoomListRow = {
  id: string;
  name: string;
  type: string;
  description: string;
  maxGuests: number;
  nightlyPrice: number;
  active: boolean;
  primaryPhotoUrl: string | null;
  photos: PhotoSummary[];
  amenities: AmenitySummary[];
};

type RoomIdRow = {
  id: string;
};

const roomParamsSchema = z.object({
  roomId: z.string().uuid(),
});

const roomPhotoInputSchema = z.object({
  url: z.string().trim().url().max(2048),
  altText: z.string().trim().max(180).optional(),
  isPrimary: z.boolean().optional(),
});

const roomBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(2000),
    maxGuests: z.number().int().min(1).max(20),
    nightlyPrice: z.number().int().positive().max(9_999_999),
    amenityIds: z.array(z.string().uuid()).max(50).default([]),
    photos: z.array(roomPhotoInputSchema).max(12).default([]),
  })
  .strict()
  .transform((room) => ({
    ...room,
    amenityIds: [...new Set(room.amenityIds)],
    photos: room.photos.map((photo, index) => ({
      ...photo,
      altText: photo.altText?.trim() || null,
      sortOrder: index,
    })),
  }));

const listStaffRoomsQuerySchema = z
  .object({
    status: z.enum(["active", "inactive"]).optional(),
    type: z.string().trim().min(1).optional(),
    amenityId: z.string().uuid().optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

type ListStaffRoomsQuery = z.infer<typeof listStaffRoomsQuerySchema>;

export const staffRouter = Router();

staffRouter.use(requireSession, requireStaff);
staffRouter.use("/reservations", staffReservationsRouter);

function normalizeStaffRoom(room: StaffRoomListRow) {
  const photos = Array.isArray(room.photos)
    ? room.photos.sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  return {
    ...room,
    photos,
    amenities: Array.isArray(room.amenities) ? room.amenities : [],
  };
}

function buildStaffRoomFilters(query: ListStaffRoomsQuery): SQL {
  const conditions: SQL[] = [];

  if (query.status) {
    conditions.push(sql`room.active = ${query.status === "active"}`);
  }

  if (query.type) {
    conditions.push(sql`room.type = ${query.type}`);
  }

  if (query.amenityId) {
    conditions.push(sql`exists (
      select 1
      from room_amenities ra
      join amenities a on a.id = ra.amenity_id
      where ra.room_id = room.id
        and a.id = ${query.amenityId}::uuid
    )`);
  }

  if (query.search) {
    const escaped = query.search
      .replace(/!/g, "!!")
      .replace(/%/g, "!%")
      .replace(/_/g, "!_");
    const pattern = `%${escaped}%`;
    conditions.push(
      sql`(room.name ilike ${pattern} escape '!' or room.type ilike ${pattern} escape '!')`,
    );
  }

  return conditions.length
    ? sql`where ${sql.join(conditions, sql` and `)}`
    : sql``;
}

async function getStaffRooms(whereClause = sql``) {
  const result = await db.execute<StaffRoomListRow>(sql`
      select
        room.id,
        room.name,
        room.type,
        room.description,
        room.max_guests as "maxGuests",
        room.nightly_price as "nightlyPrice",
        room.active,
        primary_photo.url as "primaryPhotoUrl",
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
      left join room_photos primary_photo
        on primary_photo.room_id = room.id
        and primary_photo.is_primary = true
      left join room_photos photo
        on photo.room_id = room.id
      left join room_amenities room_amenity
        on room_amenity.room_id = room.id
      left join amenities amenity
        on amenity.id = room_amenity.amenity_id
      ${whereClause}
      group by room.id, primary_photo.url
      order by room.active desc, room.name asc
    `);

  return result.rows.map(normalizeStaffRoom);
}

async function getStaffRoom(roomId: string) {
  const rooms = await getStaffRooms(sql`where room.id = ${roomId}::uuid`);
  return rooms[0] ?? null;
}

function sqlTupleList(items: ReturnType<typeof sql>[]) {
  return sql.join(items, sql`, `);
}

async function ensureAmenitiesExist(amenityIds: string[]) {
  if (amenityIds.length === 0) {
    return;
  }

  const result = await db.execute<{ id: string }>(sql`
    select id
    from amenities
    where id in (${sql.join(amenityIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `);

  if (result.rows.length !== amenityIds.length) {
    throw new ApiError(400, "BAD_REQUEST", "One or more amenities were not found.");
  }
}

async function replaceRoomAmenities(roomId: string, amenityIds: string[]) {
  await db.execute(sql`
    delete from room_amenities
    where room_id = ${roomId}::uuid
  `);

  if (amenityIds.length === 0) {
    return;
  }

  await db.execute(sql`
    insert into room_amenities (room_id, amenity_id)
    values ${sqlTupleList(
      amenityIds.map((amenityId) => sql`(${roomId}::uuid, ${amenityId}::uuid)`),
    )}
  `);
}

async function replaceRoomPhotos(
  roomId: string,
  photos: Array<{
    url: string;
    altText: string | null;
    isPrimary?: boolean;
    sortOrder: number;
  }>,
) {
  await db.execute(sql`
    delete from room_photos
    where room_id = ${roomId}::uuid
  `);

  if (photos.length === 0) {
    return;
  }

  const requestedPrimaryIndex = photos.findIndex((photo) => photo.isPrimary);
  const primaryIndex = requestedPrimaryIndex >= 0 ? requestedPrimaryIndex : 0;

  await db.execute(sql`
    insert into room_photos (room_id, url, alt_text, sort_order, is_primary)
    values ${sqlTupleList(
      photos.map(
        (photo, index) =>
          sql`(${roomId}::uuid, ${photo.url}, ${photo.altText}, ${photo.sortOrder}, ${
            index === primaryIndex
          })`,
      ),
    )}
  `);
}

async function updateRoomRelations(
  roomId: string,
  amenityIds: string[],
  photos: Array<{
    url: string;
    altText: string | null;
    isPrimary?: boolean;
    sortOrder: number;
  }>,
) {
  await ensureAmenitiesExist(amenityIds);
  await replaceRoomAmenities(roomId, amenityIds);
  await replaceRoomPhotos(roomId, photos);
}

staffRouter.get(
  "/amenities",
  asyncHandler(async (_req, res) => {
    const result = await db.execute<AmenitySummary>(sql`
      select id, name
      from amenities
      order by name asc
    `);

    sendData(res, { amenities: result.rows });
  }),
);

staffRouter.get(
  "/rooms",
  asyncHandler(async (req, res) => {
    const query = listStaffRoomsQuerySchema.parse(req.query);
    const whereClause = buildStaffRoomFilters(query);
    const rooms = await getStaffRooms(whereClause);

    sendData(res, {
      rooms,
    });
  }),
);

staffRouter.post(
  "/rooms",
  asyncHandler(async (req, res) => {
    const body = roomBodySchema.parse(req.body);

    await ensureAmenitiesExist(body.amenityIds);

    let result;
    try {
      result = await db.execute<RoomIdRow>(sql`
        insert into rooms (name, type, description, max_guests, nightly_price, active)
        values (
          ${body.name},
          ${body.type},
          ${body.description},
          ${body.maxGuests},
          ${body.nightlyPrice},
          true
        )
        returning id
      `);
    } catch (error) {
      if (getDatabaseErrorCode(error) === "23505") {
        throw new ApiError(409, "CONFLICT", "A room with that name already exists.");
      }

      throw error;
    }

    const roomId = result.rows[0]?.id;
    if (!roomId) {
      throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Room could not be created.");
    }

    await updateRoomRelations(roomId, body.amenityIds, body.photos);

    const room = await getStaffRoom(roomId);
    sendData(res, { room }, 201);
  }),
);

staffRouter.patch(
  "/rooms/:roomId",
  asyncHandler(async (req, res) => {
    const params = roomParamsSchema.parse(req.params);
    const body = roomBodySchema.parse(req.body);

    let result;
    try {
      result = await db.execute<RoomIdRow>(sql`
        update rooms
        set
          name = ${body.name},
          type = ${body.type},
          description = ${body.description},
          max_guests = ${body.maxGuests},
          nightly_price = ${body.nightlyPrice},
          updated_at = now()
        where id = ${params.roomId}::uuid
        returning id
      `);
    } catch (error) {
      if (getDatabaseErrorCode(error) === "23505") {
        throw new ApiError(409, "CONFLICT", "A room with that name already exists.");
      }

      throw error;
    }

    if (!result.rows[0]) {
      throw new ApiError(404, "NOT_FOUND", "Room was not found.");
    }

    await updateRoomRelations(params.roomId, body.amenityIds, body.photos);

    const room = await getStaffRoom(params.roomId);
    sendData(res, { room });
  }),
);

staffRouter.post(
  "/rooms/:roomId/deactivate",
  asyncHandler(async (req, res) => {
    const params = roomParamsSchema.parse(req.params);

    const result = await db.execute<RoomIdRow>(sql`
      update rooms
      set active = false, updated_at = now()
      where id = ${params.roomId}::uuid
      returning id
    `);

    if (!result.rows[0]) {
      throw new ApiError(404, "NOT_FOUND", "Room was not found.");
    }

    const room = await getStaffRoom(params.roomId);
    sendData(res, { room });
  }),
);

staffRouter.post(
  "/rooms/:roomId/reactivate",
  asyncHandler(async (req, res) => {
    const params = roomParamsSchema.parse(req.params);

    const result = await db.execute<RoomIdRow>(sql`
      update rooms
      set active = true, updated_at = now()
      where id = ${params.roomId}::uuid
      returning id
    `);

    if (!result.rows[0]) {
      throw new ApiError(404, "NOT_FOUND", "Room was not found.");
    }

    const room = await getStaffRoom(params.roomId);
    sendData(res, { room });
  }),
);
