import { Button } from "@StayBook/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@StayBook/ui/components/card";
import { Skeleton } from "@StayBook/ui/components/skeleton";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BedDouble, CalendarX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  apiRequest,
  getErrorMessage,
  type Reservation,
  type ReservationsResponse,
} from "@/lib/api";
import { formatCents } from "@/lib/format";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiRequest<ReservationsResponse>("/api/reservations/me?pageSize=50");
      setReservations(data.reservations);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  async function cancelReservation(reservation: Reservation) {
    const confirmed = window.confirm(
      `Cancel your reservation for ${reservation.room.name} on ${formatDate(
        reservation.checkInDate,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    const reason = window.prompt("Cancellation reason");
    setCancellingId(reservation.id);

    try {
      await apiRequest(`/api/reservations/${reservation.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          cancellationReason: reason?.trim() || undefined,
        }),
      });
      toast.success("Reservation cancelled.");
      await loadReservations();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading text-foreground tracking-tight text-balance">
            Welcome, {session.data?.user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage your reservations.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadReservations} disabled={isLoading}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </section>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="flex flex-col gap-6" aria-live="polite">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="overflow-hidden border border-border/40 flex flex-col md:flex-row items-stretch">
                <Skeleton className="w-full md:w-48 aspect-[4/3] md:aspect-auto md:h-auto flex-shrink-0" />
                <div className="flex-1 p-6 flex flex-col gap-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full mt-4" />
                </div>
              </Card>
            ))
          : null}

        {!isLoading && reservations.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-xl border border-border/80 bg-card p-12 text-center">
            <CalendarX aria-hidden="true" className="text-muted-foreground/60 size-12" />
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-2xl text-foreground tracking-tight">No Stays Found</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your booked trips will appear here. Find a room from our collection to get started.
              </p>
            </div>
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary hover:opacity-95 mt-2">
              Browse Available Rooms
            </Link>
          </div>
        ) : null}

        {!isLoading
          ? reservations.map((reservation) => (
              <Card key={reservation.id} className="overflow-hidden border border-border/40 bg-card flex flex-col md:flex-row items-stretch">
                <div className="relative w-full md:w-48 aspect-[4/3] md:aspect-auto md:h-auto bg-muted flex-shrink-0 border-b md:border-b-0 md:border-r border-border/30">
                  {reservation.room.primaryPhotoUrl ? (
                    <img
                      src={reservation.room.primaryPhotoUrl}
                      alt={reservation.room.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/40">
                      <BedDouble className="text-muted-foreground/60 size-6" />
                    </div>
                  )}
                  {reservation.status === "cancelled" ? (
                    <span className="absolute top-3 right-3 rounded bg-destructive/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-destructive-foreground">
                      Cancelled
                    </span>
                  ) : (
                    <span className="absolute top-3 right-3 rounded bg-primary/95 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                      Confirmed
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-6 justify-between gap-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <h2 className="font-heading text-2xl text-foreground tracking-tight">{reservation.room.name}</h2>
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/80 mt-1">
                        {reservation.room.type} · {formatDate(reservation.checkInDate)} – {formatDate(reservation.checkOutDate)}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Total Price</span>
                      <p className="text-xl font-bold text-foreground tabular-nums">{formatCents(reservation.totalPrice)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border/30 pt-4 gap-4">
                    <div className="flex items-center gap-6 text-xs text-muted-foreground/90">
                      <div>
                        <span className="font-semibold text-muted-foreground/80 block text-[9px] uppercase tracking-wider mb-0.5">Status</span>
                        <span className="capitalize font-bold text-foreground">{reservation.status}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground/80 block text-[9px] uppercase tracking-wider mb-0.5">Reserved On</span>
                        <span className="font-bold text-foreground">{dateFormatter.format(new Date(reservation.createdAt))}</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => cancelReservation(reservation)}
                      disabled={reservation.status === "cancelled" || cancellingId === reservation.id}
                      className="cursor-pointer text-xs font-semibold uppercase tracking-wider px-4 py-2 h-9"
                    >
                      {cancellingId === reservation.id ? "Cancelling…" : "Cancel Reservation"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          : null}
      </section>
    </main>
  );
}
