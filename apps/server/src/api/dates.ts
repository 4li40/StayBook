import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const calendarDateSchema = z
  .string()
  .regex(datePattern, "Use YYYY-MM-DD format.")
  .refine(isValidCalendarDate, "Use a real calendar date.");

export const stayDateRangeSchema = z
  .object({
    checkInDate: calendarDateSchema,
    checkOutDate: calendarDateSchema,
  })
  .refine(
    (value) => differenceInNights(value.checkInDate, value.checkOutDate) > 0,
    {
      message: "checkOutDate must be after checkInDate.",
      path: ["checkOutDate"],
    },
  );

export function isValidCalendarDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function differenceInNights(checkInDate: string, checkOutDate: string) {
  const checkIn = Date.parse(`${checkInDate}T00:00:00.000Z`);
  const checkOut = Date.parse(`${checkOutDate}T00:00:00.000Z`);
  return Math.round((checkOut - checkIn) / millisecondsPerDay);
}

export function isMoreThan24HoursBeforeCheckIn(checkInDate: string) {
  const checkIn = new Date(`${checkInDate}T00:00:00`);
  return checkIn.getTime() - Date.now() > millisecondsPerDay;
}
