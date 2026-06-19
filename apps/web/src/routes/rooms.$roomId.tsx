import { Button } from "@StayBook/ui/components/button";
import { Input } from "@StayBook/ui/components/input";
import { Label } from "@StayBook/ui/components/label";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, CalendarDays, Check, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { apiRequest, ApiClientError, getErrorMessage, type ReservationResponse } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { calendarDateSchema, getDefaultRoomsSearch, getNightCount } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { collectFieldErrors } from "@/lib/forms";
import {
  myReservationQueryOptions,
  reservationKeys,
  roomAvailabilityQueryOptions,
  roomKeys,
  roomQueryOptions,
} from "@/lib/queries";
import { RoomCalendar } from "@/components/room-calendar";

export const Route = createFileRoute("/rooms/$roomId")({
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData({
      ...roomQueryOptions(params.roomId),
      revalidateIfStale: true,
    }),
  errorComponent: RoomDetailErrorComponent,
  component: RoomDetailComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    checkInDate: typeof search.checkInDate === "string" ? search.checkInDate : undefined,
    checkOutDate: typeof search.checkOutDate === "string" ? search.checkOutDate : undefined,
    guests: typeof search.guests === "string" ? search.guests : undefined,
  }),
});

const bookingFormFields = ["checkInDate", "checkOutDate", "guests", "form"] as const;
type BookingFormField = (typeof bookingFormFields)[number];

function RoomDetailErrorComponent({ error }: { error: unknown }) {
  if (error instanceof ApiClientError && error.status === 404) {
    return (
      <main className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-10 px-6 pt-24 pb-12 text-center">
        <div className="flex flex-col items-center gap-6">
          <BedDouble aria-hidden="true" className="text-muted-foreground/60 size-12" />
          <div className="flex flex-col gap-3 max-w-md">
            <span className="text-xs font-bold uppercase tracking-widest text-gold">
              Room Not Found
            </span>
            <h2 className="font-heading text-3xl font-semibold text-foreground tracking-tight md:text-4xl">
              This Room Isn't Available
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We couldn't find this room in our active collection. It may have been deactivated or already booked.
            </p>
          </div>
          <Link
            to="/rooms"
            className="mt-2 inline-flex items-center gap-2 border-b border-foreground pb-1 text-sm font-semibold text-foreground transition-all hover:text-gold hover:border-gold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-6 pt-24 pb-12">
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {getErrorMessage(error)}
      </div>
    </main>
  );
}

function RoomDetailComponent() {
  const { roomId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const { data: room } = useSuspenseQuery(roomQueryOptions(roomId));
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BookingFormField, string>>>({});
  const { data: session } = authClient.useSession();

  const defaults = getDefaultRoomsSearch(today);
  const form = useForm({
    defaultValues: {
      checkInDate: search.checkInDate ?? defaults.checkInDate,
      checkOutDate: search.checkOutDate ?? defaults.checkOutDate,
      guests: search.guests ?? defaults.guests,
    },
    validators: {
      onSubmit: z
        .object({
          checkInDate: calendarDateSchema,
          checkOutDate: calendarDateSchema,
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
        queryClient.setQueryData(
          myReservationQueryOptions(data.reservation.id).queryKey,
          data,
        );
        void queryClient.invalidateQueries({ queryKey: reservationKeys.mine() });
        void queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
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
  const canCheckAvailability =
    Boolean(formValues.checkInDate && formValues.checkOutDate && formValues.guests) &&
    nights > 0;
  const availabilityQuery = useQuery({
    ...roomAvailabilityQueryOptions({
      roomId,
      checkInDate: formValues.checkInDate,
      checkOutDate: formValues.checkOutDate,
      guests: formValues.guests,
    }),
    enabled: canCheckAvailability,
  });
  const availability = canCheckAvailability ? availabilityQuery.data ?? null : null;
  const isCheckingAvailability = availabilityQuery.isFetching;
  const totalPrice = nights > 0 ? room.nightlyPrice * nights : 0;
  const isUnavailable = availability !== null && !availability.available;
  const availabilityBadgeClass = availability?.available
    ? "bg-gold-container text-on-gold-container"
    : "bg-destructive text-white";

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-6 pt-24 pb-28 md:pb-12">
      <Link
        to="/rooms"
        className="inline-flex items-center gap-2 border-b border-foreground pb-1 text-sm font-semibold text-foreground transition-all hover:text-gold hover:border-gold w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to rooms
      </Link>

      {room.photos.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[16/7] md:aspect-[21/9] w-full overflow-hidden rounded-xl bg-muted border border-ghost-border shadow-[0_8px_30px_rgba(26,43,60,0.04)]">
            <img
              src={room.photos[activePhotoIndex].url}
              alt={room.photos[activePhotoIndex].altText ?? room.name}
              className="h-full w-full object-cover"
            />
            <span
              className={`absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${availabilityBadgeClass}`}
            >
              {isCheckingAvailability ? (
                <>
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  Checking…
                </>
              ) : availability?.available ? (
                <>
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  Available
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
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
        <div className="flex aspect-[16/7] md:aspect-[21/9] items-center justify-center rounded-xl bg-muted/30 border border-ghost-border">
          <BedDouble aria-hidden="true" className="text-muted-foreground/40 size-12" />
        </div>
      )}

      <div className="grid gap-12 lg:gap-16 md:grid-cols-[1fr_380px] items-start">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-3 border-b border-border/40 pb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-gold">
              {room.type}
            </span>
            <h1 className="text-4xl sm:text-5xl font-heading text-foreground tracking-tight text-balance">
              {room.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground/90">
              <span className="inline-flex items-center gap-1.5">
                <Users aria-hidden="true" className="size-3.5" />
                Up to {room.maxGuests} guests
              </span>
              <span aria-hidden="true" className="size-1 rounded-full bg-border" />
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-3.5 text-on-sage-container" />
                Instant confirmation
              </span>
            </div>
          </div>

          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              About this stay
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground max-w-prose">
              {room.description}
            </p>
          </section>

          {room.amenities.length > 0 ? (
            <section className="flex flex-col gap-6 border-t border-border/40 pt-10">
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  Amenities & Comforts
                </h2>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 tabular-nums">
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
        <aside className="hidden md:flex flex-col gap-6 rounded-xl border border-ghost-border bg-card p-6 shadow-[0_8px_30px_rgba(26,43,60,0.04)] sticky top-24 self-start">
          <header className="flex items-baseline justify-between border-b border-border/40 pb-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                Nightly Rate
              </span>
              <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
                {formatCents(room.nightlyPrice)}
                <span className="text-sm text-muted-foreground font-normal ml-1">/ night</span>
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${availabilityBadgeClass}`}
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {availability?.available ? "Available" : "Unavailable"}
            </span>
          </header>

          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <form.Field name="checkInDate">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      Check In
                    </Label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id={field.name}
                        type="date"
                        className="h-11 w-full pl-10 pr-3 bg-background border-input rounded-lg text-sm font-medium focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/30"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.checkInDate)}
                      />
                    </div>
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-[10px] text-destructive leading-none">
                        {error?.message}
                      </p>
                    ))}
                    {fieldErrors.checkInDate ? (
                      <p className="text-[10px] text-destructive leading-none">{fieldErrors.checkInDate}</p>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <form.Field name="checkOutDate">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={field.name} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      Check Out
                    </Label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id={field.name}
                        type="date"
                        className="h-11 w-full pl-10 pr-3 bg-background border-input rounded-lg text-sm font-medium focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/30"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.checkOutDate)}
                      />
                    </div>
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-[10px] text-destructive leading-none">
                        {error?.message}
                      </p>
                    ))}
                    {fieldErrors.checkOutDate ? (
                      <p className="text-[10px] text-destructive leading-none">{fieldErrors.checkOutDate}</p>
                    ) : null}
                  </div>
                )}
              </form.Field>
            </div>

            <form.Field name="guests">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={field.name} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    Guests
                  </Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      max={room.maxGuests}
                      className="h-11 w-full pl-10 pr-3 bg-background border-input rounded-lg text-sm font-medium focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold/30"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={field.state.meta.errors.length > 0 || Boolean(fieldErrors.guests)}
                    />
                  </div>
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-[10px] text-destructive leading-none">
                      {error?.message}
                    </p>
                  ))}
                  {fieldErrors.guests ? (
                    <p className="text-[10px] text-destructive leading-none">{fieldErrors.guests}</p>
                  ) : null}
                </div>
              )}
            </form.Field>

            {fieldErrors.form ? (
              <p className="text-sm text-destructive text-center">{fieldErrors.form}</p>
            ) : null}

            {nights > 0 ? (
              <div className="flex flex-col gap-2.5 text-sm text-muted-foreground bg-secondary/50 border border-ghost-border rounded-lg p-4">
                <div className="flex justify-between">
                  <span>{formatCents(room.nightlyPrice)} × {nights} night{nights !== 1 ? "s" : ""}</span>
                  <span className="tabular-nums font-medium text-foreground">{formatCents(totalPrice)}</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-2.5 font-semibold text-foreground">
                  <span className="uppercase tracking-wider text-xs">Total</span>
                  <span className="tabular-nums">{formatCents(totalPrice)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/80 text-center">Select valid stay dates above</p>
            )}

            {isUnavailable ? (
              <p className="text-sm text-destructive text-center bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                This room is already booked for the selected dates. Try different dates.
              </p>
            ) : null}

            <form.Subscribe
              selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  className="w-full h-11 rounded-lg font-semibold cursor-pointer"
                  disabled={!canSubmit || isSubmitting || nights === 0 || isCheckingAvailability || isUnavailable}
                >
                  {isSubmitting
                    ? "Processing Booking…"
                    : isCheckingAvailability
                      ? "Checking Availability…"
                      : isUnavailable
                        ? "Room Unavailable"
                        : "Confirm Booking"}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="border-t border-border/40 pt-5">
            <RoomCalendar roomId={roomId} />
          </div>
        </aside>
      </div>

      {/* Floating Bottom Booking Sheet for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t border-border/60 px-6 py-4 flex items-center justify-between md:hidden shadow-[0_-8px_30px_rgba(26,43,60,0.06)] animate-slide-up">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 leading-none">
            {nights > 0 ? "Total" : "Price"}
          </span>
          <p className="text-base font-bold text-foreground tabular-nums leading-tight">
            {nights > 0 ? formatCents(totalPrice) : formatCents(room.nightlyPrice)}
            {nights === 0 ? (
              <span className="text-xs text-muted-foreground font-normal ml-1">/ night</span>
            ) : (
              <span className="text-xs text-muted-foreground/80 font-normal ml-1.5">
                · {nights} night{nights !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => {
            form.handleSubmit();
          }}
          className="h-11 px-6 rounded-lg font-semibold uppercase tracking-wider text-xs cursor-pointer gap-2"
          disabled={nights === 0 || isCheckingAvailability || isUnavailable}
        >
          <CalendarDays className="size-4" />
          {isUnavailable ? "Unavailable" : "Book Stay"}
        </Button>
      </div>
    </main>
  );
}
