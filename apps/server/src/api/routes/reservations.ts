import { db } from "@StayBook/db";
import { sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import {
  getAuthenticatedUser,
  requireGuest,
  requireSession,
} from "../auth";
import {
  classifyReservationState,
  isMoreThan24HoursBeforeCheckIn,
  stayDateRangeSchema,
  todayUtcDate,
} from "../dates";
import {
  ApiError,
  asyncHandler,
  sendData,
} from "../http";
import {
  createBooking,
  reservationStateConditions,
  type ReservationRow,
} from "../../services/booking";

type ReservationStatus = "confirmed" | "cancelled";

type ReservationListRow = ReservationRow & {
  roomName: string;
  roomType: string;
  roomMaxGuests: number;
  roomNightlyPrice: number;
  roomPrimaryPhotoUrl: string | null;
};

type CountRow = {
  total: string;
};

type ReservationLookupRow = {
  id: string;
  checkInDate: string;
  status: ReservationStatus;
};

const createReservationBodySchema = stayDateRangeSchema.extend({
  roomId: z.string().uuid(),
  guestCount: z.number().int().min(1).max(20),
});

const listReservationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    state: z.enum(["upcoming", "active", "past", "cancelled"]).optional(),
  })
  .strict();

const reservationParamsSchema = z.object({
  reservationId: z.string().uuid(),
});

const cancelReservationBodySchema = z.object({
  cancellationReason: z.string().trim().min(1).max(500).optional(),
});

export const reservationsRouter = Router();

reservationsRouter.use(requireSession, requireGuest);

async function fetchGuestReservationWithRoom(
  reservationId: string,
  guestId: string,
) {
  const today = todayUtcDate();
  const result = await db.execute<ReservationListRow>(sql`
    select
      reservation.id,
      reservation.room_id as "roomId",
      reservation.guest_id as "guestId",
      reservation.check_in_date::text as "checkInDate",
      reservation.check_out_date::text as "checkOutDate",
      reservation.total_price as "totalPrice",
      reservation.status,
      reservation.cancelled_at::text as "cancelledAt",
      reservation.cancelled_by_user_id as "cancelledByUserId",
      reservation.cancellation_reason as "cancellationReason",
      reservation.created_at::text as "createdAt",
      reservation.updated_at::text as "updatedAt",
      room.name as "roomName",
      room.type as "roomType",
      room.max_guests as "roomMaxGuests",
      room.nightly_price as "roomNightlyPrice",
      primary_photo.url as "roomPrimaryPhotoUrl"
    from reservations reservation
    inner join rooms room
      on room.id = reservation.room_id
    left join room_photos primary_photo
      on primary_photo.room_id = room.id
      and primary_photo.is_primary = true
    where reservation.id = ${reservationId}::uuid
      and reservation.guest_id = ${guestId}
    limit 1
  `);

  const row = result.rows[0];
  if (!row) return null;

  return mapReservationListRow(row, today);
}

function mapReservationListRow(row: ReservationListRow, today: string) {
  return {
    id: row.id,
    roomId: row.roomId,
    guestId: row.guestId,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    totalPrice: row.totalPrice,
    status: row.status,
    state: classifyReservationState(
      row.status,
      row.checkInDate,
      row.checkOutDate,
      today,
    ),
    cancelledAt: row.cancelledAt,
    cancelledByUserId: row.cancelledByUserId,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    room: {
      id: row.roomId,
      name: row.roomName,
      type: row.roomType,
      maxGuests: row.roomMaxGuests,
      nightlyPrice: row.roomNightlyPrice,
      primaryPhotoUrl: row.roomPrimaryPhotoUrl,
    },
  };
}

reservationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const body = createReservationBodySchema.parse(req.body);

    const created = await createBooking({
      roomId: body.roomId,
      guestId: user.id,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      guestCount: body.guestCount,
    });

    const reservation = await fetchGuestReservationWithRoom(
      created.id,
      user.id,
    );
    if (!reservation) {
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Reservation was not found.",
      );
    }

    sendData(res, { reservation }, 201);
  }),
);

reservationsRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const query = listReservationsQuerySchema.parse(req.query);
    const today = todayUtcDate();
    const offset = (query.page - 1) * query.pageSize;

    const conditions: SQL[] = [sql`reservation.guest_id = ${user.id}`];

    if (query.state) {
      conditions.push(reservationStateConditions[query.state](today));
    }

    const whereClause = sql`where ${sql.join(conditions, sql` and `)}`;

    const countResult = await db.execute<CountRow>(sql`
      select count(*)::text as total
      from reservations reservation
      ${whereClause}
    `);

    const result = await db.execute<ReservationListRow>(sql`
      select
        reservation.id,
        reservation.room_id as "roomId",
        reservation.guest_id as "guestId",
        reservation.check_in_date::text as "checkInDate",
        reservation.check_out_date::text as "checkOutDate",
        reservation.total_price as "totalPrice",
        reservation.status,
        reservation.cancelled_at::text as "cancelledAt",
        reservation.cancelled_by_user_id as "cancelledByUserId",
        reservation.cancellation_reason as "cancellationReason",
        reservation.created_at::text as "createdAt",
        reservation.updated_at::text as "updatedAt",
        room.name as "roomName",
        room.type as "roomType",
        room.max_guests as "roomMaxGuests",
        room.nightly_price as "roomNightlyPrice",
        primary_photo.url as "roomPrimaryPhotoUrl"
      from reservations reservation
      inner join rooms room
        on room.id = reservation.room_id
      left join room_photos primary_photo
        on primary_photo.room_id = room.id
        and primary_photo.is_primary = true
      ${whereClause}
      order by reservation.check_in_date desc, reservation.created_at desc
      limit ${query.pageSize}
      offset ${offset}
    `);

    const total = Number(countResult.rows[0]?.total ?? 0);
    const reservations = result.rows.map((row) =>
      mapReservationListRow(row, today),
    );

    sendData(res, {
      reservations,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    });
  }),
);

reservationsRouter.get(
  "/me/:reservationId",
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const params = reservationParamsSchema.parse(req.params);

    const reservation = await fetchGuestReservationWithRoom(
      params.reservationId,
      user.id,
    );
    if (!reservation) {
      throw new ApiError(404, "NOT_FOUND", "Reservation was not found.");
    }

    sendData(res, { reservation });
  }),
);

reservationsRouter.post(
  "/:reservationId/cancel",
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const params = reservationParamsSchema.parse(req.params);
    const body = cancelReservationBodySchema.parse(req.body);

    const lookupResult = await db.execute<ReservationLookupRow>(sql`
      select
        id,
        check_in_date::text as "checkInDate",
        status
      from reservations
      where id = ${params.reservationId}::uuid
        and guest_id = ${user.id}
      limit 1
    `);

    const reservation = lookupResult.rows[0];
    if (!reservation) {
      throw new ApiError(404, "NOT_FOUND", "Reservation was not found.");
    }

    if (reservation.status === "cancelled") {
      throw new ApiError(409, "CONFLICT", "Reservation is already cancelled.");
    }

    if (!isMoreThan24HoursBeforeCheckIn(reservation.checkInDate)) {
      throw new ApiError(
        409,
        "CONFLICT",
        "Reservation cannot be cancelled within 24 hours of check-in.",
      );
    }

    const updateResult = await db.execute<ReservationRow>(sql`
      update reservations
      set
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by_user_id = ${user.id},
        cancellation_reason = ${body.cancellationReason ?? null},
        updated_at = now()
      where id = ${params.reservationId}::uuid
        and guest_id = ${user.id}
        and status = 'confirmed'
      returning
        id,
        room_id as "roomId",
        guest_id as "guestId",
        check_in_date::text as "checkInDate",
        check_out_date::text as "checkOutDate",
        total_price as "totalPrice",
        status,
        cancelled_at::text as "cancelledAt",
        cancelled_by_user_id as "cancelledByUserId",
        cancellation_reason as "cancellationReason",
        created_at::text as "createdAt",
        updated_at::text as "updatedAt"
    `);

    const cancelledReservation = updateResult.rows[0];
    if (!cancelledReservation) {
      throw new ApiError(409, "CONFLICT", "Reservation could not be cancelled.");
    }

    sendData(res, { reservation: cancelledReservation });
  }),
);
