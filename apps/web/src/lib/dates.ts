import {
  calendarDateSchema,
  isMoreThan24HoursBeforeCheckIn,
  isValidCalendarDate,
} from "@StayBook/dates";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function getNightCount(checkInDate: string, checkOutDate: string) {
  const checkIn = new Date(`${checkInDate}T00:00:00`).getTime();
  const checkOut = new Date(`${checkOutDate}T00:00:00`).getTime();
  const nights = (checkOut - checkIn) / millisecondsPerDay;
  return Number.isFinite(nights) && nights > 0 ? nights : 0;
}

export function getDefaultRoomsSearch(now: Date = new Date()): {
  checkInDate: string;
  checkOutDate: string;
  guests: string;
} {
  const nextDay = new Date(now);
  nextDay.setDate(now.getDate() + 1);
  const thirdDay = new Date(now);
  thirdDay.setDate(now.getDate() + 3);

  return {
    checkInDate: toDateInputValue(nextDay),
    checkOutDate: toDateInputValue(thirdDay),
    guests: "2",
  };
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export { calendarDateSchema, isMoreThan24HoursBeforeCheckIn, isValidCalendarDate };

