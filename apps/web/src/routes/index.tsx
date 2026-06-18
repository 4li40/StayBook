import { Button } from "@StayBook/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { useForm, useStore } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BedDouble, CalendarDays, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import z from "zod";

import { apiRequest, getErrorMessage, type Room } from "@/lib/api";
import { formatCents } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

type RoomsResponse = {
  rooms: Room[];
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getNightCount(checkInDate: string, checkOutDate: string) {
  const checkIn = new Date(`${checkInDate}T00:00:00`);
  const checkOut = new Date(`${checkOutDate}T00:00:00`);
  const nights = (checkOut.getTime() - checkIn.getTime()) / 86_400_000;
  return Number.isFinite(nights) && nights > 0 ? nights : 0;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string) {
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

const searchFormSchema = z
  .object({
    checkInDate: z.string().regex(datePattern, "Use YYYY-MM-DD format.").refine(isValidCalendarDate, "Use a real calendar date."),
    checkOutDate: z.string().regex(datePattern, "Use YYYY-MM-DD format.").refine(isValidCalendarDate, "Use a real calendar date."),
    guests: z.string().min(1, "Required").refine((v) => Number(v) >= 1 && Number.isInteger(Number(v)), "At least 1 guest"),
  })
  .refine(
    (value) => getNightCount(value.checkInDate, value.checkOutDate) > 0,
    {
      message: "Check-out must be after check-in.",
      path: ["checkOutDate"],
    },
  );

function HomeComponent() {
  const today = useMemo(() => new Date(), []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      checkInDate: toDateInputValue(addDays(today, 1)),
      checkOutDate: toDateInputValue(addDays(today, 3)),
      guests: "2",
    },
    validators: {
      onSubmit: searchFormSchema,
    },
    onSubmit: async () => {
      await loadRooms();
    },
  });

  const formValues = useStore(form.store, (state) => state.values);
  const { checkInDate, checkOutDate, guests } = formValues;
  const nights = getNightCount(checkInDate, checkOutDate);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const query = new URLSearchParams({
        checkInDate,
        checkOutDate,
        guests,
      });
      const data = await apiRequest<RoomsResponse>(`/api/rooms?${query}`);
      setRooms(data.rooms);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [checkInDate, checkOutDate, guests]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <section className="flex flex-col items-center text-center gap-8 py-4">
        <div className="flex flex-col gap-3 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-heading text-foreground tracking-tight text-balance">
            Curated Spaces for the Thoughtful Traveler
          </h1>
          <p className="text-base text-muted-foreground/90 leading-relaxed font-sans max-w-lg mx-auto">
            StayBook connects you with handpicked architectural retreats and luxury boutique stays.
          </p>
        </div>

        <form
          className="w-full max-w-4xl flex flex-col md:flex-row items-stretch gap-2 md:gap-0 rounded-2xl md:rounded-full border border-border/80 bg-card p-2 md:pl-6 md:pr-2 shadow-xs transition-all hover:shadow-sm focus-within:ring-1 focus-within:ring-primary/20"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="checkInDate">
            {(field) => (
              <div className="flex flex-1 flex-col justify-center px-4 py-2 md:py-1 text-left">
                <label htmlFor={field.name} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-0.5">
                  Check In
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="date"
                  autoComplete="off"
                  className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none placeholder:text-muted-foreground/50 md:text-sm font-medium w-full cursor-pointer"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-[10px] text-destructive mt-0.5 leading-none">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="hidden md:block w-px bg-border/60 my-2" />

          <form.Field name="checkOutDate">
            {(field) => (
              <div className="flex flex-1 flex-col justify-center px-4 py-2 md:py-1 text-left">
                <label htmlFor={field.name} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-0.5">
                  Check Out
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="date"
                  autoComplete="off"
                  className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none placeholder:text-muted-foreground/50 md:text-sm font-medium w-full cursor-pointer"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-[10px] text-destructive mt-0.5 leading-none">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="hidden md:block w-px bg-border/60 my-2" />

          <form.Field name="guests">
            {(field) => (
              <div className="flex md:w-[160px] flex-col justify-center px-4 py-2 md:py-1 text-left">
                <label htmlFor={field.name} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-0.5">
                  Guests
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  min="1"
                  max="20"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none placeholder:text-muted-foreground/50 md:text-sm font-medium w-full"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-[10px] text-destructive mt-0.5 leading-none">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="flex items-center justify-center p-1">
            <Button type="submit" className="h-12 w-full md:w-12 md:rounded-full bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-2 md:p-0 transition-transform active:scale-95 cursor-pointer" disabled={isLoading}>
              <Search className="h-4 w-4" />
              <span className="md:hidden font-medium text-sm">Search Rooms</span>
            </Button>
          </div>
        </form>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" style={{ gridAutoRows: '1fr' }} aria-live="polite">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden border border-border/40">
                <Skeleton className="aspect-[4/3] w-full" />
                <CardHeader className="p-5 pb-2">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/3 mt-2" />
                </CardHeader>
                <CardContent className="px-5 py-2 flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            ))
          : null}

        {!isLoading && rooms.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
            No rooms match this search. Try fewer guests or a different date range.
          </div>
        ) : null}

        {!isLoading
          ? rooms.map((room) => {
              const total = room.nightlyPrice * nights;

              return (
                <Link
                  key={room.id}
                  to="/rooms/$roomId"
                  params={{ roomId: room.id }}
                  search={{ checkInDate, checkOutDate, guests }}
                  className="group flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                  data-booked={room.booked || undefined}
                >
                  <Card
                    className={`flex h-full flex-col overflow-hidden border border-border/40 bg-card transition-all duration-300 group-hover:border-border group-hover:shadow-xs group-hover:-translate-y-0.5 ${
                      room.booked ? "opacity-60" : ""
                    }`}
                  >
                    <div className="relative overflow-hidden aspect-[4/3] bg-muted">
                      {room.primaryPhotoUrl ? (
                        <img
                          src={room.primaryPhotoUrl}
                          alt={room.name}
                          width={800}
                          height={600}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted/30">
                          <BedDouble aria-hidden="true" className="text-muted-foreground/60 size-8" />
                        </div>
                      )}
                      {room.booked ? (
                        <span aria-label="Booked" className="absolute top-3 right-3 rounded bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground shadow-xs">
                          Booked
                        </span>
                      ) : null}
                    </div>

                    <CardHeader className="p-5 pb-2">
                      <CardTitle className="font-heading text-xl text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {room.name}
                      </CardTitle>
                      <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/85 mt-1">
                        {room.type} · up to {room.maxGuests} guests
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="px-5 py-2 flex flex-col gap-3">
                      <p className="line-clamp-2 text-xs text-muted-foreground/90 leading-relaxed">
                        {room.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 3).map((amenity) => (
                          <span
                            key={amenity.id}
                            className="rounded bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/10"
                          >
                            {amenity.name}
                          </span>
                        ))}
                      </div>
                    </CardContent>

                    <CardFooter className="mt-auto p-5 pt-3 border-t border-border/30 justify-between items-end">
                      {room.booked ? (
                        <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                          Booked for these dates
                        </p>
                      ) : (
                        <div className="flex items-baseline gap-1.5 w-full justify-between">
                          <div>
                            <span className="text-base font-bold text-foreground tabular-nums">
                              {formatCents(room.nightlyPrice)}
                            </span>
                            <span className="text-xs text-muted-foreground/80 font-medium"> / night</span>
                          </div>
                          {nights > 0 ? (
                            <span className="text-xs font-medium text-muted-foreground tabular-nums">
                              {formatCents(total)} total
                            </span>
                          ) : null}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                </Link>
              );
            })
          : null}
      </section>
    </main>
  );
}
