import { db } from "@StayBook/db";
import { sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { getAuthenticatedUser } from "../auth";
import {
  calendarDateSchema,
  classifyReservationState,
  differenceInNights,
  todayUtcDate,
  type ReservationDerivedState,
} from "../dates";
import { ApiError, asyncHandler, sendData } from "../http";

type ReservationStatus = "confirmed" | "cancelled";

type ReservationRow = {
  id: string;
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: string;
  status: ReservationStatus;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type StaffReservationListRow = ReservationRow & {
  roomName: string;
  roomType: string;
  roomMaxGuests: number;
  roomNightlyPrice: string;
  roomPrimaryPhotoUrl: string | null;
  guestName: string | null;
  guestEmail: string | null;
};

type CountRow = {
  total: string;
};

type ReservationLookupRow = {
  id: string;
  status: ReservationStatus;
};

const reservationParamsSchema = z.object({
  reservationId: z.string().uuid(),
});

const cancelReservationBodySchema = z
  .object({
    cancellationReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

const listStaffReservationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    roomId: z.string().uuid().optional(),
    status: z.enum(["confirmed", "cancelled"]).optional(),
    state: z.enum(["upcoming", "active", "past", "cancelled"]).optional(),
    dateFrom: calendarDateSchema.optional(),
    dateTo: calendarDateSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo) {
      if (differenceInNights(value.dateFrom, value.dateTo) <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["dateTo"],
          message: "dateTo must be after dateFrom.",
        });
      }
    }

    if (value.dateFrom && !value.dateTo) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo is required when dateFrom is provided.",
      });
    }

    if (value.dateTo && !value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFrom"],
        message: "dateFrom is required when dateTo is provided.",
      });
    }

    if (value.status === "confirmed" && value.state === "cancelled") {
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: "state cannot be 'cancelled' when status is 'confirmed'.",
      });
    }

    if (
      value.status === "cancelled" &&
      value.state &&
      value.state !== "cancelled"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["state"],
        message: `state cannot be '${value.state}' when status is 'cancelled'.`,
      });
    }
  });

type ListStaffReservationsQuery = z.infer<
  typeof listStaffReservationsQuerySchema
>;

export const staffReservationsRouter = Router();

const reservationStateConditions: Record<
  ReservationDerivedState,
  (today: string) => SQL
> = {
  cancelled: () => sql`reservation.status = 'cancelled'`,
  upcoming: (today) =>
    sql`reservation.status = 'confirmed' and reservation.check_in_date > ${today}::date`,
  active: (today) =>
    sql`reservation.status = 'confirmed' and reservation.check_in_date <= ${today}::date and reservation.check_out_date > ${today}::date`,
  past: (today) =>
    sql`reservation.status = 'confirmed' and reservation.check_out_date <= ${today}::date`,
};

function buildStaffReservationFilters(
  query: ListStaffReservationsQuery,
  today: string,
): SQL {
  const conditions: SQL[] = [];

  if (query.roomId) {
    conditions.push(sql`reservation.room_id = ${query.roomId}::uuid`);
  }

  if (query.status) {
    conditions.push(
      sql`reservation.status = ${query.status}::reservation_status`,
    );
  }

  if (query.state) {
    conditions.push(reservationStateConditions[query.state](today));
  }

  if (query.dateFrom && query.dateTo) {
    conditions.push(
      sql`daterange(reservation.check_in_date, reservation.check_out_date, '[)') && daterange(${query.dateFrom}::date, ${query.dateTo}::date, '[)')`,
    );
  }

  return conditions.length
    ? sql`where ${sql.join(conditions, sql` and `)}`
    : sql``;
}

function normalizeStaffReservation(row: StaffReservationListRow, today: string) {
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
    guest: {
      id: row.guestId,
      name: row.guestName,
      email: row.guestEmail,
    },
  };
}

async function getStaffReservations(
  whereClause: SQL,
  limit: number,
  offset: number,
) {
  const result = await db.execute<StaffReservationListRow>(sql`
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
      primary_photo.url as "roomPrimaryPhotoUrl",
      guest.name as "guestName",
      guest.email as "guestEmail"
    from reservations reservation
    inner join rooms room
      on room.id = reservation.room_id
    left join room_photos primary_photo
      on primary_photo.room_id = room.id
      and primary_photo.is_primary = true
    left join "user" guest
      on guest.id = reservation.guest_id
    ${whereClause}
    order by reservation.check_in_date desc, reservation.created_at desc
    limit ${limit}
    offset ${offset}
  `);

  return result.rows;
}

async function getStaffReservation(reservationId: string, today: string) {
  const rows = await getStaffReservations(
    sql`where reservation.id = ${reservationId}::uuid`,
    1,
    0,
  );
  return rows[0] ? normalizeStaffReservation(rows[0], today) : null;
}

staffReservationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listStaffReservationsQuerySchema.parse(req.query);
    const today = todayUtcDate();
    const whereClause = buildStaffReservationFilters(query, today);
    const offset = (query.page - 1) * query.pageSize;

    const countResult = await db.execute<CountRow>(sql`
      select count(*)::text as total
      from reservations reservation
      ${whereClause}
    `);

    const rows = await getStaffReservations(whereClause, query.pageSize, offset);
    const reservations = rows.map((row) => normalizeStaffReservation(row, today));
    const total = Number(countResult.rows[0]?.total ?? 0);

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

staffReservationsRouter.post(
  "/:reservationId/cancel",
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const params = reservationParamsSchema.parse(req.params);
    const body = cancelReservationBodySchema.parse(req.body ?? {});
    const today = todayUtcDate();

    const lookupResult = await db.execute<ReservationLookupRow>(sql`
      select
        id,
        status
      from reservations
      where id = ${params.reservationId}::uuid
      limit 1
    `);

    const reservation = lookupResult.rows[0];
    if (!reservation) {
      throw new ApiError(404, "NOT_FOUND", "Reservation was not found.");
    }

    if (reservation.status === "cancelled") {
      throw new ApiError(409, "CONFLICT", "Reservation is already cancelled.");
    }

    const updateResult = await db.execute<{ id: string }>(sql`
      update reservations
      set
        status = 'cancelled',
        cancelled_at = now(),
        cancelled_by_user_id = ${user.id},
        cancellation_reason = ${body.cancellationReason ?? null},
        updated_at = now()
      where id = ${params.reservationId}::uuid
        and status = 'confirmed'
      returning id
    `);

    if (!updateResult.rows[0]) {
      throw new ApiError(409, "CONFLICT", "Reservation could not be cancelled.");
    }

    const cancelledReservation = await getStaffReservation(
      params.reservationId,
      today,
    );
    if (!cancelledReservation) {
      throw new ApiError(404, "NOT_FOUND", "Reservation was not found.");
    }

    sendData(res, { reservation: cancelledReservation });
  }),
);
