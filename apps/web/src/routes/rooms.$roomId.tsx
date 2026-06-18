import { Button } from "@StayBook/ui/components/button";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { useForm, useStore } from "@tanstack/react-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, CalendarDays, Check, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { apiRequest, ApiClientError, getErrorMessage, type ReservationResponse, type RoomDetail } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { collectFieldErrors } from "@/lib/forms";
import { formatCents } from "@/lib/format";

export const Route = createFileRoute("/rooms/$roomId")({
  component: RoomDetailComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    checkInDate: typeof search.checkInDate === "string" ? search.checkInDate : undefined,
    checkOutDate: typeof search.checkOutDate === "string" ? search.checkOutDate : undefined,
    guests: typeof search.guests === "string" ? search.guests : undefined,
  }),
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

const bookingFormFields = ["checkInDate", "checkOutDate", "guests", "form"] as const;
type BookingFormField = (typeof bookingFormFields)[number];

function RoomDetailComponent() {
  const { roomId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BookingFormField, string>>>({});
  const { data: session } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      checkInDate: search.checkInDate ?? toDateInputValue(addDays(today, 1)),
      checkOutDate: search.checkOutDate ?? toDateInputValue(addDays(today, 3)),
      guests: search.guests ?? "2",
    },
    validators: {
      onSubmit: z
        .object({
          checkInDate: z.string().regex(datePattern, "Use YYYY-MM-DD format.").refine(isValidCalendarDate, "Use a real calendar date."),
          checkOutDate: z.string().regex(datePattern, "Use YYYY-MM-DD format.").refine(isValidCalendarDate, "Use a real calendar date."),
          guests: z.string().min(1, "Required"),
        })
        .refine(
          (value) => getNightCount(value.checkInDate, value.checkOutDate) > 0,
          {
            message: "Check-out must be after check-in.",
            path: ["checkOutDate"],
          },
        ),
    },
    onSubmit: async ({ value }) => {
      if (!session) {
        toast.error("Sign in before booking a room.");
        return;
      }

      if (!room) return;

      setFieldErrors({});

      try {
        const data = await apiRequest<ReservationResponse>("/api/reservations", {
          method: "POST",
          body: JSON.stringify({
            roomId: room.id,
            checkInDate: value.checkInDate,
            checkOutDate: value.checkOutDate,
            guestCount: Number(value.guests),
          }),
        });
        toast.success("Reservation confirmed.");
        navigate({
          to: "/confirmation/$reservationId",
          params: { reservationId: data.reservation.id },
        });
      } catch (error) {
        const errors = collectFieldErrors(error, bookingFormFields, { guestCount: "guests" });
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
        } else {
          toast.error(getErrorMessage(error));
        }
      }
    },
  });

  const formValues = useStore(form.store, (state) => state.values);
  const nights = getNightCount(formValues.checkInDate, formValues.checkOutDate);

  const loadRoom = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsNotFound(false);

    try {
      const data = await apiRequest<RoomDetail>(`/api/rooms/${roomId}`);
      setRoom(data);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        setIsNotFound(true);
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 pb-24 md:pb-10 animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to rooms
      </Link>

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          <Skeleton className="h-10 w-1/2 mt-4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-32 w-full mt-4" />
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : isNotFound ? (
        <div className="flex flex-col items-center gap-5 rounded-xl border border-border/80 bg-card p-12 text-center">
          <BedDouble aria-hidden="true" className="text-muted-foreground/60 size-12" />
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl text-foreground tracking-tight">Room Not Available</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              We couldn't find this room in our active collection. It may have been deactivated or booked.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary hover:opacity-95 mt-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to search
          </Link>
        </div>
      ) : room ? (
        <div className="flex flex-col gap-8">
          {room.photos.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="relative aspect-[16/7] md:aspect-[21/9] w-full overflow-hidden rounded-xl bg-muted border border-border/30">
                <img
                  src={room.photos[activePhotoIndex].url}
                  alt={room.photos[activePhotoIndex].altText ?? room.name}
                  className="h-full w-full object-cover transition-all duration-700"
                />
              </div>
              {room.photos.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {room.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setActivePhotoIndex(index)}
                      className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border transition-all ${
                        index === activePhotoIndex
                          ? "border-primary ring-2 ring-primary/10 opacity-100"
                          : "border-transparent opacity-60 hover:opacity-90"
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
            <div className="flex aspect-[16/7] md:aspect-[21/9] items-center justify-center rounded-xl bg-muted/30 border border-border/30">
              <BedDouble aria-hidden="true" className="text-muted-foreground/40 size-12" />
            </div>
          )}

          <div className="grid gap-10 md:grid-cols-[1fr_360px] items-start">
            <div className="flex flex-col gap-6">
              <div className="border-b border-border/40 pb-5">
                <h1 className="text-4xl font-heading text-foreground tracking-tight">{room.name}</h1>
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/85 mt-2">
                  {room.type} · up to {room.maxGuests} guests
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <h2 className="text-xs uppercase tracking-wider font-bold text-foreground">About this stay</h2>
                <p className="text-sm leading-relaxed text-muted-foreground/90">{room.description}</p>
              </div>

              {room.amenities.length > 0 ? (
                <div className="flex flex-col gap-4 border-t border-border/40 pt-6">
                  <h2 className="text-xs uppercase tracking-wider font-bold text-foreground font-sans">Amenities & Comforts</h2>
                  <div className="flex flex-wrap gap-2">
                    {room.amenities.map((amenity) => (
                      <span
                        key={amenity.id}
                        className="inline-flex items-center rounded-md bg-secondary/80 px-3 py-1 text-xs text-muted-foreground border border-border/10 font-medium"
                      >
                        {amenity.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Desktop Booking Card (Sticky) */}
            <div className="hidden md:flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-6 shadow-xs sticky top-24">
              <div className="flex items-baseline justify-between border-b border-border/40 pb-4">
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground/80">Rate</span>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {formatCents(room.nightlyPrice)}
                  <span className="text-xs text-muted-foreground/80 font-sans font-normal"> / night</span>
                </p>
              </div>

              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
              >
                <div className="border border-border/80 rounded-lg overflow-hidden grid grid-cols-2 bg-background/20">
                  <form.Field name="checkInDate">
                    {(field) => (
                      <div className="p-3 border-r border-b border-border/80 flex flex-col gap-1">
                        <label htmlFor={field.name} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/95">
                          Check In
                        </label>
                        <Input
                          id={field.name}
                          type="date"
                          className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none text-sm font-semibold w-full cursor-pointer"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.checkInDate)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-[10px] text-destructive leading-none mt-1">
                            {error?.message}
                          </p>
                        ))}
                        {fieldErrors.checkInDate ? (
                          <p className="text-[10px] text-destructive leading-none mt-1">{fieldErrors.checkInDate}</p>
                        ) : null}
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="checkOutDate">
                    {(field) => (
                      <div className="p-3 border-b border-border/80 flex flex-col gap-1">
                        <label htmlFor={field.name} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/95">
                          Check Out
                        </label>
                        <Input
                          id={field.name}
                          type="date"
                          className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none text-sm font-semibold w-full cursor-pointer"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.checkOutDate)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-[10px] text-destructive leading-none mt-1">
                            {error?.message}
                          </p>
                        ))}
                        {fieldErrors.checkOutDate ? (
                          <p className="text-[10px] text-destructive leading-none mt-1">{fieldErrors.checkOutDate}</p>
                        ) : null}
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="guests">
                    {(field) => (
                      <div className="col-span-2 p-3 flex flex-col gap-1">
                        <label htmlFor={field.name} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/95">
                          Guests
                        </label>
                        <Input
                          id={field.name}
                          type="number"
                          min="1"
                          max={room.maxGuests}
                          className="h-auto border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none text-sm font-semibold w-full"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.guests)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-[10px] text-destructive leading-none mt-1">
                            {error?.message}
                          </p>
                        ))}
                        {fieldErrors.guests ? (
                          <p className="text-[10px] text-destructive leading-none mt-1">{fieldErrors.guests}</p>
                        ) : null}
                      </div>
                    )}
                  </form.Field>
                </div>

                {fieldErrors.form ? (
                  <p className="text-xs text-destructive text-center">{fieldErrors.form}</p>
                ) : null}

                {nights > 0 ? (
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground/95 bg-secondary/30 rounded-lg p-3 border border-border/30 mt-1">
                    <div className="flex justify-between">
                      <span>{formatCents(room.nightlyPrice)} x {nights} night{nights !== 1 ? "s" : ""}</span>
                      <span className="tabular-nums font-medium text-foreground">{formatCents(room.nightlyPrice * nights)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/40 pt-2 font-semibold text-foreground text-sm">
                      <span>Total Price</span>
                      <span className="tabular-nums">{formatCents(room.nightlyPrice * nights)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/80 text-center mt-1">Select valid stay dates above</p>
                )}

                <form.Subscribe
                  selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
                >
                  {({ canSubmit, isSubmitting }) => (
                    <Button type="submit" className="w-full mt-2 cursor-pointer h-11 text-sm font-semibold tracking-wide" disabled={!canSubmit || isSubmitting || nights === 0}>
                      {isSubmitting ? "Processing Booking…" : "Confirm Booking"}
                    </Button>
                  )}
                </form.Subscribe>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* Floating Bottom Booking Sheet for Mobile */}
      {!isLoading && room && !isNotFound && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t border-border/50 px-6 py-4 flex items-center justify-between md:hidden shadow-lg animate-slide-up">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 leading-none mb-1">Price</span>
            <p className="text-sm font-bold text-foreground tabular-nums">
              {formatCents(room.nightlyPrice)} <span className="text-[10px] text-muted-foreground font-normal">/ night</span>
            </p>
            {nights > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground/95 tabular-nums">
                Total ({nights} night{nights !== 1 ? "s" : ""}): {formatCents(room.nightlyPrice * nights)}
              </span>
            )}
          </div>
          <div>
            <Button
              onClick={() => {
                // Submit the form directly or scroll to form if fields need adjustment
                form.handleSubmit();
              }}
              className="h-10 px-6 text-xs font-semibold uppercase tracking-wider cursor-pointer"
              disabled={nights === 0}
            >
              Book Stay
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
