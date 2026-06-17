import { Button } from "@StayBook/ui/components/button";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, CalendarDays, Check, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { apiRequest, getErrorMessage, type RoomDetail } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/rooms/$roomId")({
  component: RoomDetailComponent,
});

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

const moneyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

function RoomDetailComponent() {
  const { roomId } = Route.useParams();
  const today = useMemo(() => new Date(), []);
  const [checkInDate, setCheckInDate] = useState(() => toDateInputValue(addDays(today, 1)));
  const [checkOutDate, setCheckOutDate] = useState(() => toDateInputValue(addDays(today, 3)));
  const [guests, setGuests] = useState("2");
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const { data: session } = authClient.useSession();

  const loadRoom = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiRequest<RoomDetail>(`/api/rooms/${roomId}`);
      setRoom(data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  const nights = getNightCount(checkInDate, checkOutDate);

  async function bookRoom() {
    if (!session) {
      toast.error("Sign in before booking a room.");
      return;
    }

    if (!room) return;

    setIsBooking(true);

    try {
      await apiRequest("/api/reservations", {
        method: "POST",
        body: JSON.stringify({
          roomId: room.id,
          checkInDate,
          checkOutDate,
          guestCount: Number(guests),
        }),
      });
      toast.success("Reservation confirmed.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" />
        Back to rooms
      </Link>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-[16/9] w-full rounded-lg" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : room ? (
        <div className="flex flex-col gap-6">
          {room.photos.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
                <img
                  src={room.photos[activePhotoIndex].url}
                  alt={room.photos[activePhotoIndex].altText ?? room.name}
                  className="h-full w-full object-cover"
                />
              </div>
              {room.photos.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {room.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setActivePhotoIndex(index)}
                      className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                        index === activePhotoIndex
                          ? "border-foreground"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.altText ?? room.name}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center rounded-lg bg-muted">
              <BedDouble aria-hidden="true" className="text-muted-foreground" />
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
                <p className="capitalize text-muted-foreground">
                  {room.type} · up to {room.maxGuests} guests
                </p>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{room.description}</p>

              {room.amenities.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h2 className="text-sm font-medium">Amenities</h2>
                  <div className="flex flex-wrap gap-2">
                    {room.amenities.map((amenity) => (
                      <span
                        key={amenity.id}
                        className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                      >
                        <Check className="h-3 w-3" />
                        {amenity.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
              <p className="text-lg font-medium tabular-nums">
                {moneyFormatter.format(Number(room.nightlyPrice))} / night
              </p>

              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  bookRoom();
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="check-in-date">
                    <CalendarDays aria-hidden="true" />
                    Check In
                  </Label>
                  <Input
                    id="check-in-date"
                    type="date"
                    value={checkInDate}
                    onChange={(event) => setCheckInDate(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="check-out-date">
                    <CalendarDays aria-hidden="true" />
                    Check Out
                  </Label>
                  <Input
                    id="check-out-date"
                    type="date"
                    value={checkOutDate}
                    onChange={(event) => setCheckOutDate(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="guest-count">
                    <Users aria-hidden="true" />
                    Guests
                  </Label>
                  <Input
                    id="guest-count"
                    type="number"
                    min="1"
                    max={room.maxGuests}
                    inputMode="numeric"
                    value={guests}
                    onChange={(event) => setGuests(event.target.value)}
                  />
                </div>

                {nights > 0 ? (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {nights} night{nights !== 1 ? "s" : ""} · {moneyFormatter.format(Number(room.nightlyPrice) * nights)} total
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Pick valid dates</p>
                )}

                <Button type="submit" className="w-full" disabled={isBooking || nights === 0}>
                  {isBooking ? "Booking…" : "Book Now"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
