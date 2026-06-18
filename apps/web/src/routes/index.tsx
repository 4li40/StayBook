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
import { Link, createFileRoute } from "@tanstack/react-router";
import { BedDouble, CalendarDays, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function HomeComponent() {
  const today = useMemo(() => new Date(), []);
  const [checkInDate, setCheckInDate] = useState(() => toDateInputValue(addDays(today, 1)));
  const [checkOutDate, setCheckOutDate] = useState(() => toDateInputValue(addDays(today, 3)));
  const [guests, setGuests] = useState("2");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const nights = getNightCount(checkInDate, checkOutDate);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-heading text-foreground tracking-tight text-balance">
            Find Your Perfect Stay
          </h1>
          <p className="max-w-xl text-muted-foreground leading-relaxed">
            Browse available rooms, check dates, and book your reservation in moments.
          </p>
        </div>

        <form
          className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_140px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            loadRooms();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="check-in-date" className="text-muted-foreground">
              <CalendarDays aria-hidden="true" />
              Check In
            </Label>
            <Input
              id="check-in-date"
              name="checkInDate"
              type="date"
              autoComplete="off"
              value={checkInDate}
              onChange={(event) => setCheckInDate(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="check-out-date" className="text-muted-foreground">
              <CalendarDays aria-hidden="true" />
              Check Out
            </Label>
            <Input
              id="check-out-date"
              name="checkOutDate"
              type="date"
              autoComplete="off"
              value={checkOutDate}
              onChange={(event) => setCheckOutDate(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="guest-count" className="text-muted-foreground">
              <Users aria-hidden="true" />
              Guests
            </Label>
            <Input
              id="guest-count"
              name="guests"
              type="number"
              min="1"
              max="20"
              inputMode="numeric"
              autoComplete="off"
              value={guests}
              onChange={(event) => setGuests(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={isLoading}>
              <Search data-icon="inline-start" />
              {isLoading ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" style={{ gridAutoRows: '1fr' }} aria-live="polite">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <Skeleton className="aspect-[4/3] w-full" />
                <CardHeader>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            ))
          : null}

        {!isLoading && rooms.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
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
                  className="group flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                  data-booked={room.booked || undefined}
                >
                  <Card
                    className={`flex h-full flex-col transition-all duration-200 group-hover:shadow-md group-hover:shadow-primary/5 group-hover:-translate-y-0.5 ${
                      room.booked ? "opacity-60" : ""
                    }`}
                  >
                    <div className="relative">
                      {room.primaryPhotoUrl ? (
                        <img
                          src={room.primaryPhotoUrl}
                          alt={room.name}
                          width={800}
                          height={600}
                          className="aspect-[4/3] w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-muted/50">
                          <BedDouble aria-hidden="true" className="text-muted-foreground" />
                        </div>
                      )}
                      {room.booked ? (
                        <span aria-label="Booked" className="absolute top-2 right-2 rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground shadow-xs">
                          Booked
                        </span>
                      ) : null}
                    </div>
                    <CardHeader>
                      <CardTitle>{room.name}</CardTitle>
                      <CardDescription className="capitalize">
                        {room.type} · up to {room.maxGuests} guests
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                        {room.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {room.amenities.slice(0, 4).map((amenity) => (
                          <span
                            key={amenity.id}
                            className="rounded-full bg-accent/50 px-2.5 py-1 text-xs text-accent-foreground"
                          >
                            {amenity.name}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="mt-auto justify-between gap-3">
                      {room.booked ? (
                        <p className="text-sm text-muted-foreground">
                          Booked for these dates
                        </p>
                      ) : (
                        <div className="min-w-0">
                          <p className="font-medium tabular-nums">
                            {formatCents(room.nightlyPrice)} <span className="text-muted-foreground font-normal">/ night</span>
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {nights > 0 ? `${formatCents(total)} total` : "Pick valid dates"}
                          </p>
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
