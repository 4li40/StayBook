import { Button } from "@StayBook/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, Check, CalendarDays, Users } from "lucide-react";

import { getErrorMessage, type Reservation } from "@/lib/api";
import { getNightCount } from "@/lib/dates";
import { formatCents, formatStayDate } from "@/lib/format";
import { myReservationQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_auth/confirmation/$reservationId")({
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData({
      ...myReservationQueryOptions(params.reservationId),
      revalidateIfStale: true,
    }),
  errorComponent: ConfirmationErrorComponent,
  component: ConfirmationComponent,
});

function ConfirmationErrorComponent({ error }: { error: unknown }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-24 pb-8">
      <Link to="/rooms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        Back to search
      </Link>
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {getErrorMessage(error)}
      </div>
    </main>
  );
}

function ConfirmationComponent() {
  const { reservationId } = Route.useParams();
  const { data } = useSuspenseQuery(myReservationQueryOptions(reservationId));
  const reservation = data.reservation;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-24 pb-8">
      <Link to="/rooms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        Back to search
      </Link>

      <ConfirmationDetails reservation={reservation} />
    </main>
  );
}

function ConfirmationDetails({ reservation }: { reservation: Reservation }) {
  const reservationNights = getNightCount(reservation.checkInDate, reservation.checkOutDate);

  return (
    <div className="flex flex-col gap-8 py-4 animate-fade-in">
      <div className="flex flex-col gap-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check aria-hidden="true" className="size-6" />
        </div>
        <h1 className="text-4xl font-heading text-foreground tracking-tight">
          Booking Confirmed
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your reservation has been placed successfully. We have sent the confirmation details to your email.
        </p>
      </div>

      <Card className="border border-border/40 bg-card rounded-xl overflow-hidden shadow-xs">
        <CardHeader className="p-6 pb-4 border-b border-border/30">
          <CardTitle className="font-heading text-2xl text-foreground">{reservation.room.name}</CardTitle>
          <CardDescription className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mt-1">
            {reservation.room.type}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6 text-sm md:grid-cols-2 bg-secondary/10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">Check In</span>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground/60" />
              {formatStayDate(reservation.checkInDate)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">Check Out</span>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground/60" />
              {formatStayDate(reservation.checkOutDate)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">Guests Allowed</span>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Users aria-hidden="true" className="size-4 text-muted-foreground/60" />
              Up to {reservation.room.maxGuests} guests
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">Length of Stay</span>
            <p className="font-semibold text-foreground">
              {reservationNights} night{reservationNights !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="border-t border-border/40 pt-4 md:col-span-2 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block">Status</span>
              <span className="capitalize font-bold text-foreground text-sm">{reservation.status}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block">Amount Paid</span>
              <span className="font-bold text-foreground text-lg tabular-nums">{formatCents(reservation.totalPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {reservation.room.primaryPhotoUrl ? (
        <div className="overflow-hidden rounded-xl aspect-[16/7] md:aspect-[21/9] border border-border/30 bg-muted">
          <img
            src={reservation.room.primaryPhotoUrl}
            alt={reservation.room.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/7] md:aspect-[21/9] items-center justify-center rounded-xl bg-muted/30 border border-border/30">
          <BedDouble aria-hidden="true" className="text-muted-foreground/40 size-12" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/dashboard" className="flex-1">
          <Button className="w-full cursor-pointer h-10 font-semibold text-sm">View My Stays</Button>
        </Link>
        <Link to="/rooms" className="flex-1">
          <Button variant="outline" className="w-full cursor-pointer h-10 font-semibold text-sm">Book Another Room</Button>
        </Link>
      </div>
    </div>
  );
}
