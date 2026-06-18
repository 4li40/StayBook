import { Button } from "@StayBook/ui/components/button";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { useForm, useStore } from "@tanstack/react-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, CalendarDays, Check, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { apiRequest, ApiClientError, getErrorMessage, type AvailabilityResponse, type ReservationResponse, type RoomDetail } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { collectFieldErrors } from "@/lib/forms";
import { formatCents } from "@/lib/format";
import { RoomCalendar } from "@/components/room-calendar";

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
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
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

  useEffect(() => {
    if (!room || !formValues.checkInDate || !formValues.checkOutDate || nights <= 0) {
      setAvailability(null);
      return;
    }

    let cancelled = false;
    setIsCheckingAvailability(true);

    apiRequest<AvailabilityResponse>(
      `/api/rooms/${roomId}/availability?checkInDate=${formValues.checkInDate}&checkOutDate=${formValues.checkOutDate}&guests=${formValues.guests}`,
    )
      .then((data) => {
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAvailability(false);
      });

    return () => { cancelled = true; };
  }, [room, roomId, formValues.checkInDate, formValues.checkOutDate, formValues.guests, nights]);

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-6 py-10 pb-28 md:pb-16 animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to rooms
      </Link>

      {isLoading ? (
        <div className="flex flex-col gap-8">
          <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
          <div className="grid gap-12 md:grid-cols-[1fr_360px] items-start">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full mt-4" />
            </div>
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </div>
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : isNotFound ? (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-ghost-border bg-card p-12 text-center">
          <BedDouble aria-hidden="true" className="text-muted-foreground/60 size-12" />
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl text-foreground tracking-tight">Room Not Available</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              We couldn't find this room in our active collection. It may have been deactivated or booked.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary hover:opacity-95 mt-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to search
          </Link>
        </div>
      ) : room ? (
        <div className="flex flex-col gap-12">
          {room.photos.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="relative aspect-[16/7] md:aspect-[21/9] w-full overflow-hidden rounded-2xl bg-muted border border-border/30 shadow-[0_8px_30px_rgba(26,43,60,0.04)]">
                <img
                  src={room.photos[activePhotoIndex].url}
                  alt={room.photos[activePhotoIndex].altText ?? room.name}
                  className="h-full w-full object-cover transition-all duration-700"
                />
                <span className={`absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] shadow-md backdrop-blur-sm ${
                  availability?.available
                    ? "bg-emerald-600 text-white"
                    : "bg-destructive text-white"
                }`}>
                  {isCheckingAvailability ? (
                    <>
                      <span className="size-1.5 rounded-full bg-white animate-pulse" />
                      Checking…
                    </>
                  ) : availability?.available ? (
                    <>
                      <Sparkles aria-hidden="true" className="size-3.5" />
                      Available
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
                      Not Available
                    </>
                  )}
                </span>
              </div>
              {room.photos.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {room.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setActivePhotoIndex(index)}
                      aria-label={`View photo ${index + 1} of ${room.name}`}
                      aria-pressed={index === activePhotoIndex}
                      className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        index === activePhotoIndex
                          ? "border-gold ring-2 ring-gold/20 opacity-100"
                          : "border-ghost-border opacity-60 hover:opacity-90"
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
            <div className="flex aspect-[16/7] md:aspect-[21/9] items-center justify-center rounded-2xl bg-muted/30 border border-ghost-border">
              <BedDouble aria-hidden="true" className="text-muted-foreground/40 size-12" />
            </div>
          )}

          <div className="grid gap-12 lg:gap-16 md:grid-cols-[1fr_380px] items-start">
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-3 border-b border-border/40 pb-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 font-sans">
                  {room.type}
                </span>
                <h1 className="text-4xl md:text-5xl font-heading text-foreground tracking-tight leading-[1.1]">
                  {room.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2 text-xs text-muted-foreground font-sans">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Users aria-hidden="true" className="size-3.5" />
                    Up to {room.maxGuests} guests
                  </span>
                  <span aria-hidden="true" className="size-1 rounded-full bg-border" />
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Check aria-hidden="true" className="size-3.5 text-on-sage-container" />
                    Instant confirmation
                  </span>
                </div>
              </div>

              <section className="flex flex-col gap-4">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground font-sans">
                  About this stay
                </h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground/90 max-w-prose">
                  {room.description}
                </p>
              </section>

              {room.amenities.length > 0 ? (
                <section className="flex flex-col gap-5 border-t border-border/40 pt-10">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground font-sans">
                      Amenities & Comforts
                    </h2>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 font-sans tabular-nums">
                      {room.amenities.length} included
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {room.amenities.map((amenity) => (
                      <span
                        key={amenity.id}
                        className="inline-flex items-center rounded-full bg-sage-container/10 text-on-sage-container border border-sage-container/20 px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors hover:bg-sage-container/15"
                      >
                        {amenity.name}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="flex flex-col gap-5 border-t border-border/40 pt-10 md:hidden">
                <RoomCalendar roomId={roomId} />
              </section>
            </div>

            {/* Desktop Booking Card (Sticky) */}
            <aside className="hidden md:flex flex-col gap-6 rounded-xl border border-ghost-border bg-card p-7 shadow-[0_8px_30px_rgba(26,43,60,0.04)] sticky top-24 self-start">
              <header className="flex items-baseline justify-between border-b border-border/40 pb-5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 font-sans">
                    Nightly Rate
                  </span>
                  <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
                    {formatCents(room.nightlyPrice)}
                    <span className="text-xs text-muted-foreground/80 font-sans font-normal ml-1">/ night</span>
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] shadow-sm ${
                  availability?.available
                    ? "bg-emerald-600 text-white"
                    : "bg-destructive text-white"
                }`}>
                  <span aria-hidden="true" className={`size-1.5 rounded-full bg-white`} />
                  {availability?.available ? "Available" : "Unavailable"}
                </span>
              </header>

              <form
                noValidate
                className="flex flex-col gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
              >
                <div className="rounded-xl border border-ghost-border bg-background/40 overflow-hidden focus-within:border-gold focus-within:ring-1 focus-within:ring-gold/30 transition-all">
                  <div className="grid grid-cols-2 divide-x divide-ghost-border border-b border-ghost-border">
                    <form.Field name="checkInDate">
                      {(field) => (
                        <div className="flex flex-col gap-1.5 p-3.5 min-h-12">
                          <Label htmlFor={field.name} className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground font-sans gap-0">
                            Check In
                          </Label>
                          <Input
                            id={field.name}
                            type="date"
                            className="h-7 border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none text-sm font-semibold w-full cursor-pointer shadow-none"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.checkInDate)}
                          />
                          {field.state.meta.errors.map((error) => (
                            <p key={error?.message} className="text-[10px] text-destructive leading-none mt-0.5">
                              {error?.message}
                            </p>
                          ))}
                          {fieldErrors.checkInDate ? (
                            <p className="text-[10px] text-destructive leading-none mt-0.5">{fieldErrors.checkInDate}</p>
                          ) : null}
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="checkOutDate">
                      {(field) => (
                        <div className="flex flex-col gap-1.5 p-3.5 min-h-12">
                          <Label htmlFor={field.name} className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground font-sans gap-0">
                            Check Out
                          </Label>
                          <Input
                            id={field.name}
                            type="date"
                            className="h-7 border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none text-sm font-semibold w-full cursor-pointer shadow-none"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.checkOutDate)}
                          />
                          {field.state.meta.errors.map((error) => (
                            <p key={error?.message} className="text-[10px] text-destructive leading-none mt-0.5">
                              {error?.message}
                            </p>
                          ))}
                          {fieldErrors.checkOutDate ? (
                            <p className="text-[10px] text-destructive leading-none mt-0.5">{fieldErrors.checkOutDate}</p>
                          ) : null}
                        </div>
                      )}
                    </form.Field>
                  </div>

                  <form.Field name="guests">
                    {(field) => (
                      <div className="flex flex-col gap-1.5 p-3.5 min-h-12">
                        <Label htmlFor={field.name} className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground font-sans gap-0">
                          Guests
                        </Label>
                        <Input
                          id={field.name}
                          type="number"
                          min="1"
                          max={room.maxGuests}
                          className="h-7 border-0 p-0 text-foreground bg-transparent focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0 focus-visible:outline-none text-sm font-semibold w-full font-sans shadow-none"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.guests)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-[10px] text-destructive leading-none mt-0.5">
                            {error?.message}
                          </p>
                        ))}
                        {fieldErrors.guests ? (
                          <p className="text-[10px] text-destructive leading-none mt-0.5">{fieldErrors.guests}</p>
                        ) : null}
                      </div>
                    )}
                  </form.Field>
                </div>

                {fieldErrors.form ? (
                  <p className="text-xs text-destructive text-center font-sans">{fieldErrors.form}</p>
                ) : null}

                {nights > 0 ? (
                  <div className="flex flex-col gap-2.5 text-xs text-muted-foreground/95 bg-secondary/50 border border-ghost-border rounded-xl p-4 mt-1">
                    <div className="flex justify-between font-sans">
                      <span>{formatCents(room.nightlyPrice)} × {nights} night{nights !== 1 ? "s" : ""}</span>
                      <span className="tabular-nums font-medium text-foreground">{formatCents(room.nightlyPrice * nights)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/30 pt-2.5 font-semibold text-foreground text-sm font-sans">
                      <span className="uppercase tracking-[0.08em] text-[11px]">Total</span>
                      <span className="tabular-nums">{formatCents(room.nightlyPrice * nights)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/80 text-center mt-1 font-sans">Select valid stay dates above</p>
                )}

                {availability !== null && !availability.available ? (
                  <p className="text-xs text-destructive text-center font-sans bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                    This room is already booked for the selected dates. Try different dates.
                  </p>
                ) : null}

                <form.Subscribe
                  selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
                >
                  {({ canSubmit, isSubmitting }) => (
                    <Button type="submit" className="w-full mt-1 cursor-pointer h-12 text-sm font-semibold tracking-[0.04em] font-sans rounded-lg" disabled={!canSubmit || isSubmitting || nights === 0 || isCheckingAvailability || (availability !== null && !availability.available)}>
                      {isSubmitting ? "Processing Booking…" : isCheckingAvailability ? "Checking Availability…" : availability !== null && !availability.available ? "Room Unavailable" : "Confirm Booking"}
                    </Button>
                  )}
                </form.Subscribe>
              </form>

              <div className="border-t border-border/40 pt-5">
                <RoomCalendar roomId={roomId} />
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      {/* Floating Bottom Booking Sheet for Mobile */}
      {!isLoading && room && !isNotFound && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t border-border/60 px-6 py-4 flex items-center justify-between md:hidden shadow-[0_-8px_30px_rgba(26,43,60,0.06)] animate-slide-up">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 leading-none">
              {nights > 0 ? "Total" : "Price"}
            </span>
            <p className="text-base font-bold text-foreground tabular-nums leading-tight">
              {nights > 0 ? formatCents(room.nightlyPrice * nights) : formatCents(room.nightlyPrice)}
              {nights === 0 ? (
                <span className="text-[10px] text-muted-foreground font-normal ml-1">/ night</span>
              ) : (
                <span className="text-[10px] text-muted-foreground/80 font-normal ml-1.5">
                  · {nights} night{nights !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <Button
            onClick={() => {
              form.handleSubmit();
            }}
            className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.08em] cursor-pointer rounded-lg"
            disabled={nights === 0 || isCheckingAvailability || (availability !== null && !availability.available)}
          >
            <CalendarDays data-icon="inline-start" className="size-4" />
            {availability !== null && !availability.available ? "Unavailable" : "Book Stay"}
          </Button>
        </div>
      )}
    </main>
  );
}
