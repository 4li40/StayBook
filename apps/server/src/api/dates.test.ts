import { describe, expect, it } from "vitest";

import {
  calendarDateSchema,
  classifyReservationState,
  differenceInNights,
  isMoreThan24HoursBeforeCheckIn,
  isValidCalendarDate,
  stayDateRangeSchema,
  todayUtcDate,
} from "./dates";

describe("isValidCalendarDate", () => {
  it("returns true for valid dates", () => {
    expect(isValidCalendarDate("2024-01-15")).toBe(true);
    expect(isValidCalendarDate("2024-12-31")).toBe(true);
    expect(isValidCalendarDate("2000-02-29")).toBe(true);
  });

  it("returns false for invalid dates", () => {
    expect(isValidCalendarDate("2024-13-01")).toBe(false);
    expect(isValidCalendarDate("2024-02-30")).toBe(false);
    expect(isValidCalendarDate("2023-02-29")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
    expect(isValidCalendarDate("2024/01/15")).toBe(false);
  });
});

describe("differenceInNights", () => {
  it("calculates nights between two dates", () => {
    expect(differenceInNights("2024-01-01", "2024-01-02")).toBe(1);
    expect(differenceInNights("2024-01-01", "2024-01-08")).toBe(7);
    expect(differenceInNights("2024-01-01", "2024-02-01")).toBe(31);
  });

  it("returns 0 for same date", () => {
    expect(differenceInNights("2024-01-01", "2024-01-01")).toBe(0);
  });
});

describe("isMoreThan24HoursBeforeCheckIn", () => {
  it("returns true when check-in is more than 24 hours away", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const dateStr = futureDate.toISOString().split("T")[0]!;
    expect(isMoreThan24HoursBeforeCheckIn(dateStr)).toBe(true);
  });

  it("returns false when check-in is within 24 hours", () => {
    const today = new Date().toISOString().split("T")[0]!;
    expect(isMoreThan24HoursBeforeCheckIn(today)).toBe(false);
  });
});

describe("calendarDateSchema", () => {
  it("accepts valid dates", () => {
    expect(calendarDateSchema.safeParse("2024-01-15").success).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(calendarDateSchema.safeParse("01/15/2024").success).toBe(false);
    expect(calendarDateSchema.safeParse("2024-1-15").success).toBe(false);
  });

  it("rejects invalid calendar dates", () => {
    expect(calendarDateSchema.safeParse("2024-02-30").success).toBe(false);
  });
});

describe("stayDateRangeSchema", () => {
  it("accepts valid date range", () => {
    const result = stayDateRangeSchema.safeParse({
      checkInDate: "2024-01-01",
      checkOutDate: "2024-01-02",
    });
    expect(result.success).toBe(true);
  });

  it("rejects check-out before check-in", () => {
    const result = stayDateRangeSchema.safeParse({
      checkInDate: "2024-01-02",
      checkOutDate: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects same day check-in and check-out", () => {
    const result = stayDateRangeSchema.safeParse({
      checkInDate: "2024-01-01",
      checkOutDate: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("todayUtcDate", () => {
  it("returns a real YYYY-MM-DD calendar date", () => {
    const today = todayUtcDate();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);
    expect(isValidCalendarDate(today)).toBe(true);
  });
});

describe("classifyReservationState", () => {
  it("returns cancelled for cancelled status regardless of dates", () => {
    expect(
      classifyReservationState("cancelled", "2024-01-01", "2024-01-05", "2024-01-03"),
    ).toBe("cancelled");
  });

  it("returns upcoming when check-in is after today", () => {
    expect(
      classifyReservationState("confirmed", "2024-02-01", "2024-02-05", "2024-01-15"),
    ).toBe("upcoming");
  });

  it("returns active when today is within the stay range", () => {
    expect(
      classifyReservationState("confirmed", "2024-01-01", "2024-01-05", "2024-01-03"),
    ).toBe("active");
  });

  it("returns active when today is the check-in date", () => {
    expect(
      classifyReservationState("confirmed", "2024-01-01", "2024-01-05", "2024-01-01"),
    ).toBe("active");
  });

  it("returns past when check-out is on today (half-open range)", () => {
    expect(
      classifyReservationState("confirmed", "2024-01-01", "2024-01-05", "2024-01-05"),
    ).toBe("past");
  });

  it("returns past when check-out is before today", () => {
    expect(
      classifyReservationState("confirmed", "2024-01-01", "2024-01-05", "2024-01-06"),
    ).toBe("past");
  });
});
