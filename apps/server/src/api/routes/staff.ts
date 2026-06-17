import { db } from "@StayBook/db";
import { sql } from "drizzle-orm";
import { Router } from "express";

import { requireSession, requireStaff } from "../auth";
import { asyncHandler, sendData } from "../http";

type AmenitySummary = {
  id: string;
  name: string;
};

type StaffRoomListRow = {
  id: string;
  name: string;
  type: string;
  description: string;
  maxGuests: number;
  nightlyPrice: string;
  active: boolean;
  primaryPhotoUrl: string | null;
  amenities: AmenitySummary[];
};

export const staffRouter = Router();

staffRouter.use(requireSession, requireStaff);

staffRouter.get(
  "/rooms",
  asyncHandler(async (_req, res) => {
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
            distinct jsonb_build_object('id', amenity.id, 'name', amenity.name)
          ) filter (where amenity.id is not null),
          '[]'::json
        ) as amenities
      from rooms room
      left join room_photos primary_photo
        on primary_photo.room_id = room.id
        and primary_photo.is_primary = true
      left join room_amenities room_amenity
        on room_amenity.room_id = room.id
      left join amenities amenity
        on amenity.id = room_amenity.amenity_id
      group by room.id, primary_photo.url
      order by room.active desc, room.name asc
    `);

    sendData(res, {
      rooms: result.rows.map((room) => ({
        ...room,
        amenities: Array.isArray(room.amenities) ? room.amenities : [],
      })),
    });
  }),
);
