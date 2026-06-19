import { neonSql } from "@StayBook/db";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { type ReservationDerivedState } from "../api/dates";
import { ApiError, getDatabaseErrorConstraint, getDatabaseErrorCode } from "../api/http";

const roomValidationSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  maxGuests: z.number(),
  nightlyPrice: z.number(),
});

const reservationSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  guestId: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  totalPrice: z.number(),
  status: z.enum(["confirmed", "cancelled"]),
  cancelledAt: z.string().nullable(),
  cancelledByUserId: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ReservationRow = z.infer<typeof reservationSchema>;

export type CreateBookingInput = {
  roomId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
};

export const ROOM_OVERLAP_CONSTRAINT_NAME =
  "reservations_no_overlapping_confirmed_room_dates_excl";
export const GUEST_OVERLAP_CONSTRAINT_NAME =
  "reservations_no_overlapping_confirmed_guest_dates_excl";

const GUEST_OVERLAP_ERROR_MESSAGE =
  "You already have a confirmed reservation that overlaps these dates.";

export async function createBooking(
  input: CreateBookingInput,
): Promise<ReservationRow> {
  const { roomId, guestId, checkInDate, checkOutDate, guestCount } = input;

  const existingGuestOverlap = await neonSql`
    select 1
    from reservations
    where guest_id = ${guestId}
      and status = 'confirmed'
      and daterange(check_in_date, check_out_date, '[)')
        && daterange(${checkInDate}::date, ${checkOutDate}::date, '[)')
    limit 1
  `;
  if (existingGuestOverlap.length > 0) {
    throw new ApiError(409, "CONFLICT", GUEST_OVERLAP_ERROR_MESSAGE);
  }

  try {
    const results = await neonSql.transaction((txnSql) => [
      txnSql`select
               id,
               active,
               max_guests as "maxGuests",
               nightly_price as "nightlyPrice"
             from rooms
             where id = ${roomId}::uuid
             limit 1`,
      txnSql`insert into reservations (
               room_id,
               guest_id,
               check_in_date,
               check_out_date,
               total_price,
               status
             )
             select
               room.id,
               ${guestId},
               ${checkInDate}::date,
               ${checkOutDate}::date,
               room.nightly_price * (${checkOutDate}::date - ${checkInDate}::date),
               'confirmed'::reservation_status
             from rooms room
             where room.id = ${roomId}::uuid
               and room.active = true
               and room.max_guests >= ${guestCount}
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
               updated_at::text as "updatedAt"`,
    ]);

    const roomRows = roomValidationSchema.array().parse(results[0]);
    const insertRows = reservationSchema.array().parse(results[1]);

    const reservation = insertRows[0];
    if (reservation) {
      return reservation;
    }

    const room = roomRows[0];
    if (!room) {
      throw new ApiError(404, "NOT_FOUND", "Room was not found.");
    }

    if (!room.active) {
      throw new ApiError(409, "CONFLICT", "Room is not active.");
    }

    throw new ApiError(
      400,
      "BAD_REQUEST",
      "Room cannot accommodate the requested guest count.",
    );
  } catch (error) {
    if (getDatabaseErrorCode(error) === "23P01") {
      if (getDatabaseErrorConstraint(error) === GUEST_OVERLAP_CONSTRAINT_NAME) {
        throw new ApiError(409, "CONFLICT", GUEST_OVERLAP_ERROR_MESSAGE);
      }

      throw new ApiError(
        409,
        "CONFLICT",
        "Room is no longer available for those dates.",
      );
    }

    throw error;
  }
}

export function overlappingReservationExistsSql(
  roomIdExpression: SQL,
  checkInDate: string,
  checkOutDate: string,
): SQL {
  return sql`exists (
    select 1
    from reservations reservation
    where reservation.room_id = ${roomIdExpression}
      and reservation.status = 'confirmed'
      and daterange(reservation.check_in_date, reservation.check_out_date, '[)')
        && daterange(${checkInDate}::date, ${checkOutDate}::date, '[)')
  )`;
}

export const reservationStateConditions: Record<
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
