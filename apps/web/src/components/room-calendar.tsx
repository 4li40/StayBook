import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { type BookedDateRange } from "@/lib/api";
import { roomBookedDatesQueryOptions } from "@/lib/queries";

type RoomCalendarProps = {
  roomId: string;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildBookedSet(ranges: BookedDateRange[]): Set<string> {
  const set = new Set<string>();
  for (const range of ranges) {
    const start = Date.parse(`${range.checkInDate}T00:00:00.000Z`);
    const end = Date.parse(`${range.checkOutDate}T00:00:00.000Z`);
    for (let t = start; t < end; t += 86_400_000) {
      const d = new Date(t);
      set.add(dateKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
  }
  return set;
}

export function RoomCalendar({ roomId }: RoomCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  });

  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth();
  const monthKey = toMonthKey(currentDate);
  const { data, isFetching } = useQuery(
    roomBookedDatesQueryOptions(roomId, monthKey),
  );
  const bookedDates = data?.bookedDates ?? [];
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);

  const todayKey = dateKey(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const todayUtcMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const bookedSet = useMemo(() => buildBookedSet(bookedDates), [bookedDates]);

  const goToPrevMonth = useCallback(() => {
    setCurrentDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  }, []);

  const cells: Array<{ key: string; day: number | null; isBooked: boolean; isPast: boolean; isToday: boolean }> = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ key: `empty-${i}`, day: null, isBooked: false, isPast: false, isToday: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dk = dateKey(year, month, day);
    const d = new Date(Date.UTC(year, month, day));
    const isPast = d.getTime() < todayUtcMs;
    cells.push({
      key: dk,
      day,
      isBooked: bookedSet.has(dk),
      isPast,
      isToday: dk === todayKey,
    });
  }

  const monthLabel = currentDate.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground font-sans">
          Availability
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevMonth}
            className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs font-semibold tabular-nums text-foreground min-w-[5.5rem] text-center font-sans">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={goToNextMonth}
            className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 font-sans py-1">
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          if (cell.day === null) {
            return <div key={cell.key} />;
          }

          let className = "text-center text-xs font-medium py-1.5 rounded-md font-sans tabular-nums transition-colors";

          if (cell.isPast) {
            className += " bg-muted text-muted-foreground/50 line-through";
          } else if (cell.isBooked) {
            className += " bg-destructive/15 text-destructive/90 font-semibold";
          } else {
            className += " text-foreground";
          }

          if (cell.isToday && !cell.isBooked) {
            className += " ring-1 ring-gold font-bold text-gold";
          } else if (cell.isToday && cell.isBooked) {
            className += " ring-1 ring-destructive/40";
          }

          return (
            <div key={cell.key} className={className}>
              {cell.day}
            </div>
          );
        })}
      </div>

      {isFetching ? (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-sans">
          <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
          Loading…
        </div>
      ) : (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-sans">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-destructive/15 border border-destructive/30" />
            Booked
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-muted border border-border" />
            Past
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-background border border-gold/40" />
            Available
          </span>
        </div>
      )}
    </div>
  );
}
